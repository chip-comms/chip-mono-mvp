# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meeting Intelligence Assistant - A multi-tenant SaaS platform that processes video/audio recordings to generate AI-powered communication insights and behavioral analysis.

**Core Technology Stack:**

- Frontend: Next.js 15.5 with React 19 (port 3000)
- Python Backend: FastAPI for video/audio processing (port 8000)
- Database: Supabase (PostgreSQL) with Row Level Security
- AI: Multi-provider adapter supporting OpenAI, Google Gemini, and Anthropic

## Commands

### Installation

```bash
# Install all dependencies (root, frontend, backend, and Python)
npm run install:all
```

### Development

```bash
# Start both frontend and Python backend concurrently
npm run dev:all

# Start services individually
npm run dev:frontend        # Next.js frontend only
npm run dev:python          # FastAPI backend only (requires venv activation)
```

### Code Quality

```bash
# Linting
npm run lint                # All workspaces
npm run lint:frontend       # Frontend only
npm run lint:backend        # Supabase backend only

# Formatting
npm run format              # Format all files with Prettier
npm run format:check        # Check formatting without modifying
npm run format:frontend     # Frontend only
npm run format:backend      # Backend only
```

### Building

```bash
npm run build:frontend      # Build Next.js app for production
```

### Database Operations

The `db-ops.sh` script manages all Supabase database operations:

```bash
./db-ops.sh pull            # Download current schema from remote
./db-ops.sh diff <name>     # Create migration from local changes
./db-ops.sh push            # Apply migrations to remote database
./db-ops.sh migration <name> # Create new empty migration file

# Local Supabase Development
./db-ops.sh start           # Start local Supabase (Studio at http://localhost:54323)
./db-ops.sh stop            # Stop local services
./db-ops.sh reset           # Reset local database
./db-ops.sh status          # Check service status

# Utilities
./db-ops.sh generate-types  # Generate TypeScript types from schema
./db-ops.sh connect         # Show connection information
```

**Important:** Docker Desktop must be running for `db-ops.sh pull` and local Supabase operations.

## Architecture

### Architecture Layers

This project separates concerns across three layers:

1. **Frontend (Next.js)** - UI and user interactions
   - Location: `frontend/`
   - Handles: File uploads to Supabase Storage, UI interactions
   - Communicates directly with Supabase (Storage and Database)

2. **Supabase Edge Functions** - Middleware layer
   - Location: `supabase/functions/`
   - Handles: Orchestrating processing workflows, generating signed URLs
   - Automatically triggered by database triggers (using pg_net extension)
   - Secured with Supabase anon key

3. **Python Backend (FastAPI)** - CPU/GPU-intensive processing
   - Location: `python-backend/`
   - Deployed to: Google Cloud Run (serverless containers)
   - Handles: Video/audio extraction, transcription (WhisperX), speaker diarization (pyannote.audio), AI analysis
   - Secured with API key authentication (only Edge Functions can call it)
   - Exposes REST API at Cloud Run URL

```
supabase/
├── functions/               # Supabase Edge Functions (Deno)
│   └── process-meeting/     # Orchestrates processing workflow
├── migrations/              # Database schema migrations
└── database.types.ts        # Generated TypeScript types from database
```

**Key Principle:**

- Frontend uploads files directly to Supabase Storage
- Database trigger automatically calls Edge Function when job is created
- Edge Function generates signed URL and calls Python backend
- Python backend handles transcription and AI analysis, saves results to database
- All communication secured with API keys and RLS policies

### Database Schema

The database follows a simple single-tenant architecture:

1. **Users** (`users` table)
   - Tied to Supabase Auth (`id` matches `auth.uid()`)
   - Stores user profile information (email, full_name, avatar_url, username)
   - `first_login_completed` tracks onboarding status
   - `username` column exists but is currently not used in UI (reserved for future use)
   - User records automatically created by database trigger on signup

2. **Processing Jobs** (`processing_jobs` table)
   - Tracks video/audio upload and processing status
   - Links to Supabase Storage via `storage_path` field: `recordings/{user_id}/{year}/{month}/{job_id}.mp4`
   - Status flow: `uploading` → `pending` → `processing` → `completed`/`failed`
   - Belongs to a user via `user_id` foreign key

3. **Meeting Analysis** (`meeting_analysis` table)
   - One-to-one relationship with `processing_jobs` (via `job_id`)
   - Stores transcript, summary, speaker stats, communication metrics, and behavioral insights
   - All data stored as JSONB for flexibility with AI-generated content
   - Belongs to a user via `user_id` foreign key

**Row Level Security (RLS):** All tables have RLS enabled. Users can only access their own data via policies that check `user_id` against `auth.uid()`.

### Data Flow

1. **Upload Flow:**
   - Frontend uploads file directly to Supabase Storage
   - Creates `processing_job` with `status: 'uploading'`
   - File saved to Supabase Storage at `recordings/{user_id}/{year}/{month}/{job_id}.mp4`
   - Status updated to `pending`
   - Database trigger automatically fires

