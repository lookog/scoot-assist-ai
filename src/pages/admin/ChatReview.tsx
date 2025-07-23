import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Eye, Search, Calendar, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
  user_name: string;
  message_count: number;
  is_active: boolean;
}

interface Message {
  id: string;
  content: string;
  message_type: 'user' | 'assistant' | 'system';
  created_at: string;
  metadata?: any;
}

const ChatReview = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [searchTerm]);

  const fetchSessions = async () => {
    try {
      let query = supabase
        .from('chat_sessions')
        .select(`
          id,
          title,
          created_at,
          user_id,
          is_active,
          users!inner(full_name),
          messages(id)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,users.full_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sessionsWithCounts = data?.map(session => ({
        id: session.id,
        title: session.title || 'Untitled Chat',
        created_at: session.created_at,
        user_id: session.user_id,
        user_name: (session.users as any)?.full_name || 'Unknown User',
        message_count: session.messages?.length || 0,
        is_active: session.is_active
      })) || [];

      setSessions(sessionsWithCounts);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const openSession = (session: ChatSession) => {
    setSelectedSession(session);
    fetchMessages(session.id);
  };

  const getMessageTypeColor = (type: string) => {
    if (type === 'user') return 'bg-blue-100 text-blue-800';
    if (type === 'system') return 'bg-gray-100 text-gray-800';
    return 'bg-green-100 text-green-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chat Review & Replay</h1>
          <p className="text-muted-foreground">Review and analyze customer chat sessions</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin')}>
          Back to Dashboard
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">Chat conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.filter(s => s.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.length > 0 
                ? Math.round(sessions.reduce((sum, s) => sum + s.message_count, 0) / sessions.length)
                : 0
              }
            </div>
            <p className="text-xs text-muted-foreground">Per session</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by session title or user name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chat Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{session.title}</div>
                      <div className="text-sm text-muted-foreground">ID: {session.id.substring(0, 8)}...</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {session.user_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{session.message_count}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(session.created_at), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={session.is_active ? "default" : "secondary"}>
                      {session.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openSession(session)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle>
                            Chat Session: {selectedSession?.title}
                          </DialogTitle>
                          <div className="text-sm text-muted-foreground">
                            User: {selectedSession?.user_name} • 
                            Created: {selectedSession && format(new Date(selectedSession.created_at), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] w-full">
                          {messagesLoading ? (
                            <div className="flex items-center justify-center h-32">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                          ) : (
                            <div className="space-y-4 p-4">
                              {messages.map((message, index) => (
                                <div key={message.id} className="flex gap-4">
                                  <div className="flex-shrink-0">
                                    <Badge 
                                      variant="outline" 
                                      className={getMessageTypeColor(message.message_type)}
                                    >
                                      {message.message_type === 'user' ? 'User' : 
                                       message.message_type === 'system' ? 'System' : 'AI'}
                                    </Badge>
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="bg-muted p-3 rounded-lg">
                                      <p className="text-sm">{message.content}</p>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(message.created_at), 'HH:mm:ss')}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {messages.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">
                                  No messages in this session
                                </p>
                              )}
                            </div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {sessions.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No chat sessions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatReview;