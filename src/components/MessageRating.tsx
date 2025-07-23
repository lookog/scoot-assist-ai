import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface MessageRatingProps {
  messageId: string;
  onRate?: (rating: boolean) => void;
}

export function MessageRating({ messageId, onRate }: MessageRatingProps) {
  const [rating, setRating] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleRate = async (isHelpful: boolean) => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_interactions')
        .upsert({
          user_id: user.id,
          interaction_type: 'question_asked',
          metadata: {
            message_id: messageId,
            is_helpful: isHelpful,
            rating_value: isHelpful ? 5 : 1,
            action_type: 'rating'
          }
        });

      if (error) throw error;

      setRating(isHelpful);
      onRate?.(isHelpful);
      
      toast({
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Error rating message:', error);
      toast({
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rating !== null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Thank you for your feedback!</span>
        {rating ? (
          <ThumbsUp className="h-4 w-4 text-green-500" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-red-500" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Was this helpful?</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRate(true)}
        disabled={isSubmitting}
        className="h-8 px-2"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleRate(false)}
        disabled={isSubmitting}
        className="h-8 px-2"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}