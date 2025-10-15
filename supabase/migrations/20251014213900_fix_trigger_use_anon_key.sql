-- Update trigger function to use anon key directly
CREATE OR REPLACE FUNCTION trigger_process_meeting()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Only trigger for newly inserted pending jobs
  IF NEW.status = 'pending' THEN
    -- Make async HTTP POST request to Edge Function
    SELECT net.http_post(
      url := 'https://kfikvadshmptpwscgbyu.supabase.co/functions/v1/process-meeting',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaWt2YWRzaG1wdHB3c2NnYnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NjUxODgsImV4cCI6MjA3NjA0MTE4OH0.5UDewJ3L-mGOyOvPW7fIbH1skcZEd03y2Zl99crSKN8'
      ),
      body := jsonb_build_object('jobId', NEW.id::text)
    ) INTO request_id;

    -- Log the request for debugging
    RAISE LOG 'Triggered process-meeting Edge Function for job % with request_id %', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Update comment
COMMENT ON FUNCTION trigger_process_meeting() IS
  'Automatically triggers the process-meeting Edge Function when a new processing job is created with status=pending. Uses anon key for authentication.';
