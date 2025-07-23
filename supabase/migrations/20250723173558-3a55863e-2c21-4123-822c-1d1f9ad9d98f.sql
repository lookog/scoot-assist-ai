-- Fix infinite recursion in admin_users RLS policies

-- First, create a security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE id = user_id AND is_active = true
  );
$$;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admin users can view all admin profiles" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can update their own profile" ON public.admin_users;

-- Create new policies using the security definer function
CREATE POLICY "Admin users can view all admin profiles" 
ON public.admin_users 
FOR SELECT 
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin users can update their own profile" 
ON public.admin_users 
FOR UPDATE 
USING (auth.uid() = id);