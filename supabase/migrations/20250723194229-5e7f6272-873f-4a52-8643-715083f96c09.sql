-- Add is_active column to users table for soft deletion
ALTER TABLE public.users 
ADD COLUMN is_active boolean DEFAULT true;