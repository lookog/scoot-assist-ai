-- Fix the users table to make phone_number optional for email signups
ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;

-- Update the trigger function to handle email-only signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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