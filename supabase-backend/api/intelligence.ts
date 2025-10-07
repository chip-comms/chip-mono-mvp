/**
 * Intelligence API Route
 *
 * Returns intelligence data for a specific recording.
 * This will be moved to frontend/app/api/intelligence/[id]/route.ts when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocalDataAdapter } from '../lib/data/local';
import type { IntelligenceResponse } from '../lib/types';

const data = new LocalDataAdapter();

/**
 * GET /api/intelligence/[id]
 *
 * In Next.js, you'll need to extract the ID from the route params:
 * export async function GET(req: NextRequest, { params }: { params: { id: string } })
 */
export async function GET(req: NextRequest, recordingId: string) {
  try {
    // Initialize data adapter if needed
    await data.initialize();

    // Get intelligence
    const intelligence = await data.getIntelligence(recordingId);

    if (!intelligence) {
      return NextResponse.json(
        {
          intelligence: null,
          error: 'Intelligence not found for this recording',
        },
        { status: 404 }
      );
    }

    const response: IntelligenceResponse = {
      intelligence,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Error fetching intelligence for ${recordingId}:`, error);
    return NextResponse.json(
      {
        intelligence: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch intelligence',
      },
      { status: 500 }
    );
  }
}
