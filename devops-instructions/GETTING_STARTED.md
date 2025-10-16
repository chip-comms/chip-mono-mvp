# Getting Started - Local Development Setup

Welcome to the Meeting Intelligence Assistant development environment! This guide will walk you through setting up all three components of the application on your local machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Repository Structure](#repository-structure)
3. [Quick Start](#quick-start)
4. [Detailed Setup Instructions](#detailed-setup-instructions)
5. [Getting API Keys](#getting-api-keys)
6. [Testing Your Setup](#testing-your-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (required) - [Download here](https://www.docker.com/products/docker-desktop/)
  - Must be running before starting development
  - Used for Python backend and Supabase services

- **Node.js 18+** (required) - [Download here](https://nodejs.org/)
  - Check version: `node --version`
  - Used for frontend and build tools

- **Supabase CLI** (required) - Install via:

  ```bash
  npm install -g supabase
  ```

  - Check installation: `supabase --version`

- **Git** (required) - [Download here](https://git-scm.com/)

Beau's recommendations

- **Claude Code** with the following mcp's
  - **Supabase MCP**
  - **Linear MCP**

## Repository Structure

This is a monorepo with three main components:

```
chip-mono-mvp/
├── frontend/              # Next.js 15 application (port 3000)
├── supabase/             # Database, Edge Functions, migrations
│   ├── functions/        # Edge Functions (Deno)
│   └── migrations/       # Database schema
└── python-backend/       # FastAPI + ML processing (port 8000)
    ├── Dockerfile        # Production and local dev
    └── app/             # Python application code
```

**Data Flow:**

1. Frontend uploads files to Supabase Storage
2. Database trigger calls Edge Function
3. Edge Function calls Python Backend (local or production)
4. Python Backend processes video/audio and saves results in Supabase

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd chip-mono-mvp

# 2. Install all dependencies
npm run install:all

# 3. Configure environment files
# Copy examples and fill in your API keys
cp frontend/.env.local.example frontend/.env.local
cp python-backend/.env.local.example python-backend/.env.local
cp supabase/functions/.env.example supabase/functions/.env

# Edit the files with your keys (see "Getting API Keys" section)
# - python-backend/.env.local: Add Gemini + HuggingFace keys
# - frontend/.env.local: Will update after Supabase starts

# 4. Start all services (automated!)
./devops-instructions/start-all.sh

# This single script will:
# - Start Supabase (local database + services)
# - Start Python Backend (Docker)
# - Start Frontend (new terminal window)

# 5. Access the applications
# - Frontend: http://localhost:3000
# - Python Backend: http://localhost:8000
# - Supabase Studio: http://localhost:54323

# 6. Stop all services when done
./devops-instructions/stop-all.sh
```

**Alternative: Manual Start (for more control)**

```bash
# Start each service individually:
./db-ops.sh start                    # Terminal 1: Supabase
cd python-backend && ./start-local.sh # Terminal 2: Python
cd frontend && npm run dev            # Terminal 3: Frontend
```

## Detailed Setup Instructions

### 1. Frontend Setup

The frontend is a Next.js application that handles the UI and file uploads.

```bash
cd frontend

# Create environment file
cp .env.local.example .env.local

# Edit .env.local and set the environment to local
# NEXT_PUBLIC_SUPABASE_ENV=local
#
# Local Supabase credentials (default values work out of the box):
# NEXT_PUBLIC_SUPABASE_URL_LOCAL=http://localhost:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL=<get from Supabase Studio after starting>

# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend will be available at:** http://localhost:3000

**Environment Variables:**

- `NEXT_PUBLIC_SUPABASE_ENV` - Set to `local` for local development, `production` for production
- `NEXT_PUBLIC_SUPABASE_URL_LOCAL` - Local Supabase API URL (http://localhost:54321)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL` - Local anonymous/public API key from Supabase Studio

### 2. Supabase Setup

Supabase provides the database, authentication, storage, and edge functions.

```bash
# Make sure Docker Desktop is running!

# Start local Supabase services (runs in Docker)
./db-ops.sh start

# This will start:
# - PostgreSQL database (port 54322)
# - PostgREST API (port 54321)
# - Supabase Studio (port 54323)
# - Storage service
# - Auth service
# - Realtime service
```

**Access Supabase Studio:** http://localhost:54323

**Get your local API keys:**

1. Open Supabase Studio (http://localhost:54323)
2. Go to Settings → API
3. Copy the `anon` key and `service_role` key
4. Use the `anon` key in your frontend `.env.local`

**Database Operations:**

```bash
# View service status
./db-ops.sh status

# Stop services
./db-ops.sh stop

# Reset database (caution: deletes all data)
./db-ops.sh reset

# Create new migration
./db-ops.sh migration add_feature_name

# Push migrations to remote
./db-ops.sh push
```

**Edge Functions Setup:**

Create environment file for edge functions:

```bash
cd supabase

# Create .env.local file
cat > .env.local << 'EOF'
# Local Python Backend URL
PYTHON_BACKEND_URL=http://host.docker.internal:8000
PYTHON_BACKEND_API_KEY=local-dev-key-not-needed
EOF

cd ..
```

**Start Edge Functions locally:**

```bash
cd supabase
supabase functions serve --env-file .env.local
cd ..
```

**Important:** Edge Functions must be running for file processing to work. The database trigger calls the `process-meeting` Edge Function, which then calls the Python backend

### 3. Python Backend Setup (Docker)

The Python backend handles video/audio processing with ML models. It runs in Docker to ensure consistent environments.

```bash
cd python-backend

# Create environment file
cp .env.local.example .env.local

# Edit .env.local with your API keys (see "Getting API Keys" section below)
```

**Edit `python-backend/.env.local`:**

```bash
# Supabase Configuration (use local Supabase)
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_SECRET_KEY=<service_role_key_from_supabase_studio>

# AI Provider API Key (get your own free key)
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=8080

# Optional: API key for edge functions (not needed for local dev)
API_KEY=local-dev-key
```

**Start the Python backend:**

```bash
./start-local.sh
```

This will:

1. Build a Docker image with lightweight dependencies (~20 seconds first time)
2. Start the container with hot-reloading enabled
3. Mount your source code for live updates

**Note:** For local development, the backend uses mock transcription to avoid heavy ML dependencies. Real ML processing (WhisperX, speaker diarization) is tracked in ticket CHI-22 and will be re-enabled when needed

**Python Backend will be available at:** http://localhost:8000

**Check health:**

```bash
curl http://localhost:8000/api/health
```

**View logs:**

```bash
cd python-backend
docker-compose logs -f
```

**Stop the backend:**

```bash
cd python-backend
docker-compose down
```

**Rebuild after dependency changes:**

```bash
cd python-backend
docker-compose build --no-cache
docker-compose up -d
```

## Getting API Keys

### Gemini API Key (Required for AI Analysis)

1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into `python-backend/.env.local`

**Free Tier:** 15 requests per minute, more than enough for development

### HuggingFace Token (Optional - Not needed for local dev)

**Note:** For local development, we use mock transcription, so HuggingFace token is not required. This will be needed when implementing real ML pipeline (ticket CHI-22).

<details>
<summary>Click to see instructions for when you need it</summary>

1. Visit: https://huggingface.co/settings/tokens
2. Sign up or log in
3. Click "New token" (read access is sufficient)
4. Copy the token
5. Accept the terms for pyannote models:
   - Visit: https://huggingface.co/pyannote/speaker-diarization-3.1
   - Click "Agree and access repository"
6. Paste token into `python-backend/.env.local`

**Free Tier:** Unlimited usage for development

</details>

### Supabase Credentials (Shared Dev Instance)

**For local development:**

- URL: `http://localhost:54321` (from local Supabase)
- Anon Key: Get from http://localhost:54323 (Studio) → Settings → API
- Service Role Key: Get from http://localhost:54323 (Studio) → Settings → API

**For production/staging:**

- Ask team lead for shared development instance credentials

## Testing Your Setup

### 1. Verify All Services Are Running

```bash
# Check Docker containers
docker ps

# Expected output:
# - supabase_db_*
# - supabase_api_*
# - supabase_storage_*
# - python-backend (if started)

# Check frontend
curl http://localhost:3000
# Should return HTML

# Check Python backend
curl http://localhost:8000/api/health
# Should return: {"status": "healthy", ...}

# Check Supabase API
curl http://localhost:54321
# Should return JSON with API info
```

### 2. Test File Upload Flow

1. Open frontend: http://localhost:3000
2. Sign up for a new account (local only)
3. Navigate to dashboard
4. Upload a test video/audio file (use a short file, < 1 minute)
5. Check processing status in the UI

### 3. Monitor Processing

**Check Python backend logs:**

```bash
cd python-backend
docker-compose logs -f
```

**Check Edge Function logs:**

```bash
cd supabase
supabase functions logs
```

**Check database:**

1. Open Supabase Studio: http://localhost:54323
2. Go to "Table Editor"
3. View `processing_jobs` table (check status)
4. View `meeting_analysis` table (check results)

## Troubleshooting

### Docker Issues

**Problem:** `docker: command not found`

```bash
# Solution: Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop/
```

**Problem:** `Cannot connect to the Docker daemon`

```bash
# Solution: Start Docker Desktop application
# On Mac: Open Docker from Applications
# On Windows: Start Docker Desktop from Start menu
```

**Problem:** Port conflicts (port already in use)

```bash
# Check what's using the port
lsof -i :3000  # Frontend
lsof -i :8000  # Python backend
lsof -i :54321 # Supabase API

# Kill the process or change ports in configuration
```

### Supabase Issues

**Problem:** `supabase: command not found`

```bash
# Solution: Install Supabase CLI
npm install -g supabase

# Or use npx
npx supabase --version
```

**Problem:** Supabase won't start

```bash
# Make sure Docker is running
docker ps

# Stop and restart
./db-ops.sh stop
./db-ops.sh start

# Check status
./db-ops.sh status
```

**Problem:** Database migration errors

```bash
# Reset local database (caution: deletes all data)
./db-ops.sh reset

# Or repair migration history
cd supabase
supabase migration repair <version> --status applied
cd ..
```

### Python Backend Issues

**Problem:** Docker build fails

```bash
# Clean rebuild
cd python-backend
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

**Problem:** Module import errors

```bash
# Check if code is mounted correctly
cd python-backend
docker-compose exec python-backend ls -la /app/app/

# Restart container
docker-compose restart
```

**Problem:** API keys not working

```bash
# Check environment variables are loaded
cd python-backend
docker-compose exec python-backend env | grep -E 'GEMINI|HUGGINGFACE|SUPABASE'

# Make sure .env.local exists and has correct values
cat .env.local
```

**Problem:** "Could not connect to Supabase"

```bash
# Use host.docker.internal instead of localhost
# In .env.local:
SUPABASE_URL=http://host.docker.internal:54321

# Restart after changing
docker-compose restart
```

### Frontend Issues

**Problem:** `npm install` fails

```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Problem:** "Supabase client error"

```bash
# Check environment variables
cat frontend/.env.local

# Make sure Supabase is running
./db-ops.sh status

# Get correct anon key from Studio
open http://localhost:54323
```

**Problem:** Hot reload not working

```bash
# Restart dev server
cd frontend
npm run dev
```

### General Issues

**Problem:** "Out of memory" errors

```bash
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory
# Recommended: At least 4GB for Python backend
```

**Problem:** Slow performance on Mac

```bash
# Use Docker's VirtioFS
# Docker Desktop → Settings → General → Enable VirtioFS
```

**Problem:** Need to clear everything and start fresh

```bash
# Stop all services
./db-ops.sh stop
cd python-backend && docker-compose down -v && cd ..

# Clear all Docker data (caution!)
docker system prune -a --volumes

# Start fresh
./db-ops.sh start
cd python-backend && ./start-local.sh && cd ..
cd frontend && npm run dev
```

## Development Workflow

### Daily Workflow

**Option 1: Automated (Recommended)**

```bash
# 1. Start Docker Desktop (if not running)

# 2. Start all services with one command
./devops-instructions/start-all.sh

# 3. Code and test

# 4. When done, stop all services
./devops-instructions/stop-all.sh
# Frontend: Press Ctrl+C in the frontend terminal
```

**Option 2: Manual (for more control)**

```bash
# 1. Start Docker Desktop (if not running)

# 2. Start all services
./db-ops.sh start                    # Terminal 1: Supabase
cd python-backend && ./start-local.sh # Terminal 2: Python backend
cd frontend && npm run dev            # Terminal 3: Frontend

# 3. Code and test

# 4. When done, stop services
cd python-backend && docker-compose down
./db-ops.sh stop
# Frontend: Ctrl+C
```

### Making Database Changes

```bash
# 1. Make changes in Supabase Studio (http://localhost:54323)
# 2. Create migration from changes
./db-ops.sh diff add_new_feature

# 3. Review generated SQL in supabase/migrations/
# 4. Test locally
./db-ops.sh reset

# 5. Push to remote when ready
./db-ops.sh push

# 6. Generate TypeScript types
./db-ops.sh generate-types
```

### Code Quality

```bash
# Run linting
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check

# Run tests (if available)
npm test
```

## Next Steps

Once your local environment is set up:

1. **Explore the codebase** - Read `CLAUDE.md` for architecture details
2. **Test the full flow** - Upload a video and watch it process
3. **Review the database schema** - Check Supabase Studio
4. **Join the team channel** - Ask questions and share progress
5. **Pick up your first task** - Check the project board for issues

## Need Help?

- Check the main `CLAUDE.md` file for architecture details
- Review the `README.md` in each subdirectory
- Ask in the team Slack/Discord channel
- Open an issue on GitHub

Happy coding!
