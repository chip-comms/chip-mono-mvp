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

    // Path to the sample file
    const sampleFilePath = path.join(
      process.cwd(),
      '..',
      'recording-samples',
      filename
    );

    // Check if sample file exists
    try {
      await fs.access(sampleFilePath);
    } catch (_error) {
      return NextResponse.json(
        { success: false, error: `Sample file not found: ${filename}` },
        { status: 404 }
      );
    }

    // Read the sample file
    const fileStats = await fs.stat(sampleFilePath);
    const fileBuffer = await fs.readFile(sampleFilePath);

    // Generate unique ID for this processing
    const recordingId = uuidv4();

    // Save sample file to storage (copy it to our storage system)
    const buffer = new Uint8Array(fileBuffer);
    await storage.saveFile(recordingId, buffer, 'video/mp4');

    // Create recording record
    const recording: Recording = {
      id: recordingId,
      title: `Sample: ${filename}`,
      filename: filename,
      fileType: 'video/mp4',
      fileSizeBytes: fileStats.size,
      status: 'processing',
      createdAt: new Date().toISOString(),
    };

    await data.saveRecording(recording);

    // Start processing in the background (non-blocking)
    processRecordingAsync(recordingId).catch(console.error);

    return NextResponse.json({
      success: true,
      recordingId,
      message: 'Sample recording processing started',
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
async function processRecordingAsync(recordingId: string) {
  try {
    // Call the process endpoint
    const response = await fetch(`http://localhost:3000/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId }),
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
