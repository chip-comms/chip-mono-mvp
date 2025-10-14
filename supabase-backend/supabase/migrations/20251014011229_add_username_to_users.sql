-- Add username column to users table for authentication
-- Date: 2025-10-14

-- Add username column (unique, nullable initially for existing users)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS username text;

-- Add unique constraint on username
DO $$ BEGIN
  ALTER TABLE public.users
  ADD CONSTRAINT users_username_unique UNIQUE (username);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Add check constraint for username format (alphanumeric, hyphens, underscores, 3-30 chars)
DO $$ BEGIN
  ALTER TABLE public.users
  ADD CONSTRAINT users_username_valid
  CHECK (username ~* '^[a-zA-Z0-9_-]{3,30}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create index on username for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Add comment for documentation
COMMENT ON COLUMN public.users.username IS 'Unique username for user authentication (alphanumeric, hyphens, underscores, 3-30 characters)';
