-- Use database trigger to automatically create user profile
-- This bypasses RLS and works regardless of email confirmation settings
-- Date: 2025-10-14

-- Drop the insert policy since we'll use a trigger instead
DROP POLICY IF EXISTS "Authenticated users can insert their profile" ON public.users;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, first_login_completed)
  VALUES (NEW.id, NEW.email, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user profile when a new auth user is created';
