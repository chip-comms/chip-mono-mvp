import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

console.log("🚀 Edge Function 'process-meeting' initialized");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📝 Processing meeting analysis request...');

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request data
    const { videoUrl, jobId } = await req.json();
    console.log(`📋 Processing job ${jobId} for video: ${videoUrl}`);

    if (!videoUrl || !jobId) {
      throw new Error('Missing required fields: videoUrl and jobId');
    }

    // Update job status to processing
    const { error: updateError } = await supabaseClient
      .from('processing_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    if (updateError) {
      console.error('❌ Failed to update job status:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('✅ Job status updated to processing');

    // Call Python backend
    const pythonBackendUrl =
      Deno.env.get('PYTHON_BACKEND_URL') ?? 'http://localhost:8000';
    console.log(
      `🐍 Calling Python backend at: ${pythonBackendUrl}/api/analyze-meeting`
    );

    const pythonResponse = await fetch(
      `${pythonBackendUrl}/api/analyze-meeting`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          jobId: jobId,
        }),
      }
    );

    console.log(`🔍 Python backend response status: ${pythonResponse.status}`);

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error('❌ Python backend error:', errorText);

      // Update job status to failed
      await supabaseClient
        .from('processing_jobs')
        .update({
          status: 'failed',
          processing_error: `Python backend error: ${pythonResponse.status} - ${errorText}`,
        })
        .eq('id', jobId);

      throw new Error(
        `Python backend error: ${pythonResponse.status} - ${errorText}`
      );
    }

    const pythonResult = await pythonResponse.json();
    console.log(
      '✅ Python backend processing started successfully:',
      pythonResult
    );

    return new Response(
      JSON.stringify({
        success: true,
        jobId: jobId,
        message: 'Processing started successfully',
        pythonBackendResponse: pythonResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Edge Function error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
