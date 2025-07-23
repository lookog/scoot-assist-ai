import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Package, AlertCircle, RefreshCw } from 'lucide-react';

interface OrderInquiryFormProps {
  sessionId?: string;
  onSubmitted?: () => void;
}

const OrderInquiryForm = ({ sessionId, onSubmitted }: OrderInquiryFormProps) => {
  const [inquiryType, setInquiryType] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const inquiryTypes = [
    { value: 'status_inquiry', label: 'Order Status Inquiry', icon: Package },
    { value: 'delivery_inquiry', label: 'Delivery Inquiry', icon: RefreshCw },
    { value: 'issue_report', label: 'Issue Report', icon: AlertCircle },
    { value: 'refund_request', label: 'Refund Request', icon: FileText },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inquiryType || !description) return;

    setLoading(true);
    try {
      // First, try to find the order if order number is provided
      let orderId = null;
      if (orderNumber.trim()) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', orderNumber.trim())
          .eq('user_id', user.id)
          .single();
        
        if (orderData) {
          orderId = orderData.id;
        }
      }

      const { error } = await supabase
        .from('order_inquiries')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          order_id: orderId,
          inquiry_type: inquiryType,
          description: description,
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Inquiry Submitted",
        description: "Your order inquiry has been submitted successfully. We'll get back to you soon."
      });

      // Reset form
      setInquiryType('');
      setOrderNumber('');
      setDescription('');
      onSubmitted?.();

    } catch (error) {
      console.error('Error submitting inquiry:', error);
      toast({
        title: "Error",
        description: "Failed to submit inquiry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Submit Order Inquiry
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inquiry-type">Inquiry Type</Label>
            <Select value={inquiryType} onValueChange={setInquiryType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select inquiry type" />
              </SelectTrigger>
              <SelectContent>
                {inquiryTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="order-number">Order Number (Optional)</Label>
            <Input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g., ORD-12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe your inquiry in detail..."
              rows={4}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !inquiryType || !description}>
            {loading ? 'Submitting...' : 'Submit Inquiry'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default OrderInquiryForm;