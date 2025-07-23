import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QAItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category_id: string;
  qa_categories?: {
    name: string;
  };
}

interface IntentPattern {
  pattern: string;
  intent: string;
  confidence_threshold: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, sessionId, userId, hasFiles = false, fileTypes = [] } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get QA items and intent patterns
    const [qaResult, intentResult] = await Promise.all([
      supabaseClient
        .from('qa_items')
        .select(`
          id, question, answer, keywords, category_id,
          qa_categories(name)
        `)
        .eq('is_active', true),
      supabaseClient
        .from('intent_patterns')
        .select('*')
        .eq('is_active', true)
    ]);

    const qaItems: QAItem[] = qaResult.data || [];
    const intentPatterns: IntentPattern[] = intentResult.data || [];

    // Find best matching QA item using fuzzy search
    const bestMatch = findBestMatch(query, qaItems);
    let response = '';
    let confidence = 0;
    let matchedIntent = '';
    let relatedItems: string[] = [];
    let responseSource = 'ai';

    console.log('Query:', query);
    console.log('Best match:', bestMatch ? `${bestMatch.confidence.toFixed(3)} - ${bestMatch.item.question}` : 'None');

    if (bestMatch && bestMatch.confidence > 0.3) {
      response = bestMatch.item.answer;
      confidence = bestMatch.confidence;
      responseSource = 'qa_database';
      relatedItems = findRelatedItems(bestMatch.item, qaItems);
      
      console.log('Using FAQ answer:', response.substring(0, 100) + '...');
      
      // Increment view count
      await supabaseClient
        .from('qa_items')
        .update({ view_count: bestMatch.item.view_count + 1 })
        .eq('id', bestMatch.item.id);
    } else {
      console.log('Using Gemini AI response');
      // Use Gemini API for AI response
      const geminiResponse = await callGeminiAPI(query, qaItems, hasFiles, fileTypes);
      response = geminiResponse.answer;
      confidence = geminiResponse.confidence;
      matchedIntent = detectIntent(query, intentPatterns);
    }

    // Generate suggested questions
    const suggestedQuestions = await generateSuggestedQuestions(query, qaItems);

    // Save message to database
    const { data: messageData, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        session_id: sessionId,
        message_type: 'assistant',
        content: response,
        metadata: {
          query: query,
          suggested_questions: suggestedQuestions,
          confidence_score: confidence,
          matched_intent: matchedIntent,
          related_qa_items: relatedItems,
          response_source: responseSource
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving assistant message:', messageError);
    }

    return new Response(JSON.stringify({
      response,
      confidence,
      suggestedQuestions,
      relatedItems,
      messageId: messageData?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-assistant:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function findBestMatch(query: string, qaItems: QAItem[]) {
  let bestMatch = null;
  let highestScore = 0;

  for (const item of qaItems) {
    const questionScore = calculateSimilarity(query.toLowerCase(), item.question.toLowerCase());
    const keywordScore = calculateKeywordMatch(query.toLowerCase(), item.keywords || []);
    const semanticScore = calculateSemanticSimilarity(query.toLowerCase(), item.question.toLowerCase());
    
    // Weight the different scores: semantic similarity gets highest weight
    const finalScore = Math.max(
      questionScore * 0.6, 
      keywordScore * 0.8,
      semanticScore * 1.0
    );

    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = { item: { ...item, view_count: item.view_count || 0 }, confidence: finalScore };
    }
  }

  return bestMatch;
}

function calculateSimilarity(str1: string, str2: string): number {
  // Remove common stop words and normalize
  const stopWords = ['what', 'is', 'the', 'are', 'your', 'my', 'do', 'does', 'can', 'have', 'how', 'where', 'when', 'why', 'i', 'you', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'along', 'following', 'across', 'behind', 'beyond', 'plus', 'except', 'but', 'than', 'that', 'this', 'these', 'those'];
  
  const words1 = str1.toLowerCase().split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));
  const words2 = str2.toLowerCase().split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Calculate exact word matches
  const exactMatches = words1.filter(word => words2.includes(word)).length;
  
  // Calculate partial matches (word contains another word)
  let partialMatches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 !== word2 && (word1.includes(word2) || word2.includes(word1))) {
        partialMatches += 0.5;
        break;
      }
    }
  }
  
  const totalMatches = exactMatches + partialMatches;
  return totalMatches / Math.max(words1.length, words2.length);
}

function calculateKeywordMatch(query: string, keywords: string[]): number {
  if (!keywords || keywords.length === 0) return 0;
  
  const queryWords = query.toLowerCase().split(/\s+/);
  const matches = keywords.filter(keyword => 
    queryWords.some(word => 
      word.includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(word) ||
      // Check for semantic similarity
      areSimilarWords(word, keyword.toLowerCase())
    )
  );
  return matches.length / keywords.length;
}

