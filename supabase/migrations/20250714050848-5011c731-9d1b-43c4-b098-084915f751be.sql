
-- First, let's create a proper admin user and fix the authentication system
-- Insert or update admin user with your email
INSERT INTO public.users (auth_user_id, name, email, role, is_active) 
VALUES (
  null, -- auth_user_id will be updated when you actually sign up
  'Admin User',
  'shehzadsc@gmail.com',
  'admin',
  true
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  updated_at = now();

-- Remove the temporary policies that allowed all authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to manage webhook config" ON public.webhook_config;
DROP POLICY IF EXISTS "Allow authenticated users to manage app config" ON public.app_config;
DROP POLICY IF EXISTS "Temporary allow all users management" ON public.users;

-- Create proper admin-only policies for webhook_config
CREATE POLICY "Only admins can manage webhook config" 
  ON public.webhook_config 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = 'shehzadsc@gmail.com' 
      AND role = 'admin' 
      AND is_active = true
      AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = 'shehzadsc@gmail.com' 
      AND role = 'admin' 
      AND is_active = true
      AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
    )
  );

-- Create proper admin-only policies for app_config
CREATE POLICY "Only admins can manage app config" 
  ON public.app_config 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = 'shehzadsc@gmail.com' 
      AND role = 'admin' 
      AND is_active = true
      AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = 'shehzadsc@gmail.com' 
      AND role = 'admin' 
      AND is_active = true
      AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
    )
  );

-- Create proper admin-only policies for users table
CREATE POLICY "Only admins can manage users" 
  ON public.users 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = 'shehzadsc@gmail.com' 
      AND role = 'admin' 
      AND is_active = true
      AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE email = 'shehzadsc@gmail.com' 
      AND role = 'admin' 
      AND is_active = true
      AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
    )
  );

-- Create a function to update auth_user_id when user signs up
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the admin user record with the auth_user_id when they sign up
  UPDATE public.users 
  SET auth_user_id = NEW.id, updated_at = now()
  WHERE email = NEW.email AND role = 'admin' AND auth_user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically link admin user when they sign up
DROP TRIGGER IF EXISTS on_admin_user_signup ON auth.users;
CREATE TRIGGER on_admin_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_user_signup();
