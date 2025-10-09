-- Initial schema migration
-- Generated from existing Supabase database: kfikvadshmptpwscgbyu
-- Date: 2025-10-09

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create processing_jobs table
CREATE TABLE public.processing_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    video_url text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    processing_error text,
    python_job_id text,
    CONSTRAINT processing_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT processing_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);

-- Create meeting_analysis table
CREATE TABLE public.meeting_analysis (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    job_id uuid,
    transcript jsonb,
    summary text,
    action_items jsonb,
    key_topics jsonb,
    sentiment jsonb,
    speaker_stats jsonb,
    communication_metrics jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT meeting_analysis_pkey PRIMARY KEY (id),
    CONSTRAINT meeting_analysis_job_id_fkey FOREIGN KEY (job_id) REFERENCES processing_jobs(id) ON DELETE CASCADE
);

-- Add comments for documentation
COMMENT ON TABLE public.processing_jobs IS 'Tracks video processing jobs and their status';
COMMENT ON TABLE public.meeting_analysis IS 'Stores AI-generated analysis results from processed meetings';

COMMENT ON COLUMN public.processing_jobs.id IS 'Unique identifier for the processing job';
COMMENT ON COLUMN public.processing_jobs.video_url IS 'URL or path to the video file being processed';
COMMENT ON COLUMN public.processing_jobs.status IS 'Current status of the processing job';
COMMENT ON COLUMN public.processing_jobs.created_at IS 'Timestamp when the job was created';
COMMENT ON COLUMN public.processing_jobs.updated_at IS 'Timestamp when the job was last updated';
COMMENT ON COLUMN public.processing_jobs.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN public.processing_jobs.python_job_id IS 'Reference to the Python backend job ID';

COMMENT ON COLUMN public.meeting_analysis.id IS 'Unique identifier for the analysis record';
COMMENT ON COLUMN public.meeting_analysis.job_id IS 'Foreign key reference to the processing job';
COMMENT ON COLUMN public.meeting_analysis.transcript IS 'JSON object containing the full transcript with segments and speakers';
COMMENT ON COLUMN public.meeting_analysis.summary IS 'AI-generated summary of the meeting';
COMMENT ON COLUMN public.meeting_analysis.action_items IS 'JSON array of action items extracted from the meeting';
COMMENT ON COLUMN public.meeting_analysis.key_topics IS 'JSON array of key topics discussed in the meeting';
COMMENT ON COLUMN public.meeting_analysis.sentiment IS 'JSON object containing sentiment analysis results';
COMMENT ON COLUMN public.meeting_analysis.speaker_stats IS 'JSON object containing statistics for each speaker';
COMMENT ON COLUMN public.meeting_analysis.communication_metrics IS 'JSON object containing communication metrics and insights';
COMMENT ON COLUMN public.meeting_analysis.created_at IS 'Timestamp when the analysis was created';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON public.processing_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_job_id ON public.meeting_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_created_at ON public.meeting_analysis(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on processing_jobs
CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON public.processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();