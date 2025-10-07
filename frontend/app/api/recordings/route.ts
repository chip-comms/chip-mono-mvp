/**
 * Recordings API Route
 * Gets list of all recordings
 */

import { NextResponse } from 'next/server';
import { LocalDataAdapter } from '@/supabase-backend/lib/data/local';

const data = new LocalDataAdapter();

export async function GET() {
  try {
    await data.initialize();
    const recordings = await data.getRecordings();

    return NextResponse.json({
      recordings,
    });
  } catch (error) {
    console.error('Failed to get recordings:', error);
    return NextResponse.json(
      {
        recordings: [],
        error:
          error instanceof Error ? error.message : 'Failed to get recordings',
      },
      { status: 500 }
    );
  }
}
