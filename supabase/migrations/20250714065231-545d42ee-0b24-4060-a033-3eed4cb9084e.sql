
-- Drop the problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Only admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- Create a simpler policy that allows the specific admin email to manage users
-- This avoids the recursive lookup issue
CREATE POLICY "Admin email can manage users" ON public.users
FOR ALL USING (
  auth.email() = 'shehzadsc@gmail.com'
  OR
  -- Allow users to update their own auth_user_id when signing up
  (auth.uid() IS NOT NULL AND auth_user_id IS NULL AND email = auth.email())
);

-- Also update the trigger to ensure it works properly
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update the admin user record
  INSERT INTO public.users (auth_user_id, name, email, role, is_active) 
  VALUES (NEW.id, 'Admin User', NEW.email, 'admin', true)
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = NEW.id,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_user_signup();
