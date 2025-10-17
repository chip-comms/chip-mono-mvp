-- Fix trigger function to use correct production URL
-- The previous version was trying to read request.headers which isn't available in trigger context
-- This caused "Couldn't resolve host name" errors

CREATE OR REPLACE FUNCTION public.trigger_process_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_id bigint;
  supabase_url text;
  anon_key text;
BEGIN
  -- Only trigger for newly inserted pending jobs
  IF NEW.status = 'pending' THEN
    -- Production Supabase configuration
    supabase_url := 'https://kfikvadshmptpwscgbyu.supabase.co';
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaWt2YWRzaG1wdHB3c2NnYnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NjUxODgsImV4cCI6MjA3NjA0MTE4OH0.5UDewJ3L-mGOyOvPW7fIbH1skcZEd03y2Zl99crSKN8';

    -- Make async HTTP POST request to Edge Function
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/process-meeting',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('jobId', NEW.id::text)
    ) INTO request_id;

    -- Log the request for debugging
    RAISE LOG 'Triggered process-meeting Edge Function at % for job % with request_id %', supabase_url, NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$;
