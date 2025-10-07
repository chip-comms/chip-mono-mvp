/**
 * Recordings List API Route
 * 
 * Returns list of all recordings with their status.
 * This will be moved to frontend/app/api/recordings/route.ts when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocalDataAdapter } from '../lib/data/local';
import type { RecordingsResponse } from '../lib/types';

const data = new LocalDataAdapter();

export async function GET(req: NextRequest) {
  try {
    // Initialize data adapter if needed
    await data.initialize();

    // Get all recordings
    const recordings = await data.getRecordings();

    // Sort by creation date (newest first)
    recordings.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const response: RecordingsResponse = {
      recordings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      {
        recordings: [],
        error: error instanceof Error ? error.message : 'Failed to fetch recordings',
      },
      { status: 500 }
    );
  }
}

