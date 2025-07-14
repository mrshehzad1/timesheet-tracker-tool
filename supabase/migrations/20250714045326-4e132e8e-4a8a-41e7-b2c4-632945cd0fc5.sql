
-- First, let's check if we have any users in the users table and update the webhook policies
-- Remove the existing restrictive policy and add a temporary one for development
DROP POLICY IF EXISTS "Admins can manage webhook config" ON public.webhook_config;

-- Create a temporary policy that allows authenticated users to manage webhook config
-- This is for development purposes - you should restrict this to admins later
CREATE POLICY "Allow authenticated users to manage webhook config" 
  ON public.webhook_config 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also ensure we have proper policies for app_config that don't cause issues
DROP POLICY IF EXISTS "Admins can manage app config" ON public.app_config;

CREATE POLICY "Allow authenticated users to manage app config" 
  ON public.app_config 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
