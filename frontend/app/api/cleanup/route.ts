/**
 * Cleanup API Route
 * Removes old failed recordings and stuck processing entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocalDataAdapter } from '@/supabase-backend/lib/data/local';

const data = new LocalDataAdapter();

export async function POST(req: NextRequest) {
  try {
    await data.initialize();

    // Get all recordings
    const recordings = await data.getRecordings();

    let deletedCount = 0;
    const cutoffTime = Date.now() - 30 * 60 * 1000; // 30 minutes ago

    for (const recording of recordings) {
      const recordingTime = new Date(recording.createdAt).getTime();

      // Delete if:
      // 1. Failed status, OR
      // 2. Processing status but older than 30 minutes (stuck)
      if (
        recording.status === 'failed' ||
        (recording.status === 'processing' && recordingTime < cutoffTime)
      ) {
        await data.deleteRecording(recording.id);
        // Also cleanup any associated intelligence
        try {
          await data.deleteIntelligence(recording.id);
        } catch {
          // Ignore if intelligence doesn't exist
        }
        deletedCount++;
        console.log(
          `Cleaned up recording: ${recording.id} (${recording.status})`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} recordings`,
      deletedCount,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
      },
      { status: 500 }
    );
  }
}
