-- Fix INSERT policy for users table to allow signup
-- The issue is that during signup, the session isn't established yet
-- So we need to allow inserts where the id matches the user being created
-- Date: 2025-10-14

-- Drop the old policy
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON public.users;

-- Allow authenticated users to insert their own record
-- This works because after auth.signUp() succeeds, the user is authenticated
CREATE POLICY "Authenticated users can insert their profile" ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
