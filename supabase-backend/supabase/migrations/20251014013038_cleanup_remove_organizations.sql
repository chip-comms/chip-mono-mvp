-- Remove organization/multi-tenant concept
-- Simplify to single-tenant application
-- Date: 2025-10-13

-- ============================================================================
-- Step 1: Remove organization_id from tables
-- ============================================================================

-- Drop ALL RLS policies first (they may reference organization_id)
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view users in same organization" ON public.users;
DROP POLICY IF EXISTS "Users can access jobs in their organization" ON public.processing_jobs;
DROP POLICY IF EXISTS "Users can access analysis in their organization" ON public.meeting_analysis;
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON public.organizations;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Drop indexes that reference organization_id
DROP INDEX IF EXISTS idx_users_organization_id;
DROP INDEX IF EXISTS idx_users_org_role;
DROP INDEX IF EXISTS idx_processing_jobs_user_org;
DROP INDEX IF EXISTS idx_processing_jobs_org_status;
DROP INDEX IF EXISTS idx_meeting_analysis_org_created;

-- Drop storage quota trigger and function
DROP TRIGGER IF EXISTS check_storage_quota_trigger ON public.processing_jobs;
DROP FUNCTION IF EXISTS check_storage_quota();

-- Drop foreign key constraints
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_organization_id_fkey;
ALTER TABLE public.processing_jobs DROP CONSTRAINT IF EXISTS processing_jobs_organization_id_fkey;
ALTER TABLE public.meeting_analysis DROP CONSTRAINT IF EXISTS meeting_analysis_organization_id_fkey;

-- Remove organization_id columns
ALTER TABLE public.users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.processing_jobs DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.meeting_analysis DROP COLUMN IF EXISTS organization_id;

-- Drop organizations table
DROP TABLE IF EXISTS public.organizations CASCADE;

-- ============================================================================
-- Step 2: Simplify users table
-- ============================================================================

-- Remove role column (no longer need RBAC)
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- Drop the user_role enum
DROP TYPE IF EXISTS user_role;

-- ============================================================================
-- Step 3: Update RLS policies for single-tenant
-- ============================================================================

-- Users: Can view all users (or just themselves if you want more restriction)
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (id = auth.uid());

-- Processing Jobs: Users can only access their own jobs
CREATE POLICY "Users can view their own jobs" ON public.processing_jobs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own jobs" ON public.processing_jobs
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own jobs" ON public.processing_jobs
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own jobs" ON public.processing_jobs
    FOR DELETE USING (user_id = auth.uid());

-- Meeting Analysis: Users can only access their own analysis
CREATE POLICY "Users can view their own analysis" ON public.meeting_analysis
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own analysis" ON public.meeting_analysis
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own analysis" ON public.meeting_analysis
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- Step 4: Update indexes for single-tenant queries
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Processing Jobs (already have some, add what's missing)
-- idx_processing_jobs_status already exists
-- idx_processing_jobs_created_at already exists
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON public.processing_jobs(user_id);

-- Meeting Analysis (already have some, add what's missing)
-- idx_meeting_analysis_job_id already exists
CREATE INDEX IF NOT EXISTS idx_meeting_analysis_user_id ON public.meeting_analysis(user_id);

-- ============================================================================
-- Step 5: Update comments
-- ============================================================================

COMMENT ON TABLE public.users IS 'Application users tied to Supabase Auth';
COMMENT ON TABLE public.processing_jobs IS 'Video/audio processing jobs';
COMMENT ON TABLE public.meeting_analysis IS 'AI-generated meeting analysis and insights';

COMMENT ON COLUMN public.processing_jobs.storage_path IS 'Supabase Storage path: recordings/{user_id}/{year}/{month}/{job_id}.mp4';
