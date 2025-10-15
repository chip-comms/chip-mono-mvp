-- Add INSERT policy for users table to allow signup
-- Date: 2025-10-14

-- Allow users to insert their own record during signup
CREATE POLICY "Users can insert their own profile during signup" ON public.users
    FOR INSERT WITH CHECK (id = auth.uid());
