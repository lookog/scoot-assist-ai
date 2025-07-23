import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, MessageSquare, Clock, CheckCircle, AlertCircle, Eye, FileText } from 'lucide-react';

interface OrderInquiry {
  id: string;
  order_id?: string;
  user_id?: string;
  session_id?: string;
  inquiry_type: string;
  description?: string;
  status: string;
  created_at: string;
  resolved_at?: string;
  orders?: {
    order_number: string;
    scooter_model: string;
  };
  users?: {
    full_name: string;
    email: string;
  };
}

const OrderInquiries = () => {
  const [inquiries, setInquiries] = useState<OrderInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState<OrderInquiry | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      const { data, error } = await supabase
        .from('order_inquiries')
        .select(`
          *,
          orders:order_id (
            order_number,
            scooter_model
          ),
          users:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInquiries(data || []);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      toast({
        title: "Error",
        description: "Failed to fetch order inquiries",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveInquiry = async () => {
    if (!selectedInquiry) return;

    try {
      const { error } = await supabase
        .from('order_inquiries')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', selectedInquiry.id);

      if (error) throw error;
      
      await fetchInquiries();
      setResolveDialogOpen(false);
      setResolutionNotes('');
      setSelectedInquiry(null);
      
      toast({
        title: "Success",
        description: "Inquiry resolved successfully"
      });
    } catch (error) {
      console.error('Error resolving inquiry:', error);
      toast({
        title: "Error",
        description: "Failed to resolve inquiry",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'status_inquiry': return 'bg-blue-100 text-blue-800';
      case 'issue_report': return 'bg-red-100 text-red-800';
      case 'delivery_inquiry': return 'bg-purple-100 text-purple-800';
      case 'refund_request': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInquiries = inquiries.filter(inquiry => {
    const matchesSearch = inquiry.orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inquiry.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inquiry.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inquiry.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
    const matchesType = typeFilter === 'all' || inquiry.inquiry_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Inquiries</h1>
        <p className="text-muted-foreground">Manage customer order inquiries and support requests</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {['open', 'in_progress', 'resolved', 'closed'].map(status => {
          const count = inquiries.filter(inquiry => inquiry.status === status).length;
          return (
            <Card key={status}>
              <CardContent className="flex items-center p-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <p className="text-sm text-muted-foreground capitalize">{status.replace('_', ' ')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inquiries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-80"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="status_inquiry">Status Inquiry</SelectItem>
                  <SelectItem value="issue_report">Issue Report</SelectItem>
                  <SelectItem value="delivery_inquiry">Delivery Inquiry</SelectItem>
                  <SelectItem value="refund_request">Refund Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{inquiry.orders?.order_number || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{inquiry.orders?.scooter_model}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{inquiry.users?.full_name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">{inquiry.users?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(inquiry.inquiry_type)}>
                      {inquiry.inquiry_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate">{inquiry.description || 'No description'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(inquiry.status)}>
                      {inquiry.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(inquiry.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {inquiry.status !== 'resolved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedInquiry(inquiry);
                            setResolveDialogOpen(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resolve Inquiry Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Inquiry</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Order: {selectedInquiry.orders?.order_number}</p>
                <p className="text-sm text-muted-foreground">{selectedInquiry.description}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution Notes (Optional)</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add any resolution notes..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={resolveInquiry}>
                  Mark as Resolved
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderInquiries;