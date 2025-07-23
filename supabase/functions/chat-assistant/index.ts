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
    const { query, sessionId, userId } = await req.json();
    
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

    if (bestMatch && bestMatch.confidence > 0.7) {
      response = bestMatch.item.answer;
      confidence = bestMatch.confidence;
      responseSource = 'qa_database';
      relatedItems = findRelatedItems(bestMatch.item, qaItems);
      
      // Increment view count
      await supabaseClient
        .from('qa_items')
        .update({ view_count: bestMatch.item.view_count + 1 })
        .eq('id', bestMatch.item.id);
    } else {
      // Use Gemini API for AI response
      const geminiResponse = await callGeminiAPI(query, qaItems);
      response = geminiResponse.answer;
      confidence = geminiResponse.confidence;
      matchedIntent = detectIntent(query, intentPatterns);
    }

    // Generate suggested questions
    const suggestedQuestions = await generateSuggestedQuestions(query, qaItems);

    // Save message to database
    const { data: messageData } = await supabaseClient
      .from('messages')
      .insert({
        session_id: sessionId,
        message_type: 'assistant',
        content: response,
        confidence_score: confidence,
        matched_intent: matchedIntent,
        related_qa_items: relatedItems,
        response_source: responseSource,
        metadata: {
          query: query,
          suggested_questions: suggestedQuestions
        }
      })
      .select()
      .single();

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
    const score = calculateSimilarity(query.toLowerCase(), item.question.toLowerCase());
    const keywordScore = calculateKeywordMatch(query.toLowerCase(), item.keywords || []);
    const finalScore = Math.max(score, keywordScore);

    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = { item, confidence: finalScore };
    }
  }

  return bestMatch;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}

function calculateKeywordMatch(query: string, keywords: string[]): number {
  const queryWords = query.split(' ');
  const matches = keywords.filter(keyword => 
    queryWords.some(word => word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word))
  );
  return matches.length / Math.max(keywords.length, 1);
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

async function callGeminiAPI(query: string, qaItems: QAItem[]): Promise<{ answer: string, confidence: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  
  const context = qaItems.map(item => 
    `Q: ${item.question}\nA: ${item.answer}`
  ).slice(0, 10).join('\n\n');

  const prompt = `
You are a helpful customer service assistant for a scooter company. Use the following FAQ context to answer the user's question. If the question is not covered in the FAQ, provide a helpful general response.

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