2. **Automatic Processing Trigger:**
   - Database trigger (`on_processing_job_created`) detects new `pending` job
   - Uses `pg_net` extension to make HTTP POST to Edge Function
   - Edge Function receives job ID and fetches job details

3. **Processing Flow:**
   - **Step 1:** Edge Function generates signed URL (2-hour expiry) for the uploaded file
   - **Step 2:** Edge Function updates job status to `processing`
   - **Step 3:** Edge Function calls Python backend with:
     - Job ID, user ID, signed URL, filename
     - Authentication via `Authorization: Bearer <api_key>` header
   - **Step 4:** Python backend (Cloud Run) processes in background:
     - Downloads file from signed URL
     - Extracts audio and performs transcription (WhisperX)
     - Performs speaker diarization (pyannote.audio)
     - Generates AI analysis (summary, insights, metrics) using Gemini
     - Calculates speaker statistics
     - Saves all results to `meeting_analysis` table
     - Updates job status to `completed` or `failed`

4. **Analysis Components:**
   - Summary (AI-generated overview)
   - Transcript with speaker labels and timestamps
   - Speaker statistics (talk time, word count, percentage)
   - **13 Communication Metrics:** clarity, empathy, confidence, collaboration, leadership, listening, engagement, assertiveness, adaptability, influence, authenticity, emotional intelligence, decision-making, overall score
   - Company values alignment (configurable values with per-value scores and examples)
   - Behavioral insights (face detection, prosody analysis, gesture analysis - optional)

### Python Backend Deployment

The Python backend is deployed to Google Cloud Run with the following setup:

**Deployment Script:** `python-backend/deploy.sh`

- Builds Docker container using Cloud Build
- Pushes to Artifact Registry
- Deploys to Cloud Run with environment configuration
- Configures secrets from Google Secret Manager

**Secrets (Google Secret Manager):**

- `supabase-url` - Supabase project URL
- `supabase-service-role-key` - Supabase service role key (for database writes)
- `gemini-api-key` - Google Gemini API key for AI analysis
- `python-backend-api-key` - API key for authenticating Edge Function requests

**Security:**

- API key authentication via `APIKeyMiddleware` (python-backend/app/middleware/auth.py)
- Only Edge Functions have the API key to call Python backend
- Service is `--allow-unauthenticated` but protected by API key check
- Health endpoint (`/api/health`) excluded from authentication

**Resource Configuration:**

- Memory: 2Gi
- CPU: 2
- Timeout: 300s (5 minutes)
- Min instances: 0 (scales to zero)
- Max instances: 10

**Deployment Commands:**

```bash
cd python-backend
./deploy.sh  # Full deployment with interactive prompts

# Manual deployment (after build)
gcloud run deploy meeting-intelligence-backend \
  --image <image-url> \
  --region us-central1
```

## Frontend Structure

- **App Router:** Uses Next.js 15 App Router (`frontend/app/`)
- **Authentication:** Supabase Auth with middleware (`frontend/middleware.ts`)
- **UI Components:** Shared components in `frontend/components/`
- **Client Libraries:**
  - `frontend/lib/supabase.ts` - Browser Supabase client
  - `frontend/lib/supabase-server.ts` - Server Supabase client (SSR)
  - `frontend/lib/auth.ts` - Client-side auth utilities
  - `frontend/lib/auth-server.ts` - Server-side auth utilities

**Note:** The frontend communicates directly with Supabase (no Next.js API routes needed). All processing is handled by Edge Functions and Python backend.

### Authentication System

**Route Structure:**

- `/` - Public landing page
- `/platform/login` - Public login page
- `/platform/signup` - Public signup page
- `/platform/dashboard` - Protected dashboard (requires authentication)
- `/platform/(auth)/*` - Protected route group with automatic auth checks

**Authentication Flow:**

1. **Sign Up:** User creates account with email and password
   - Supabase Auth creates auth user
   - Database trigger (`handle_new_user()`) automatically creates user record in `users` table
   - Session established if email confirmation is disabled
   - Redirect to dashboard on success

2. **Sign In:** User logs in with email and password
   - Supabase Auth verifies credentials
   - Session stored in cookies
   - Redirect to dashboard on success

3. **Protected Routes:** Middleware protects all `/platform/*` routes except login/signup
   - Unauthenticated users redirected to `/platform/login`
   - Authenticated users on login/signup pages redirected to `/platform/dashboard`

**Database Trigger:**

- `handle_new_user()` function runs on `auth.users` INSERT
- Automatically creates corresponding record in `public.users` table
- Runs with `SECURITY DEFINER` privilege to bypass RLS

**Note:** Username functionality exists in database but is currently disabled in the UI. Can be re-enabled in future.

## Python Backend Structure

**Purpose:** Handles CPU/GPU-intensive video/audio processing that's better suited for Python than TypeScript. Deployed to Google Cloud Run.

- **Entry Point:** `python-backend/app/main.py`
- **API Routes:**
  - `GET /api/health` - Health check (no authentication required)
  - `POST /api/process` - Main processing endpoint (called by Edge Functions)
  - `GET /api/process/status/{job_id}` - Get job status
