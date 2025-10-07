/**
 * File Serving API Route
 * Serves uploaded recording files for playback
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocalStorageAdapter } from '@/supabase-backend/lib/storage/local';

const storage = new LocalStorageAdapter();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    await storage.initialize();
    const resolvedParams = await params;
    
    // Get file extension from filename to determine content type
    const ext = resolvedParams.filename.toLowerCase().split('.').pop() || '';
    const contentTypeMap: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    
    // Get file from storage (stored with ID, not original filename)
    const filePath = storage.getFilePath(resolvedParams.id, '.' + ext);
    
    if (!(await storage.fileExists(filePath))) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    const fileBuffer = await storage.getFile(filePath);
    
    // Convert Uint8Array to ArrayBuffer for NextResponse
    const ab = new ArrayBuffer(fileBuffer.byteLength);
    new Uint8Array(ab).set(fileBuffer);
    
    return new NextResponse(ab, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Failed to serve file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to serve file' },
      { status: 500 }
    );
  }
}