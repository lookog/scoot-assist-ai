-- Add updated_at column to chat_sessions if it doesn't exist
-- and create a function to mark sessions as inactive after 30 minutes

-- Update chat_sessions to mark as inactive if no activity for 30 minutes
CREATE OR REPLACE FUNCTION public.update_session_status()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.chat_sessions 
  SET is_active = false, updated_at = now()
  WHERE is_active = true 
    AND updated_at < now() - interval '30 minutes';
$$;

-- Create a trigger to automatically update updated_at when messages are added
CREATE OR REPLACE FUNCTION public.update_session_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the session's updated_at timestamp when a new message is added
  UPDATE public.chat_sessions 
  SET updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on messages table to update session timestamp
DROP TRIGGER IF EXISTS update_session_on_message ON public.messages;
CREATE TRIGGER update_session_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_timestamp();