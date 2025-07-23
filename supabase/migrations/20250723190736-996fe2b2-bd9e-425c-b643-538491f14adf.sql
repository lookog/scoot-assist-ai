-- Enable realtime for relevant tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.escalated_queries REPLICA IDENTITY FULL;
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.order_inquiries REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalated_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_inquiries;

-- Create typing_status table for real-time typing indicators
CREATE TABLE public.typing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_typing boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on typing_status
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for typing_status
CREATE POLICY "Users can manage their own typing status"
ON public.typing_status
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can view typing status in their sessions"
ON public.typing_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE chat_sessions.id = typing_status.session_id 
    AND chat_sessions.user_id = auth.uid()
  )
);

-- Enable realtime for typing_status
ALTER TABLE public.typing_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_status;

-- Create notifications table for admin alerts
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days')
);

-- Enable RLS on admin_notifications
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policy for admin notifications
CREATE POLICY "Only admins can view notifications"
ON public.admin_notifications
FOR ALL
USING (is_admin_user(auth.uid()));

-- Enable realtime for admin_notifications
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Function to create admin notification
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  notification_type text,
  notification_title text,
  notification_message text,
  notification_data jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, data)
  VALUES (notification_type, notification_title, notification_message, notification_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function for escalation notifications
CREATE OR REPLACE FUNCTION public.notify_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create admin notification for new escalation
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_admin_notification(
      'escalation',
      'New Query Escalated',
      'A customer query has been escalated to human support',
      jsonb_build_object(
        'escalation_id', NEW.id,
        'user_id', NEW.user_id,
        'session_id', NEW.session_id,
        'reason', NEW.escalation_reason,
        'original_question', NEW.original_question
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for escalation notifications
CREATE TRIGGER trigger_escalation_notification
  AFTER INSERT ON public.escalated_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_escalation();

-- Trigger function for order inquiry notifications
CREATE OR REPLACE FUNCTION public.notify_order_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create admin notification for new order inquiry
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_admin_notification(
      'order_inquiry',
      'New Order Inquiry',
      'A new order inquiry has been submitted',
      jsonb_build_object(
        'inquiry_id', NEW.id,
        'user_id', NEW.user_id,
        'order_id', NEW.order_id,
        'inquiry_type', NEW.inquiry_type,
        'description', NEW.description
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;