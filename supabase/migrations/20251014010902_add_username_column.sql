-- Add username column to users table for authentication
-- Date: 2025-10-13

-- Add username column (unique, nullable initially for existing users)
ALTER TABLE public.users
ADD COLUMN username text;

-- Add unique constraint on username
ALTER TABLE public.users
ADD CONSTRAINT users_username_unique UNIQUE (username);

-- Add check constraint for username format (alphanumeric, hyphens, underscores, 3-30 chars)
ALTER TABLE public.users
ADD CONSTRAINT users_username_valid
CHECK (username ~* '^[a-zA-Z0-9_-]{3,30}$');

-- Create index on username for faster lookups during login
CREATE INDEX idx_users_username ON public.users(username);

-- Add comment for documentation
COMMENT ON COLUMN public.users.username IS 'Unique username for user authentication (alphanumeric, hyphens, underscores, 3-30 characters)';
