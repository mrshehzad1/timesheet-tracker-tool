
-- Update the trigger function to handle existing admin users properly
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the existing admin user record with the auth_user_id when they sign up
  -- Use ON CONFLICT to handle the case where the user might already exist
  INSERT INTO public.users (auth_user_id, name, email, role, is_active) 
  VALUES (NEW.id, 'Admin User', NEW.email, 'admin', true)
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = NEW.id,
    updated_at = now()
  WHERE users.email = NEW.email AND users.role = 'admin';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also ensure we have a unique constraint on email to prevent duplicates
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
