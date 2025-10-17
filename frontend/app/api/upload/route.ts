import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { MAX_FILE_SIZE } from '@/lib/upload-constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload
 * Creates processing job record after client-side upload to Supabase Storage
 * NOTE: File upload now happens directly from client to Supabase Storage
 * to bypass Vercel's 4.5MB body size limit
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message,
    });

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse JSON body (sent from client after file upload)
    const body = await request.json();
    const { jobId, storagePath, originalFilename, fileSizeMB } = body;

    if (!jobId || !storagePath || !originalFilename || !fileSizeMB) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Creating processing job:', {
      jobId,
      storagePath,
      originalFilename,
      fileSizeMB,
    });

    // Create processing job record
    const { error: dbError } = await supabase.from('processing_jobs').insert({
      id: jobId,
      user_id: user.id,
      original_filename: originalFilename,
      file_size_mb: fileSizeMB,
      storage_path: storagePath,
      status: 'pending',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to create processing job: ${dbError.message}`,
        },
        { status: 500 }
      );
    }

    console.log('Processing job created successfully');

    return NextResponse.json(
      {
        success: true,
        jobId,
        storagePath,
        message: 'Processing job created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in upload:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
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