function areSimilarWords(word1: string, word2: string): boolean {
  // Handle common word variations and semantic similarity
  const synonyms = {
    'speed': ['velocity', 'pace', 'fast', 'quick', 'mph', 'rate'],
    'range': ['distance', 'miles', 'travel', 'reach', 'mileage'],
    'battery': ['charge', 'power', 'energy', 'charging'],
    'waterproof': ['water', 'rain', 'wet', 'weather', 'resistant'],
    'warranty': ['guarantee', 'coverage', 'protection', 'policy'],
    'legal': ['law', 'regulations', 'rules', 'permitted', 'street', 'road'],
    'service': ['repair', 'maintenance', 'fix', 'support'],
    'track': ['follow', 'monitor', 'status', 'order'],
    'payment': ['pay', 'cost', 'price', 'billing', 'methods'],
    'return': ['refund', 'exchange', 'send back', 'policy'],
    'models': ['types', 'versions', 'variants', 'options', 'scooters', 'products'],
    'differences': ['compare', 'comparison', 'different', 'features', 'specs'],
    'features': ['specs', 'specifications', 'capabilities', 'options'],
    'delivery': ['shipping', 'shipping', 'transport', 'sent'],
    'accessories': ['parts', 'add-ons', 'extras', 'components']
  };
  
  for (const [key, values] of Object.entries(synonyms)) {
    if ((word1 === key && values.includes(word2)) || 
        (word2 === key && values.includes(word1)) ||
        (values.includes(word1) && values.includes(word2))) {
      return true;
    }
  }
  
  return false;
}

function calculateSemanticSimilarity(query: string, question: string): number {
  // Enhanced semantic matching for better FAQ detection
  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const questionWords = question.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  let semanticMatches = 0;
  let totalQueryWords = queryWords.length;
  
  for (const queryWord of queryWords) {
    for (const questionWord of questionWords) {
      // Exact match
      if (queryWord === questionWord) {
        semanticMatches += 1;
        break;
      }
      // Semantic similarity using synonyms
      if (areSimilarWords(queryWord, questionWord)) {
        semanticMatches += 0.8;
        break;
      }
      // Partial word match (contains)
      if (queryWord.length > 3 && questionWord.length > 3) {
        if (queryWord.includes(questionWord) || questionWord.includes(queryWord)) {
          semanticMatches += 0.6;
          break;
        }
      }
    }
  }
  
  // Boost score for specific patterns
  if (query.includes('model') && question.includes('model')) {
    semanticMatches += 0.5;
  }
  if (query.includes('difference') && question.includes('difference')) {
    semanticMatches += 0.5;
  }
  if (query.includes('types') && (question.includes('model') || question.includes('difference'))) {
    semanticMatches += 0.3;
  }
  
  return Math.min(semanticMatches / totalQueryWords, 1.0);
}

function findRelatedItems(item: QAItem, allItems: QAItem[]): string[] {
  return allItems
    .filter(otherItem => 
      otherItem.id !== item.id && 
      otherItem.category_id === item.category_id
    )
    .slice(0, 3)
    .map(item => item.id);
}

function detectIntent(query: string, patterns: IntentPattern[]): string {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.pattern, 'i');
    if (regex.test(query)) {
      return pattern.intent;
    }
  }
  return 'general_inquiry';
}

async function callGeminiAPI(query: string, qaItems: QAItem[], hasFiles: boolean = false, fileTypes: string[] = []): Promise<{ answer: string, confidence: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  
  const context = qaItems.map(item => 
    `Q: ${item.question}\nA: ${item.answer}`
  ).slice(0, 10).join('\n\n');

  let fileContext = '';
  if (hasFiles && fileTypes.length > 0) {
    const supportedFileTypes = fileTypes.map(type => {
      if (type.startsWith('image/')) return 'image';
      if (type.startsWith('video/')) return 'video';
      if (type.includes('pdf')) return 'PDF document';
      if (type.includes('document') || type.includes('text/')) return 'document';
      return 'file';
    });
    fileContext = `The user has shared ${fileTypes.length} file(s): ${supportedFileTypes.join(', ')}. Acknowledge these files and offer relevant assistance based on the file types.`;
  }

  const prompt = `
You are a helpful customer service assistant for a scooter company. Use the following FAQ context to answer the user's question. If the question is not covered in the FAQ, provide a helpful general response.

${fileContext}

FAQ Context:
${context}

User Question: ${query}

Provide a helpful, accurate response. Be concise but informative.
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, but I am unable to process your request at the moment.';
    
    return {
      answer,
      confidence: 0.8 // Default confidence for AI responses
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      answer: 'I apologize, but I am experiencing technical difficulties. Please try again later.',
      confidence: 0.1
    };
  }
}

async function generateSuggestedQuestions(query: string, qaItems: QAItem[]): Promise<string[]> {
  const suggestions = [];
  
  // Find questions with similar keywords
  const queryWords = query.toLowerCase().split(' ');
  
  for (const item of qaItems) {
    const itemWords = item.question.toLowerCase().split(' ');
    const commonWords = queryWords.filter(word => itemWords.includes(word));
    
    if (commonWords.length > 0 && suggestions.length < 3) {
      suggestions.push(item.question);
    }
  }
  
  // Add some general helpful questions if we don't have enough
  if (suggestions.length < 3) {
    const generalQuestions = [
      'How do I track my order?',
      'What is the warranty policy?',
      'How do I contact customer support?'
    ];
    
    for (const q of generalQuestions) {
      if (suggestions.length < 3 && !suggestions.includes(q)) {
        suggestions.push(q);
      }
    }
  }
  
  return suggestions;
}