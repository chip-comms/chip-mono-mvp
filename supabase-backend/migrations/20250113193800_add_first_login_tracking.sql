-- Add first login tracking to users table
-- Date: 2025-01-13
-- Purpose: Track whether user has completed their initial setup tutorial

-- ============================================================================
-- ADD FIRST LOGIN TRACKING COLUMN
-- ============================================================================

-- Add first login tracking column to users table
ALTER TABLE public.users 
ADD COLUMN first_login_completed boolean NOT NULL DEFAULT false;

-- ============================================================================
-- PERFORMANCE INDEX
-- ============================================================================

-- Index for setup queries - helps quickly find users who need setup
CREATE INDEX idx_users_first_login ON public.users(first_login_completed);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN public.users.first_login_completed IS 'Tracks whether user has completed initial setup tutorial after first login';