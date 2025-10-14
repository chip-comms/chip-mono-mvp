import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  validateFile,
  MAX_FILE_SIZE,
  getFileExtension,
} from '@/lib/upload-constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload
 * Handles file upload to Supabase Storage and creates processing job
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file on server side
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = randomUUID();

    // Generate storage path
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = getFileExtension(file.name);
    const storagePath = `recordings/${user.id}/${year}/${month}/${jobId}.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to upload file: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    // Create processing job record
    const { error: dbError } = await supabase.from('processing_jobs').insert({
      id: jobId,
      user_id: user.id,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      status: 'pending',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('recordings').remove([storagePath]);

      return NextResponse.json(
        {
          success: false,
          message: `Failed to create processing job: ${dbError.message}`,
        },
        { status: 500 }
      );
    }

    // Generate signed URL for Python backend (2 hour expiry)
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from('recordings')
        .createSignedUrl(storagePath, 7200); // 2 hours in seconds

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      // This is not critical, so we don't fail the request
    }

    return NextResponse.json(
      {
        success: true,
        jobId,
        storagePath,
        signedUrl: signedUrlData?.signedUrl,
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in upload:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred during upload',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * Returns upload configuration and limits
 */
export async function GET() {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    supportedFormats: {
      video: ['mp4', 'mov', 'webm', 'avi', 'mkv'],
      audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'],
    },
  });
}
