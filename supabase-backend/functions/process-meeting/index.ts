import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const { jobId } = await req.json();

    if (!jobId) {
      throw new Error('Missing required field: jobId');
    }

    console.log(`Processing job: ${jobId}`);

    // Get job details
    const { data: job, error: fetchError } = await supabase
      .from('processing_jobs')
      .select('storage_path, user_id')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Update job status to processing
    await supabase
      .from('processing_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Call Python backend for transcription and analysis
    const pythonUrl =
      Deno.env.get('PYTHON_BACKEND_URL') ?? 'http://localhost:8000';

    const response = await fetch(`${pythonUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        storagePath: job.storage_path,
        userId: job.user_id,
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      // Update job to failed
      await supabase
        .from('processing_jobs')
        .update({
          status: 'failed',
          processing_error: `Python backend error: ${error}`,
        })
        .eq('id', jobId);

      throw new Error(`Python backend failed: ${error}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Edge Function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
