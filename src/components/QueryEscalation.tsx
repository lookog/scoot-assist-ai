import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface QueryEscalationProps {
  sessionId: string;
  originalQuestion: string;
}

export function QueryEscalation({ sessionId, originalQuestion }: QueryEscalationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleEscalate = async () => {
    if (!user || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('escalated_queries')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          original_question: originalQuestion,
          escalation_reason: reason,
          customer_feedback: feedback || null,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        description: "Your query has been escalated to our support team. We'll get back to you soon!",
      });
      
      setIsOpen(false);
      setReason('');
      setFeedback('');
    } catch (error) {
      console.error('Error escalating query:', error);
      toast({
        description: "Failed to escalate query. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Need Human Help?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escalate to Human Support</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Why do you need human assistance? *</Label>
            <Textarea
              id="reason"
              placeholder="Please describe what you need help with..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="feedback">Additional feedback (optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Any additional context or feedback about your experience..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-2"
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEscalate}
              disabled={!reason.trim() || isSubmitting}
            >
              {isSubmitting ? 'Escalating...' : 'Escalate Query'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}