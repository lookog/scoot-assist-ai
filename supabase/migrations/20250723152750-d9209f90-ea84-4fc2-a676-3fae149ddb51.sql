-- Create enum types for better data integrity
CREATE TYPE public.message_type AS ENUM ('user', 'assistant', 'system');
CREATE TYPE public.interaction_type AS ENUM ('faq_view', 'question_asked', 'file_uploaded', 'escalated');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.inquiry_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.escalation_status AS ENUM ('pending', 'assigned', 'in_progress', 'resolved', 'closed');

-- Create users table for customer profiles (linked to auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_users table for administrative access
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create qa_categories table for organizing question types
CREATE TABLE public.qa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.admin_users(id)
);

-- Create qa_items table for knowledge base questions and answers
CREATE TABLE public.qa_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.qa_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[], -- For search matching
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.admin_users(id),
  updated_by UUID REFERENCES public.admin_users(id)
);

-- Create orders table for scooter purchase and delivery information
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  scooter_model TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  total_amount DECIMAL(10,2),
  status order_status DEFAULT 'pending',
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estimated_delivery DATE,
  actual_delivery DATE,
  delivery_address TEXT,
  tracking_number TEXT,
  notes TEXT
);

-- Create chat_sessions table for conversation tracking
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  session_summary TEXT
);

-- Create messages table for chat message storage
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type message_type NOT NULL,
  qa_item_id UUID REFERENCES public.qa_items(id), -- If message was from FAQ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB -- For storing additional data like file references
);

-- Create uploaded_files table for managing customer file attachments
CREATE TABLE public.uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_interactions table for tracking customer engagement
CREATE TABLE public.user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  interaction_type interaction_type NOT NULL,
  qa_item_id UUID REFERENCES public.qa_items(id),
  session_id UUID REFERENCES public.chat_sessions(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_inquiries table for customer order-related questions
CREATE TABLE public.order_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.chat_sessions(id),
  inquiry_type TEXT NOT NULL, -- 'delivery_status', 'modification', 'cancellation', etc.
  description TEXT,
  status inquiry_status DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create escalated_queries table for unresolved customer issues
CREATE TABLE public.escalated_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.chat_sessions(id),
  original_question TEXT NOT NULL,
  customer_feedback TEXT,
  escalation_reason TEXT,
  status escalation_status DEFAULT 'pending',
  assigned_to UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalated_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view and update their own profile" ON public.users
  FOR ALL USING (auth.uid() = id);

-- RLS Policies for admin_users table
CREATE POLICY "Admin users can view all admin profiles" ON public.admin_users
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Admin users can update their own profile" ON public.admin_users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for qa_categories and qa_items (public read, admin write)
CREATE POLICY "Anyone can view active QA categories" ON public.qa_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage QA categories" ON public.qa_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Anyone can view active QA items" ON public.qa_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage QA items" ON public.qa_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage orders" ON public.orders
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view their own chat sessions" ON public.chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions" ON public.chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all chat sessions" ON public.chat_sessions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for messages
CREATE POLICY "Users can view messages from their sessions" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create messages in their sessions" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = session_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all messages" ON public.messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for uploaded_files
CREATE POLICY "Users can view their uploaded files" ON public.uploaded_files
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can upload files" ON public.uploaded_files
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Admins can view all uploaded files" ON public.uploaded_files
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for user_interactions
CREATE POLICY "Users can view their own interactions" ON public.user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interactions" ON public.user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all interactions" ON public.user_interactions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for order_inquiries
CREATE POLICY "Users can view their own order inquiries" ON public.order_inquiries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all order inquiries" ON public.order_inquiries
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- RLS Policies for escalated_queries
CREATE POLICY "Users can view their own escalated queries" ON public.escalated_queries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create escalated queries" ON public.escalated_queries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage escalated queries" ON public.escalated_queries
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_users_phone ON public.users(phone_number);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_messages_session_id ON public.messages(session_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_qa_items_category_id ON public.qa_items(category_id);
CREATE INDEX idx_qa_items_keywords ON public.qa_items USING GIN(keywords);
CREATE INDEX idx_user_interactions_user_id ON public.user_interactions(user_id);
CREATE INDEX idx_escalated_queries_status ON public.escalated_queries(status);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_qa_items_updated_at
  BEFORE UPDATE ON public.qa_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone_number, full_name, email)
  VALUES (
    NEW.id, 
    NEW.phone,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();