-- Fix security warnings by setting search_path for functions

-- Update the functions to set search_path properly
CREATE OR REPLACE FUNCTION public.update_session_status()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.chat_sessions 
  SET is_active = false, updated_at = now()
  WHERE is_active = true 
    AND updated_at < now() - interval '30 minutes';
$$;

CREATE OR REPLACE FUNCTION public.update_session_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Update the session's updated_at timestamp when a new message is added
  UPDATE public.chat_sessions 
  SET updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$;