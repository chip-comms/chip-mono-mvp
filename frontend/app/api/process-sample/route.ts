/**
 * Process Sample Recording API Route
 * Processes the sample recording from the recording-samples directory
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { LocalStorageAdapter } from '@/supabase-backend/lib/storage/local';
import { LocalDataAdapter } from '@/supabase-backend/lib/data/local';
import type { Recording } from '@/supabase-backend/lib/types';

const storage = new LocalStorageAdapter();
const data = new LocalDataAdapter();

export async function POST(req: NextRequest) {
  try {
    // Initialize storage and data if needed
    await storage.initialize();
    await data.initialize();

    const body = await req.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Sample filename is required' },
        { status: 400 }
      );
    }

    // Use a consistent sample ID to avoid duplicates
    const SAMPLE_RECORDING_ID = 'sample-beau-lauren-2024-06-20';
    const sampleStoredPath = storage.getFilePath(SAMPLE_RECORDING_ID, '.mp4');

    // Check if sample is already in storage
    const sampleExists = await storage.fileExists(sampleStoredPath);

    if (!sampleExists) {
      console.log('Sample file not in storage, copying from source...');

      // Path to the sample file
      const sampleFilePath = path.join(
        process.cwd(),
        '..',
        'recording-samples',
        filename
      );

      // Check if source sample file exists
      try {
        await fs.access(sampleFilePath);
      } catch (_error) {
        return NextResponse.json(
          { success: false, error: `Sample file not found: ${filename}` },
          { status: 404 }
        );
      }

      // Read and store the sample file once
      const fileBuffer = await fs.readFile(sampleFilePath);
      const buffer = new Uint8Array(fileBuffer);
      await storage.saveFile(SAMPLE_RECORDING_ID, buffer, 'video/mp4');
      console.log('✅ Sample file stored for reuse');
    } else {
      console.log('♻️ Reusing existing sample file from storage');
    }

    // Get file stats for the recording
    const sampleFilePath = path.join(
      process.cwd(),
      '..',
      'recording-samples',
      filename
    );
    const fileStats = await fs.stat(sampleFilePath);

    // Generate unique ID for this processing session (not for the file)
    const recordingId = uuidv4();

    // Create recording record that points to the shared sample file
    const recording: Recording = {
      id: recordingId,
      title: `Sample: ${filename}`,
      filename: filename,
      fileType: 'video/mp4',
      fileSizeBytes: fileStats.size,
      status: 'processing',
      createdAt: new Date().toISOString(),
      // Store reference to the shared sample file
      sampleFileId: SAMPLE_RECORDING_ID,
    };

    await data.saveRecording(recording);

    // Start processing in the background (non-blocking)
    processRecordingAsync(recordingId, SAMPLE_RECORDING_ID).catch(
      console.error
    );

    return NextResponse.json({
      success: true,
      recordingId,
      message: 'Sample recording processing started (reusing stored file)',
    });
  } catch (error) {
    console.error('Sample processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Sample processing failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Process recording asynchronously (fire and forget)
 */
async function processRecordingAsync(
  recordingId: string,
  sampleFileId?: string
) {
  try {
    // Get the current origin/port from the request
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    // Call the process endpoint
    const response = await fetch(`${baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, sampleFileId }),
    });

    if (!response.ok) {
      throw new Error('Processing failed');
    }

    console.log(`[${recordingId}] Sample processing started successfully`);
  } catch (error) {
    console.error('Background sample processing error:', error);
    // Update recording status to failed
    await data.updateRecording(recordingId, {
      status: 'failed',
      processingError: 'Failed to start sample processing',
    });
  }
}
