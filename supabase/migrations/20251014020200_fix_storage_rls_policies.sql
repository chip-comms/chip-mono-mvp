-- Fix storage RLS policies for recordings bucket
-- The policies need to match the actual path structure
-- Date: 2025-10-14

-- ============================================================================
-- Step 1: Drop all existing policies on storage.objects
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own directory" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- ============================================================================
-- Step 2: Create new policies with correct path checking
-- ============================================================================

-- Policy: Allow authenticated users to INSERT objects in their user folder
CREATE POLICY "Allow user uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to SELECT objects in their user folder
CREATE POLICY "Allow user reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to UPDATE objects in their user folder
CREATE POLICY "Allow user updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to DELETE objects in their user folder
CREATE POLICY "Allow user deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- Step 3: Ensure RLS is enabled and permissions granted
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated role has necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
