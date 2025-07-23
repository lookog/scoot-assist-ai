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
import { Upload, Search, Edit, Eye, Download, Plus } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  scooter_model: string;
  user_id: string;
  quantity: number;
  total_amount: number;
  status: string;
  order_date: string;
  estimated_delivery: string;
  actual_delivery?: string;
  tracking_number?: string;
  delivery_address?: string;
  notes?: string;
  users?: {
    full_name: string;
    email: string;
  };
}

const OrderManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          users:user_id (
            full_name,
            email
          )
        `)
        .order('order_date', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, trackingNumber?: string) => {
    try {
      const updateData: any = { status };
      if (trackingNumber) updateData.tracking_number = trackingNumber;
      if (status === 'delivered') updateData.actual_delivery = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      await fetchOrders();
      toast({
        title: "Success",
        description: "Order status updated successfully"
      });
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive"
      });
    }
  };

  const handleBulkImport = async () => {
    try {
      const lines = bulkData.trim().split('\n');
      const orders = lines.map(line => {
        const [orderNumber, scooterModel, customerEmail, quantity, totalAmount, status, deliveryAddress] = line.split(',');
        const orderStatus = status?.trim() || 'pending';
        return {
          order_number: orderNumber?.trim(),
          scooter_model: scooterModel?.trim(),
          quantity: parseInt(quantity?.trim()) || 1,
          total_amount: parseFloat(totalAmount?.trim()) || 0,
          status: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(orderStatus) 
            ? orderStatus as 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
            : 'pending' as const,
          delivery_address: deliveryAddress?.trim(),
          order_date: new Date().toISOString(),
          estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      });

      const { error } = await supabase
        .from('orders')
        .insert(orders);

      if (error) throw error;
      
      await fetchOrders();
      setBulkImportOpen(false);
      setBulkData('');
      toast({
        title: "Success",
        description: `${orders.length} orders imported successfully`
      });
    } catch (error) {
      console.error('Error importing orders:', error);
      toast({
        title: "Error",
        description: "Failed to import orders",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.scooter_model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.users?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">Manage customer orders and track deliveries</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Import Orders</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Import orders using CSV format: Order Number, Scooter Model, Customer Email, Quantity, Total Amount, Status, Delivery Address
                </p>
                <Textarea
                  placeholder="ORD001,ScootMax Pro,customer@email.com,1,1299.99,pending,123 Main St"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  rows={8}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setBulkImportOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkImport}>
                    Import Orders
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => {
          const count = orders.filter(order => order.status === status).length;
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-sm text-muted-foreground capitalize">{status}</p>
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
                  placeholder="Search orders..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.users?.full_name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">{order.users?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{order.scooter_model}</TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell>${order.total_amount}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Order: {selectedOrder.order_number}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.scooter_model}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => setSelectedOrder({...selectedOrder, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedOrder.status === 'shipped' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tracking Number</label>
                  <Input
                    value={selectedOrder.tracking_number || ''}
                    onChange={(e) => setSelectedOrder({...selectedOrder, tracking_number: e.target.value})}
                    placeholder="Enter tracking number"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => updateOrderStatus(selectedOrder.id, selectedOrder.status, selectedOrder.tracking_number)}>
                  Update
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderManagement;