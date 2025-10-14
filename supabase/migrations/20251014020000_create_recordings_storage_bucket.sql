-- Create storage bucket for meeting recordings
-- Supports both video and audio files
-- Date: 2025-10-14

-- ============================================================================
-- Step 1: Create the recordings bucket
-- ============================================================================

-- Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  false, -- Private bucket, requires authentication
  524288000, -- 500MB limit (500 * 1024 * 1024)
  ARRAY[
    -- Video formats
    'video/mp4',
    'video/quicktime',     -- .mov files
    'video/webm',
    'video/x-msvideo',     -- .avi files
    'video/x-matroska',    -- .mkv files
    -- Audio formats
    'audio/mpeg',          -- .mp3 files
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',           -- .m4a files
    'audio/aac',
    'audio/flac',
    'audio/ogg',
    'audio/x-m4a'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
    'video/x-matroska',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/aac',
    'audio/flac',
    'audio/ogg',
    'audio/x-m4a'
  ];

-- ============================================================================
-- Step 2: Create RLS policies for user-scoped access
-- ============================================================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload files to their own directory
-- Path format: recordings/{user_id}/{year}/{month}/{job_id}.{ext}
CREATE POLICY "Users can upload to their own directory"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own files (for metadata updates)
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- Step 3: Add helpful comments
-- ============================================================================

COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
COMMENT ON TABLE storage.objects IS 'Individual files stored in buckets';

-- ============================================================================
-- Step 4: Grant necessary permissions
-- ============================================================================

-- Ensure authenticated users can interact with storage
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
