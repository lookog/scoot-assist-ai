import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useParams, useNavigate } from "react-router-dom";

interface Message {
  id: string;
  content: string;
  message_type: 'user' | 'assistant' | 'system';
  created_at: string;
  session_id: string;
}

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      initializeChat();
    }
    return () => {
      // Cleanup realtime subscription on unmount
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, urlSessionId]);

  const initializeChat = async () => {
    try {
      let currentSessionId = urlSessionId;

      if (urlSessionId) {
        // Check if the session exists and belongs to the user
        const { data: existingSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', urlSessionId)
          .eq('user_id', user?.id)
          .single();

        if (sessionError || !existingSession) {
          console.error('Session not found or unauthorized:', sessionError);
          navigate('/chat');
          return;
        }
        
        currentSessionId = existingSession.id;
      } else {
        // Check if user has an active session, or create a new one
        let { data: activeSession } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user?.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (!activeSession) {
          // Create a new chat session
          const { data: newSession, error } = await supabase
            .from('chat_sessions')
            .insert({
              user_id: user?.id,
              title: 'New Chat',
              is_active: true
            })
            .select()
            .single();

          if (error) throw error;
          activeSession = newSession;
        }
        
        currentSessionId = activeSession.id;
        navigate(`/chat/${currentSessionId}`, { replace: true });
      }

      setSessionId(currentSessionId);
      
      // Load existing messages for this session
      await loadMessages(currentSessionId);
      
      // Clean up previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      // Set up real-time subscription
      const channel = supabase
        .channel(`chat-messages-${currentSessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${currentSessionId}`
          },
          (payload) => {
            console.log('New message received:', payload.new);
            setMessages(prev => {
              // Avoid duplicates
              const exists = prev.find(msg => msg.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    } catch (error) {
      console.error('Error initializing chat:', error);
      toast({
        title: "Error",
        description: "Failed to initialize chat",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionId || !user) return;

    setIsLoading(true);
    try {
      // Update session to set proper title on first message
      if (messages.length === 0) {
        await supabase
          .from('chat_sessions')
          .update({ 
            title: newMessage.slice(0, 50) + (newMessage.length > 50 ? '...' : ''),
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      } else {
        // Update session updated_at timestamp
        await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }

      // Add user message
      const { error: userMsgError } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          content: newMessage,
          message_type: 'user'
        });

      if (userMsgError) throw userMsgError;

      const userMessage = newMessage;
      setNewMessage("");

      // Simulate AI response (replace with actual AI integration later)
      setTimeout(async () => {
        const aiResponse = generateMockResponse(userMessage);
        
        const { error: aiMsgError } = await supabase
          .from('messages')
          .insert({
            session_id: sessionId,
            content: aiResponse,
            message_type: 'assistant'
          });

        if (aiMsgError) throw aiMsgError;
        
        // Update session timestamp after AI response
        await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId);
          
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const generateMockResponse = (userMessage: string): string => {
    const responses = [
      "I understand you're having issues with your scooter. Let me help you with that.",
      "That's a great question! Here's what I recommend for your scooter maintenance.",
      "I can help you troubleshoot that problem. Have you tried checking the battery connection?",
      "For warranty issues, I'll need to gather some information about your scooter model and purchase date.",
      "Safety is our top priority. Here are the steps you should follow for that issue."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold text-foreground">ScootAssist AI</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Typing..." : "Online"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold mb-2">Welcome to ScootAssist AI</h3>
            <p className="text-sm">
              I'm here to help you with your scooter questions and support needs.
              Ask me anything!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.message_type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.message_type === 'assistant' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`max-w-[80%] ${
                  message.message_type === 'user'
                    ? 'order-2'
                    : 'order-1'
                }`}
              >
                <Card
                  className={`p-3 ${
                    message.message_type === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </Card>
                <p className={`text-xs text-muted-foreground mt-1 ${
                  message.message_type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {formatTime(message.created_at)}
                </p>
              </div>

              {message.message_type === 'user' && (
                <Avatar className="h-8 w-8 order-3">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <Card className="p-3 bg-muted">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-card p-4">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;