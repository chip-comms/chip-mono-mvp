-- Multi-tenant database schema migration
-- Transforms single-tenant MVP to enterprise-ready multi-tenant SaaS platform
-- Date: 2025-10-09

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Define user roles enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Define job status enum (includes 'uploading' from current types)
CREATE TYPE job_status AS ENUM ('uploading', 'pending', 'processing', 'completed', 'failed');

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE public.organizations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    settings jsonb,
    storage_quota_mb integer DEFAULT 10000,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organizations_pkey PRIMARY KEY (id),
    CONSTRAINT organizations_slug_valid CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT organizations_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100)
);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE public.users (
    id uuid NOT NULL, -- Matches Supabase Auth user ID
    email text NOT NULL,
    full_name text,
    avatar_url text,
    organization_id uuid NOT NULL,
    role user_role NOT NULL DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- ENHANCED PROCESSING JOBS TABLE
-- ============================================================================

-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS public.processing_jobs CASCADE;

CREATE TABLE public.processing_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    storage_path text, -- Supabase Storage path: 'recordings/{org_slug}/{year}/{month}/{job_id}.mp4'
    original_filename text,
    status job_status NOT NULL DEFAULT 'pending',
    processing_error text,
    python_job_id text,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    file_size_mb numeric(10,2),
    duration_seconds integer,
    delete_after timestamp with time zone, -- For automated cleanup
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT processing_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT processing_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT processing_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT processing_jobs_file_size_positive CHECK (file_size_mb > 0),
    CONSTRAINT processing_jobs_duration_positive CHECK (duration_seconds > 0)
);

-- ============================================================================
-- ENHANCED MEETING ANALYSIS TABLE
-- ============================================================================

-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS public.meeting_analysis CASCADE;

CREATE TABLE public.meeting_analysis (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL, -- One-to-one relationship
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    summary text,
    transcript jsonb, -- Full transcript with segments and speakers
    speaker_stats jsonb, -- Individual speaker statistics
    communication_metrics jsonb, -- 13 metrics: clarity, empathy, confidence, collaboration, etc.
    behavioral_insights jsonb, -- Face detection, eye tracking, prosody analysis
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT meeting_analysis_pkey PRIMARY KEY (id),
    CONSTRAINT meeting_analysis_job_id_fkey FOREIGN KEY (job_id) REFERENCES processing_jobs(id) ON DELETE CASCADE,
    CONSTRAINT meeting_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT meeting_analysis_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT meeting_analysis_job_id_unique UNIQUE (job_id) -- Enforce one-to-one
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- Users
CREATE INDEX idx_users_organization_id ON public.users(organization_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_org_role ON public.users(organization_id, role);

-- Processing Jobs
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON public.processing_jobs(created_at);
CREATE INDEX idx_processing_jobs_user_org ON public.processing_jobs(user_id, organization_id);
CREATE INDEX idx_processing_jobs_org_status ON public.processing_jobs(organization_id, status);
CREATE INDEX idx_processing_jobs_delete_after ON public.processing_jobs(delete_after) WHERE delete_after IS NOT NULL;

-- Meeting Analysis
CREATE INDEX idx_meeting_analysis_job_id ON public.meeting_analysis(job_id);
CREATE INDEX idx_meeting_analysis_user_created ON public.meeting_analysis(user_id, created_at); -- Longitudinal queries
CREATE INDEX idx_meeting_analysis_org_created ON public.meeting_analysis(organization_id, created_at); -- Org-wide analytics

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON public.processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage quota validation function
CREATE OR REPLACE FUNCTION check_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
    current_usage_mb numeric;
    quota_mb integer;
BEGIN
    -- Calculate current storage usage for organization
    SELECT COALESCE(SUM(file_size_mb), 0)
    INTO current_usage_mb
    FROM public.processing_jobs pj
    WHERE pj.organization_id = NEW.organization_id
    AND pj.status IN ('processing', 'completed');
    
    SELECT storage_quota_mb
    INTO quota_mb
    FROM public.organizations
    WHERE id = NEW.organization_id;
    
    IF current_usage_mb + COALESCE(NEW.file_size_mb, 0) > quota_mb THEN
        RAISE EXCEPTION 'Storage quota exceeded. Current usage: % MB, Quota: % MB', current_usage_mb, quota_mb;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER check_storage_quota_trigger
    BEFORE INSERT OR UPDATE ON public.processing_jobs
    FOR EACH ROW EXECUTE FUNCTION check_storage_quota();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_analysis ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own org
CREATE POLICY "Users can view their own organization" ON public.organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Users: Can view users in same organization
CREATE POLICY "Users can view users in same organization" ON public.users
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Processing Jobs: Users can only access jobs in their organization
CREATE POLICY "Users can access jobs in their organization" ON public.processing_jobs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Meeting Analysis: Users can only access analysis in their organization
CREATE POLICY "Users can access analysis in their organization" ON public.meeting_analysis
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations with storage quotas and settings';
COMMENT ON TABLE public.users IS 'Users with role-based access control within organizations';
COMMENT ON TABLE public.processing_jobs IS 'Enhanced video processing jobs with multi-tenant context';
COMMENT ON TABLE public.meeting_analysis IS 'AI-generated analysis with advanced behavioral insights';

COMMENT ON COLUMN public.organizations.slug IS 'URL-friendly organization identifier';
COMMENT ON COLUMN public.organizations.storage_quota_mb IS 'Storage quota in MB for this organization';
COMMENT ON COLUMN public.users.role IS 'User role within the organization (owner, admin, member, viewer)';
COMMENT ON COLUMN public.processing_jobs.storage_path IS 'Supabase Storage path for the video file';
COMMENT ON COLUMN public.processing_jobs.delete_after IS 'Timestamp when this job should be automatically deleted';
COMMENT ON COLUMN public.meeting_analysis.communication_metrics IS '13 communication metrics including company values alignment';
COMMENT ON COLUMN public.meeting_analysis.behavioral_insights IS 'Face detection, eye tracking, prosody analysis results';