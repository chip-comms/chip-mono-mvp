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
   - API routes: `frontend/app/api/` (to be implemented)
   - Communicates with Python backend and Supabase

2. **Python Backend (FastAPI)** - CPU/GPU-intensive processing
   - Location: `python-backend/`
   - Handles: Video/audio extraction, transcription (WhisperX), speaker diarization (pyannote.audio)
   - Exposes REST API at `http://localhost:8000`

3. **Business Logic Layer** - AI analysis and data management
   - Location: `supabase-backend/lib/`
   - Portable TypeScript modules imported by frontend and Edge Functions
   - Handles: AI provider management, meeting analysis, metrics calculation

```
supabase-backend/lib/
├── ai/                      # AI provider adapters (OpenAI, Gemini, Anthropic)
│   ├── ai-adapter.ts        # Multi-provider adapter with auto-selection
│   ├── providers/           # Individual AI provider implementations
│   ├── analysis.ts          # Meeting analysis logic
│   └── metrics.ts           # Communication metrics calculation
├── data/
│   └── supabase.ts          # Supabase database adapter
├── storage/
│   └── supabase.ts          # Supabase Storage adapter
├── types.ts                 # Shared TypeScript types
└── config.ts                # Configuration management
```

**Key Principle:** The Python backend handles heavy lifting (transcription), while TypeScript handles AI analysis and business logic. All data and storage operations use Supabase directly.

### Database Schema

The database follows a simple single-tenant architecture:

1. **Users** (`users` table)
   - Tied to Supabase Auth (`id` matches `auth.uid()`)
   - Stores user profile information (email, full_name, avatar_url)
   - `first_login_completed` tracks onboarding status

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

1. **Upload Flow (to be implemented):**
   - Frontend → Next.js API route → Supabase Storage
   - Creates `processing_job` with `status: 'uploading'`
   - File saved to Supabase Storage at `recordings/{user_id}/{year}/{month}/{job_id}.mp4`
   - Status updated to `pending`

2. **Processing Flow (to be implemented):**
   - Frontend triggers processing → Python FastAPI backend
   - **Step 1:** Python backend extracts audio and performs transcription
     - Uses WhisperX for transcription with word-level timestamps
     - Uses pyannote.audio for speaker diarization
     - Returns transcript with speaker labels and timestamps
   - **Step 2:** Frontend/Backend invokes `supabase-backend/lib/ai/` for AI analysis
     - Generates summary, action items, key topics using AI provider
     - Calculates communication metrics (talk time, interruptions, response delays)
     - Analyzes company values alignment
     - Generates AI insights
   - **Step 3:** Results saved to `meeting_analysis` table

3. **Analysis Components:**
   - Summary (AI-generated overview)
   - Transcript with speaker labels and timestamps
   - Speaker statistics (talk time, word count, percentage)
   - **13 Communication Metrics:** clarity, empathy, confidence, collaboration, leadership, listening, engagement, assertiveness, adaptability, influence, authenticity, emotional intelligence, decision-making, overall score
   - Company values alignment (configurable values with per-value scores and examples)
   - Behavioral insights (face detection, prosody analysis, gesture analysis - optional)

### AI Provider Adapter Pattern

The `AIAdapter` class (`supabase-backend/lib/ai/ai-adapter.ts`) provides a unified interface for multiple AI providers:

- **Auto-Selection:** Automatically selects the first available provider based on API key configuration
- **Provider Priority:** Checks providers in order (Gemini, OpenAI, Anthropic)
- **Manual Override:** Can specify preferred provider via `config.aiProvider`
- **Graceful Fallback:** Falls back to next available provider if preferred provider fails

When adding new AI providers:
1. Create a new provider class in `supabase-backend/lib/ai/providers/` implementing the `AIProvider` interface
2. Add initialization logic to `AIAdapter.initializeProviders()`
3. Configure API key in environment variables

## Frontend Structure

- **App Router:** Uses Next.js 15 App Router (`frontend/app/`)
- **API Routes:** `frontend/app/api/` (currently empty - to be implemented)
- **Authentication:** Supabase Auth with middleware (`frontend/middleware.ts`)
- **UI Components:** Shared components in `frontend/components/`
- **Client Libraries:**
  - `frontend/lib/supabase.ts` - Supabase client initialization
  - `frontend/lib/auth.ts` - Authentication utilities

## Python Backend Structure

**Purpose:** Handles CPU/GPU-intensive video/audio processing that's better suited for Python than TypeScript.

- **Entry Point:** `python-backend/app/main.py`
- **API Routes:**
  - `GET /api/health` - Health check
  - `POST /api/video/*` - Video processing operations (frame extraction, etc.)
  - `POST /api/audio/transcribe` - Audio transcription with WhisperX
  - `GET /api/audio/languages` - List supported languages
  - `POST /api/*` - Analysis endpoints
- **Key Dependencies:** (see `python-backend/requirements.txt`)
  - `whisperx>=3.1.0` - Advanced speech transcription with word-level timestamps
  - `pyannote.audio>=3.0.0` - Speaker diarization (who spoke when)
  - `faster-whisper>=0.9.0` - Optimized Whisper implementation
  - `ffmpeg-python>=0.2.0` - Video/audio processing
  - `opencv-python>=4.9.0` - Video analysis
  - `fastapi>=0.109.0` - REST API framework

**Transcription Flow:**
1. Upload audio file to `/api/audio/transcribe`
2. WhisperX performs transcription with word timestamps
3. pyannote.audio performs speaker diarization
4. Returns JSON with segments, speakers, timestamps, and full transcript

## Environment Setup

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=development
```

### Python Backend (`python-backend/.env`)
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
# Optional: OPENAI_API_KEY=sk-your-key-here
AI_PROVIDER=gemini  # or 'openai', 'anthropic', 'auto'
PORT=8000
CORS_ORIGINS=http://localhost:3000
```

## Key Conventions

### Type Definitions
- All shared types are defined in `supabase-backend/lib/types.ts`
- Use generated database types from `supabase-backend/database.types.ts` (regenerate with `./db-ops.sh generate-types`)
- New database types must match the Postgres schema exactly

### Migration Workflow
1. Make schema changes locally or write SQL migration
2. Run `./db-ops.sh diff migration_name` to generate migration file
3. Review migration in `supabase-backend/migrations/`
4. Run `./db-ops.sh push` to apply to remote database
5. Run `./db-ops.sh generate-types` to update TypeScript types

### Data Access Patterns
- All data is scoped to individual users via `user_id`
- Use RLS policies to enforce user isolation - never bypass with service role key in frontend
- Current user ID is obtained via `auth.uid()` in RLS policies

### Code Style
- Use ESLint for TypeScript/JavaScript (configuration in `frontend/` and `supabase-backend/`)
- Use Prettier for all formatting (shared configuration at root)
- Use type imports: `import type { Type } from './module'`
- Prefer async/await over promises

## CI/CD

GitHub Actions runs on PRs to `main` and `develop`:
- **Frontend:** Formatting check, linting, and build verification (`frontend-lint-pr.yml`)
- **Supabase Backend:** Formatting check and linting (`supabase-backend-lint-pr.yml`)
- **Python Backend:** Linting with flake8 (`python-backend-lint-pr.yml`)

All checks must pass before merging. Run quality checks locally before pushing:
```bash
npm run lint && npm run format:check && npm run build:frontend
```
