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
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const { jobId } = await req.json();

    if (!jobId) {
      throw new Error('Missing required field: jobId');
    }

    console.log(`[process-meeting] Processing job: ${jobId}`);

    // Get job details
    const { data: job, error: fetchError } = await supabase
      .from('processing_jobs')
      .select('id, storage_path, user_id, original_filename, status')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Validate job can be processed
    if (job.status !== 'pending') {
      throw new Error(`Job cannot be processed. Current status: ${job.status}`);
    }

    console.log(
      `[process-meeting] Job found. Storage path: ${job.storage_path}`
    );

    // Generate signed URL for Python backend (2 hour expiry)
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from('recordings')
        .createSignedUrl(job.storage_path, 7200); // 2 hours in seconds

    if (signedUrlError || !signedUrlData) {
      console.error('[process-meeting] Signed URL error:', signedUrlError);
      throw new Error('Failed to generate download URL for processing');
    }

    // Fix URL for local development: replace kong:8000 with host.docker.internal:54321
    // so Python backend Docker container can access local Supabase
    let signedUrl = signedUrlData.signedUrl;
    if (signedUrl.includes('kong:8000')) {
      signedUrl = signedUrl.replace('http://kong:8000', 'http://host.docker.internal:54321');
      console.log(`[process-meeting] Converted signed URL for local development`);
    }

    console.log(`[process-meeting] Signed URL generated: ${signedUrl.substring(0, 80)}...`);

    // Update job status to processing
    const { error: updateError } = await supabase
      .from('processing_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[process-meeting] Status update error:', updateError);
      throw new Error('Failed to update job status');
    }

    console.log(`[process-meeting] Job status updated to processing`);

    // Get Python backend URL
    const pythonUrl = Deno.env.get('PYTHON_BACKEND_URL');
    if (!pythonUrl) {
      throw new Error('PYTHON_BACKEND_URL not configured');
    }

    console.log(`[process-meeting] Calling Python backend: ${pythonUrl}`);

    // Call Python backend for transcription and analysis
    const pythonApiKey = Deno.env.get('PYTHON_BACKEND_API_KEY');
    console.log(
      `[process-meeting] API key length: ${pythonApiKey?.length}, first 10 chars: ${pythonApiKey?.substring(0, 10)}`
    );
    const response = await fetch(`${pythonUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add API key if configured
        ...(pythonApiKey && {
          Authorization: `Bearer ${pythonApiKey}`,
        }),
      },
      body: JSON.stringify({
        job_id: jobId,
        user_id: job.user_id,
        file_url: signedUrl,
        original_filename: job.original_filename,
        storage_path: job.storage_path,
      }),
      // Don't wait for processing to complete (runs in background)
      signal: AbortSignal.timeout(10000), // 10 second timeout for initial response
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[process-meeting] Python backend error:', errorText);

      // Update job to failed
      await supabase
        .from('processing_jobs')
        .update({
          status: 'failed',
          processing_error: `Backend error: ${response.statusText}`,
        })
        .eq('id', jobId);

      throw new Error(`Python backend failed: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[process-meeting] Python backend responded:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: 'Processing started',
        pythonJobId: result.python_job_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[process-meeting] Edge Function error:', error);

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
