/**
 * Health Check API Route
 * Returns server status and configuration
 */

import { NextResponse } from 'next/server';
import { config } from '@/supabase-backend/lib/config';

export async function GET() {
  try {
    const hasOpenAIKey =
      !!config.openaiApiKey && config.openaiApiKey !== 'sk-your-key-here';

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      config: {
        maxFileSizeMB: config.maxFileSizeMB,
        supportedFormats: config.supportedFormats,
        companyValues: config.companyValues,
        hasOpenAIKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