- **Key Dependencies:** (see `python-backend/requirements.txt`)
  - `whisperx>=3.1.0` - Advanced speech transcription with word-level timestamps
  - `pyannote.audio>=3.0.0` - Speaker diarization (who spoke when)
  - `faster-whisper>=0.9.0` - Optimized Whisper implementation
  - `ffmpeg-python>=0.2.0` - Video/audio processing
  - `opencv-python>=4.9.0` - Video analysis
  - `fastapi>=0.109.0` - REST API framework
  - `google-generativeai>=0.3.0` - Google Gemini API

**Processing Flow (Background Task):**

1. Edge Function calls `/api/process` with job details and signed URL
2. Python backend starts background task and returns immediately
3. Background task:
   - Downloads file from Supabase Storage (via signed URL)
   - Extracts audio and performs transcription (WhisperX)
   - Performs speaker diarization (pyannote.audio)
   - Generates AI analysis using Gemini (summary, topics, action items, effectiveness score)
   - Calculates speaker statistics (talk time, word count, percentages)
   - Saves results to `meeting_analysis` table
   - Updates job status to `completed` or `failed`
   - Cleans up temporary files

**Note:** The build process takes 8-10 minutes due to large ML dependencies (~2GB for PyTorch, WhisperX, etc.). Consider using Docker layer caching or pre-built base images for faster iteration.

## Environment Setup

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=development
```

### Python Backend (Local Development: `python-backend/.env`)

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
AI_PROVIDER=gemini
CORS_ORIGINS=http://localhost:3000
API_KEY=your_local_api_key  # Optional for local dev
```

### Python Backend (Cloud Run Deployment: `python-backend/.env.deploy`)

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
API_KEY=your_production_api_key
```

**Note:** Cloud Run deployment uses Google Secret Manager. Secrets are configured via `deploy.sh` script and injected as environment variables at runtime.

### Supabase Edge Functions

Edge Functions require the following secrets (configured via Supabase dashboard):

```bash
PYTHON_BACKEND_URL=https://your-cloud-run-url
PYTHON_BACKEND_API_KEY=your_production_api_key
```

## Key Conventions

### Type Definitions

- Use generated database types from `supabase/database.types.ts` (regenerate with `./db-ops.sh generate-types`)
- New database types must match the Postgres schema exactly

### Migration Workflow

1. Make schema changes locally or write SQL migration file
2. Create migration: `./db-ops.sh migration add_feature_name`
3. Write SQL in generated migration file: `supabase/migrations/TIMESTAMP_add_feature_name.sql`
4. Review migration carefully
5. Run `./db-ops.sh push` to apply to remote database
6. Run `./db-ops.sh generate-types` to update TypeScript types

**Important:**

- NEVER run manual SQL statements in Supabase SQL Editor - always use migrations
- Keep migration history in sync between local and remote
- Use `supabase migration repair` if history gets out of sync
- Test migrations locally with `./db-ops.sh reset` before pushing

### Data Access Patterns

- All data is scoped to individual users via `user_id`
- Use RLS policies to enforce user isolation - never bypass with service role key in frontend
- Current user ID is obtained via `auth.uid()` in RLS policies

### Code Style

- Use ESLint for TypeScript/JavaScript (configuration in `frontend/` and `supabase/`)
- Use Prettier for all formatting (shared configuration at root)
- Use type imports: `import type { Type } from './module'`
- Prefer async/await over promises
- Python: Follow PEP 8 style guide, use flake8 for linting

## CI/CD

GitHub Actions runs on PRs to `main` and `develop`:

- **Frontend:** Formatting check, linting, and build verification (`frontend-lint-pr.yml`)
- **Supabase:** Formatting check and linting (`supabase-backend-lint-pr.yml`)
- **Python Backend:** Linting with flake8 (`python-backend-lint-pr.yml`)

All checks must pass before merging. Run quality checks locally before pushing:

```bash
npm run lint && npm run format:check && npm run build:frontend
```

## Deployment

### Python Backend Deployment

The Python backend is deployed to Google Cloud Run:

1. **Prerequisites:**
   - Google Cloud account with billing enabled
   - gcloud CLI installed and authenticated
   - Docker Desktop running (for builds)
   - Create `.env.deploy` file from `.env.deploy.example`

2. **First-time Setup:**

   ```bash
   cd python-backend
   ./deploy.sh
   ```

   This will:
   - Enable required GCP APIs
   - Create Artifact Registry repository
   - Create secrets in Google Secret Manager
   - Build container (~8-10 minutes)
   - Deploy to Cloud Run

3. **Subsequent Deployments:**

   ```bash
   cd python-backend
   ./deploy.sh  # Full rebuild and deploy

   # Or just deploy existing image
   gcloud run deploy meeting-intelligence-backend \
     --image <image-url> \
     --region us-central1
   ```

4. **After Deployment:**
   - Copy the service URL
   - Add `PYTHON_BACKEND_URL` to Supabase Edge Function secrets
   - Add `PYTHON_BACKEND_API_KEY` to Supabase Edge Function secrets

### Supabase Edge Functions Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy process-meeting
```

### Frontend Deployment

Frontend deployment is typically handled by Vercel or similar platform. See frontend deployment documentation for details.
