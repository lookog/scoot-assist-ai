import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';
import { useToast } from '@/hooks/use-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, User, ArrowLeft, Package, Plus, Paperclip } from 'lucide-react';
import { MessageRating } from '@/components/MessageRating';
import { QueryEscalation } from '@/components/QueryEscalation';
import { SuggestedQuestions } from '@/components/SuggestedQuestions';
import { ConfidenceIndicator } from '@/components/ConfidenceIndicator';
import { FileUpload, type FileUploadData } from '@/components/FileUpload';
import { FilePreview } from '@/components/FilePreview';
import { TypingIndicator } from '@/components/TypingIndicator';
import { EscalationNotifications } from '@/components/EscalationNotifications';
import OrderInquiryForm from '@/components/OrderInquiryForm';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: string;
  session_id: string;
  confidence_score?: number;
  response_source?: string;
  file_attachments?: FileUploadData[];
  metadata?: {
    suggested_questions?: string[];
  };
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [lastUserQuestion, setLastUserQuestion] = useState('');
  const [pendingFiles, setPendingFiles] = useState<FileUploadData[]>([]);
  const [showOrderInquiry, setShowOrderInquiry] = useState(false);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const channelRef = useRef<any>(null);

  // Stable callback references for realtime
  const handleNewMessage = useCallback((message: any) => {
    // Add any new message (user or assistant) if it doesn't already exist
    setMessages(prev => {
      const exists = prev.find(msg => msg.id === message.id);
      if (exists) return prev;
      
      const newMessage: Message = {
        id: message.id,
        content: message.content,
        type: message.message_type === 'user' ? 'user' : 'assistant',
        timestamp: message.created_at,
        session_id: message.session_id,
        confidence_score: (message.metadata as any)?.confidence_score,
        response_source: (message.metadata as any)?.response_source,
        metadata: (message.metadata as any)
      };
      
      return [...prev, newMessage];
    });
  }, []);

  const handleTypingChange = useCallback((users: any[]) => {
    setTypingUsers(users);
  }, []);

  const handleSessionUpdate = useCallback((session: any) => {
    console.log('Session updated:', session);
  }, []);

  // Realtime functionality
  const { updateTypingStatus } = useRealtime({
    sessionId: sessionId,
    onNewMessage: handleNewMessage,
    onTypingChange: handleTypingChange,
    onSessionUpdate: handleSessionUpdate,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      initializeChat();
    }
  }, [user, urlSessionId]);

  // Separate effect for cleanup to avoid reconnection issues
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('Cleaning up chat channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const initializeChat = async () => {
    try {
      let currentSessionId = urlSessionId;

      if (urlSessionId) {
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
        let { data: activeSession } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user?.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (!activeSession) {
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
      await loadMessages(currentSessionId);
      
      // Remove old realtime subscription handling since we use useRealtime hook now
      // The useRealtime hook will handle all realtime functionality
    } catch (error) {
      console.error('Error initializing chat:', error);
      toast({
        description: "Failed to initialize chat",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Load file attachments for each message
      const messagesWithFiles = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const { data: files } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('message_id', msg.id)
            .eq('upload_status', 'completed');

          const fileAttachments: FileUploadData[] = (files || []).map(file => ({
            id: file.id,
            fileName: file.file_name,
            fileSize: file.file_size,
            fileType: file.file_type,
            storagePath: file.storage_path,
            uploadStatus: file.upload_status as 'completed',
            metadata: file.metadata,
          }));

          return {
            id: msg.id,
            content: msg.content,
            type: msg.message_type === 'user' ? 'user' : 'assistant',
            timestamp: msg.created_at,
            session_id: msg.session_id,
            confidence_score: (msg.metadata as any)?.confidence_score,
            response_source: (msg.metadata as any)?.response_source,
            file_attachments: fileAttachments,
            metadata: (msg.metadata as any)
          } as Message;
        })
      );
      
      setMessages(messagesWithFiles);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (messageText?: string, includeFiles = true) => {
    const textToSend = messageText || input.trim();
    const filesToAttach = includeFiles ? pendingFiles : [];
    
    if (!textToSend && filesToAttach.length === 0) return;
    if (!sessionId || !user) return;

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      updateTypingStatus(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend || (filesToAttach.length > 0 ? `Shared ${filesToAttach.length} file(s)` : ''),
      type: 'user',
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      file_attachments: filesToAttach,
    };

    // Don't add user message to state here - wait for database confirmation and real-time update
    setLastUserQuestion(textToSend);
    if (!messageText) {
      setInput('');
      setPendingFiles([]);
    }
    setIsLoading(true);
    setSuggestedQuestions([]);

    try {
      // Insert message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          message_type: 'user',
          content: textToSend || `Shared ${filesToAttach.length} file(s)`,
          file_attachments: filesToAttach.map(f => ({ id: f.id, fileName: f.fileName, fileType: f.fileType })),
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Link files to message
      if (filesToAttach.length > 0) {
        const { error: linkError } = await supabase
          .from('file_uploads')
          .update({ message_id: messageData.id })
          .in('id', filesToAttach.map(f => f.id));

        if (linkError) {
          console.error('Error linking files to message:', linkError);
        }
      }

      const isFirstMessage = messages.length === 0;
      if (isFirstMessage) {
        await supabase
          .from('chat_sessions')
          .update({
            title: textToSend?.substring(0, 100) || 'File Upload',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      } else {
        await supabase
          .from('chat_sessions')
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      const response = await supabase.functions.invoke('chat-assistant', {
        body: {
          query: textToSend || `User shared ${filesToAttach.length} file(s): ${filesToAttach.map(f => f.fileName).join(', ')}`,
          sessionId: sessionId,
          userId: user.id,
          hasFiles: filesToAttach.length > 0,
          fileTypes: filesToAttach.map(f => f.fileType)
        }
      });

      if (response.error) throw response.error;

      const { suggestedQuestions: newSuggestions } = response.data;
      
      // Don't create a temporary assistant message here - wait for real-time update
      // The edge function will save the assistant message to the database
      setSuggestedQuestions(newSuggestions || []);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (fileData: FileUploadData) => {
    setPendingFiles(prev => [...prev, fileData]);
    toast({
      description: `File "${fileData.fileName}" uploaded successfully`,
    });
  };

  const removePendingFile = (fileId: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const startNewChat = async () => {
    try {
      // Mark current session as inactive
      if (sessionId) {
        await supabase
          .from('chat_sessions')
          .update({ is_active: false })
          .eq('id', sessionId);
      }

      // Create new session
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

      // Navigate to new session
      navigate(`/chat/${newSession.id}`);
      
      toast({
        description: "Started new chat session",
      });
    } catch (error) {
      console.error('Error starting new chat:', error);
      toast({
        description: "Failed to start new chat",
        variant: "destructive",
      });
    }
  };


  if (!user) {
    return <div className="flex items-center justify-center h-full">Please log in to access chat.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
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
          
          <div className="flex items-center gap-2">
            <EscalationNotifications sessionId={sessionId || undefined} />
            <Button 
              variant="outline" 
              size="sm"
              onClick={startNewChat}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold mb-2">Welcome to ScootAssist AI</h3>
            <p className="text-sm max-w-md mx-auto">
              I'm here to help you with your scooter questions and support needs. 
              Ask me anything about your scooter, warranty, maintenance, or troubleshooting!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.type === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2 max-w-[70%]">
                   <div
                     className={`p-3 rounded-lg ${
                       message.type === 'user'
                         ? 'bg-primary text-primary-foreground'
                         : 'bg-muted'
                     }`}
                   >
                     {message.content && <p className="text-sm">{message.content}</p>}
                     
                     {/* File Attachments */}
                     {message.file_attachments && message.file_attachments.length > 0 && (
                       <div className={`${message.content ? 'mt-3' : ''} space-y-2`}>
                         {message.file_attachments.map((file) => (
                           <FilePreview
                             key={file.id}
                             fileData={file}
                             showPreview={true}
                             className="max-w-sm"
                           />
                         ))}
                       </div>
                     )}
                     
                     <div className="flex items-center justify-between mt-2">
                       <p className="text-xs opacity-70">
                         {formatTime(message.timestamp)}
                       </p>
                       {message.type === 'assistant' && message.confidence_score && (
                         <ConfidenceIndicator 
                           confidence={message.confidence_score}
                           source={message.response_source}
                         />
                       )}
                     </div>
                   </div>
                  
                  {message.type === 'assistant' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <MessageRating messageId={message.id} />
                      </div>
                      
                      {message.metadata?.suggested_questions && (
                        <SuggestedQuestions
                          questions={message.metadata.suggested_questions}
                          onQuestionSelect={handleSuggestedQuestion}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
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

        {/* Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} className="px-4 pb-2" />
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-background p-4 space-y-4">
        {suggestedQuestions.length > 0 && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            onQuestionSelect={handleSuggestedQuestion}
          />
        )}

        {/* Pending Files - More compact display */}
        {pendingFiles.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {pendingFiles.length} file(s) ready to send
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingFiles([])}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((file) => (
                <div key={file.id} className="relative bg-background rounded border p-2 flex items-center gap-2 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="truncate max-w-24">{file.fileName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePendingFile(file.id)}
                    className="h-4 w-4 p-0 ml-1"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-2">
            {/* Main input with integrated file upload */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  
                  // Handle typing indicator
                  const hasText = e.target.value.trim().length > 0;
                  if (hasText && !isTyping) {
                    setIsTyping(true);
                    updateTypingStatus(true);
                  } else if (!hasText && isTyping) {
                    setIsTyping(false);
                    updateTypingStatus(false);
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              
              {/* File Upload Button */}
              {sessionId && (
                <div className="flex items-center">
                  <FileUpload
                    sessionId={sessionId}
                    onFileUpload={handleFileUpload}
                    className=""
                    compact={true}
                  />
                </div>
              )}
              
              <Button 
                variant="outline" 
                onClick={() => setShowOrderInquiry(!showOrderInquiry)}
                className="px-3"
              >
                <Package className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => sendMessage()} 
                disabled={isLoading || (!input.trim() && pendingFiles.length === 0)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {showOrderInquiry && (
          <div className="mt-4">
            <OrderInquiryForm 
              sessionId={sessionId || undefined}
              onSubmitted={() => setShowOrderInquiry(false)}
            />
          </div>
        )}
        
        {lastUserQuestion && (
          <div className="flex justify-center">
            <QueryEscalation 
              sessionId={sessionId || ''} 
              originalQuestion={lastUserQuestion}
            />
          </div>
        )}
      </div>
    </div>
  );
}