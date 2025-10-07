/**
 * Upload API Route
 *
 * Handles file uploads and saves them to storage.
 * This will be moved to frontend/app/api/upload/route.ts when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { LocalStorageAdapter } from '../lib/storage/local';
import { LocalDataAdapter } from '../lib/data/local';
import type { Recording } from '../lib/types';
import { config } from '../lib/config';

const storage = new LocalStorageAdapter();
const data = new LocalDataAdapter();

export async function POST(req: NextRequest) {
  try {
    // Initialize storage and data if needed
    await storage.initialize();
    await data.initialize();

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = (formData.get('title') as string) || file.name;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!config.supportedFormats.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Supported: ${config.supportedFormats.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSizeBytes = config.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Max size: ${config.maxFileSizeMB}MB`,
        },
        { status: 400 }
      );
    }

    // Generate unique ID
    const recordingId = uuidv4();

    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Save file to storage
    await storage.saveFile(recordingId, buffer, file.type);

    // Create recording record
    const recording: Recording = {
      id: recordingId,
      title,
      filename: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      status: 'processing',
      createdAt: new Date().toISOString(),
    };

    await data.saveRecording(recording);

    // Start processing in the background (non-blocking)
    // In production, this would be a queue or webhook
    processRecordingAsync(recordingId).catch(console.error);

    return NextResponse.json({
      success: true,
      recordingId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Process recording asynchronously (fire and forget)
 */
async function processRecordingAsync(recordingId: string) {
  try {
    // Call the process endpoint
    const response = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId }),
    });

    if (!response.ok) {
      throw new Error('Processing failed');
    }
  } catch (error) {
    console.error('Background processing error:', error);
    // Update recording status to failed
    await data.updateRecording(recordingId, {
      status: 'failed',
      processingError: 'Failed to start processing',
    });
  }
}
