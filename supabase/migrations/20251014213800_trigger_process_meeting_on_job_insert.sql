-- Enable pg_net extension for making HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to trigger the process-meeting Edge Function
CREATE OR REPLACE FUNCTION trigger_process_meeting()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  anon_key text;
  request_id bigint;
BEGIN
  -- Only trigger for newly inserted pending jobs
  IF NEW.status = 'pending' THEN
    -- Get Supabase URL and anon key from vault or environment
    -- These values are automatically available in Supabase
    supabase_url := current_setting('app.settings.supabase_url', true);
    anon_key := current_setting('app.settings.anon_key', true);

    -- If settings not available, use hardcoded project URL
    -- (anon key will be passed via service role in production)
    IF supabase_url IS NULL THEN
      supabase_url := 'https://kfikvadshmptpwscgbyu.supabase.co';
    END IF;

    -- Make async HTTP POST request to Edge Function
    -- Using service_role context means the function has full access
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/process-meeting',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          current_setting('request.jwt.claims', true)::json->>'role',
          anon_key
        )
      ),
      body := jsonb_build_object('jobId', NEW.id::text)
    ) INTO request_id;

    -- Log the request for debugging
    RAISE LOG 'Triggered process-meeting Edge Function for job %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger that fires after insert on processing_jobs
DROP TRIGGER IF EXISTS on_processing_job_created ON processing_jobs;

CREATE TRIGGER on_processing_job_created
  AFTER INSERT ON processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_meeting();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_process_meeting() IS
  'Automatically triggers the process-meeting Edge Function when a new processing job is created with status=pending';
