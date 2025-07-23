import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EscalatedQuery {
  id: string;
  original_question: string;
  escalation_reason: string;
  status: string;
  customer_feedback: string;
  resolution_notes: string;
  created_at: string;
  resolved_at: string;
  user_id: string;
  session_id: string;
  assigned_to: string;
  users?: { full_name: string; email: string; };
}

const EscalatedQueries = () => {
  const [queries, setQueries] = useState<EscalatedQuery[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<EscalatedQuery | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    fetchQueries();
  }, []);

  const fetchQueries = async () => {
    try {
      const { data, error } = await supabase
        .from('escalated_queries')
        .select(`
          *,
          users (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueries(data || []);
    } catch (error) {
      console.error('Error fetching escalated queries:', error);
      toast({
        title: "Error",
        description: "Failed to load escalated queries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQueryStatus = async (queryId: string, status: string, notes?: string) => {
    try {
      const updateData: any = { status };
      
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolution_notes = notes;
      }

      await supabase
        .from('escalated_queries')
        .update(updateData)
        .eq('id', queryId);

      toast({
        title: "Success",
        description: "Query status updated successfully",
      });

      fetchQueries();
      setDialogOpen(false);
      setSelectedQuery(null);
      setResolutionNotes('');
    } catch (error) {
      console.error('Error updating query status:', error);
      toast({
        title: "Error",
        description: "Failed to update query status",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'destructive';
      case 'in_progress':
        return 'default';
      case 'resolved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const filteredQueries = queries.filter(query => 
    statusFilter === 'all' || query.status === statusFilter
  );

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
          <h1 className="text-3xl font-bold">Escalated Queries</h1>
          <p className="text-muted-foreground">Manage customer queries that need attention</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Escalated Queries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueries.map((query) => (
                <TableRow key={query.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{query.users?.full_name || 'Unknown User'}</div>
                      <div className="text-sm text-muted-foreground">{query.users?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="truncate">{query.original_question}</div>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <div className="truncate">{query.escalation_reason}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(query.status) as any} className="flex items-center gap-1 w-fit">
                      {getStatusIcon(query.status)}
                      {query.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(query.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Dialog open={dialogOpen && selectedQuery?.id === query.id} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) {
                        setSelectedQuery(query);
                        setResolutionNotes(query.resolution_notes || '');
                      } else {
                        setSelectedQuery(null);
                        setResolutionNotes('');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Escalated Query Details</DialogTitle>
                        </DialogHeader>
                        {selectedQuery && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-semibold mb-2">Customer Information</h3>
                              <p><strong>Name:</strong> {selectedQuery.users?.full_name || 'Unknown'}</p>
                              <p><strong>Email:</strong> {selectedQuery.users?.email}</p>
                            </div>
                            
                            <div>
                              <h3 className="font-semibold mb-2">Original Question</h3>
                              <p className="bg-muted p-3 rounded">{selectedQuery.original_question}</p>
                            </div>
                            
                            <div>
                              <h3 className="font-semibold mb-2">Escalation Reason</h3>
                              <p className="bg-muted p-3 rounded">{selectedQuery.escalation_reason}</p>
                            </div>
                            
                            {selectedQuery.customer_feedback && (
                              <div>
                                <h3 className="font-semibold mb-2">Customer Feedback</h3>
                                <p className="bg-muted p-3 rounded">{selectedQuery.customer_feedback}</p>
                              </div>
                            )}
                            
                            <div>
                              <h3 className="font-semibold mb-2">Current Status</h3>
                              <Badge variant={getStatusColor(selectedQuery.status) as any} className="flex items-center gap-1 w-fit">
                                {getStatusIcon(selectedQuery.status)}
                                {selectedQuery.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            {selectedQuery.status !== 'resolved' && (
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2">Resolution Notes</label>
                                  <Textarea
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={4}
                                    placeholder="Enter resolution notes..."
                                  />
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => updateQueryStatus(selectedQuery.id, 'in_progress')}
                                    variant="outline"
                                  >
                                    Mark In Progress
                                  </Button>
                                  <Button
                                    onClick={() => updateQueryStatus(selectedQuery.id, 'resolved', resolutionNotes)}
                                    disabled={!resolutionNotes.trim()}
                                  >
                                    Mark Resolved
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {selectedQuery.status === 'resolved' && selectedQuery.resolution_notes && (
                              <div>
                                <h3 className="font-semibold mb-2">Resolution Notes</h3>
                                <p className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                                  {selectedQuery.resolution_notes}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                  Resolved {formatDistanceToNow(new Date(selectedQuery.resolved_at), { addSuffix: true })}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredQueries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No escalated queries found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EscalatedQueries;