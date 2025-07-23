-- Fix security warnings by setting search_path for functions

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.users (id, phone_number, full_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.phone, NULL),  -- Allow null phone numbers
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- Fix is_admin_user function
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE id = user_id AND is_active = true
  );
$function$;

-- Fix create_admin_notification function
CREATE OR REPLACE FUNCTION public.create_admin_notification(notification_type text, notification_title text, notification_message text, notification_data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, data)
  VALUES (notification_type, notification_title, notification_message, notification_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;

-- Fix notify_escalation function
CREATE OR REPLACE FUNCTION public.notify_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Fix notify_order_inquiry function
CREATE OR REPLACE FUNCTION public.notify_order_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;