/**
 * Intelligence API Route
 * Gets intelligence data for a specific recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocalDataAdapter } from '@/supabase-backend/lib/data/local';

const data = new LocalDataAdapter();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await data.initialize();
    const resolvedParams = await params;
    const intelligence = await data.getIntelligence(resolvedParams.id);

    if (!intelligence) {
      return NextResponse.json(
        { intelligence: null, error: 'Intelligence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(intelligence);
  } catch (error) {
    console.error('Failed to get intelligence:', error);
    return NextResponse.json(
      {
        intelligence: null,
        error:
          error instanceof Error ? error.message : 'Failed to get intelligence',
      },
      { status: 500 }
    );
  }
}
