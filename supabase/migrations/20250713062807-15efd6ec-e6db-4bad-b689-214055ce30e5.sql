
-- Create a table for storing user management data
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table for storing webhook configuration
CREATE TABLE public.webhook_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  api_key TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  retry_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table for storing other configuration settings
CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Create policies for users table (only admins can manage users)
CREATE POLICY "Admins can view all users" 
  ON public.users 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.auth_user_id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

CREATE POLICY "Admins can insert users" 
  ON public.users 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.auth_user_id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

CREATE POLICY "Admins can update users" 
  ON public.users 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.auth_user_id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

CREATE POLICY "Admins can delete users" 
  ON public.users 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.auth_user_id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

-- Create policies for webhook_config (only admins can manage)
CREATE POLICY "Admins can manage webhook config" 
  ON public.webhook_config 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.auth_user_id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

-- Create policies for app_config (only admins can manage)
CREATE POLICY "Admins can manage app config" 
  ON public.app_config 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.auth_user_id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

-- Insert initial admin user (this will need to be updated with actual admin user ID)
-- Note: You'll need to update this with the actual auth user ID after creating an admin account
INSERT INTO public.users (auth_user_id, name, email, role) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@company.com' LIMIT 1),
  'Admin User',
  'admin@company.com',
  'admin'
);

-- Insert default configuration values
INSERT INTO public.app_config (config_key, config_value) VALUES
('matters', '["Client A - Project Alpha", "Client B - Project Beta", "Client C - Project Gamma", "Internal - Marketing", "Internal - Operations"]'),
('cost_centres', '["Development", "Marketing", "Sales", "Operations", "Administration"]'),
('business_areas', '["Software Development", "Client Relations", "Business Development", "Training & Education", "Administrative Tasks"]'),
('subcategories', '["Meetings", "Documentation", "Research", "Planning", "Training", "Email Management"]');
