# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Architecture

This is a **monorepo** for a Meeting Intelligence Assistant that processes video/audio recordings and provides AI-powered insights. The system consists of three main components:

### Components

- **Frontend** (`frontend/`): Next.js app with React UI and API routes
- **Supabase Backend** (`supabase-backend/`): TypeScript library providing AI logic, imported by frontend API routes
- **Python Backend** (`python-backend/`): FastAPI service for CPU-intensive video processing operations

### Data Flow

```
Frontend (Next.js:3000)
├─ API Routes import supabase-backend/lib
├─ Makes HTTP calls to Python Backend (FastAPI:8000)
└─ Processes: Upload → Extract Audio → Transcribe → AI Analysis
```

The frontend runs as **one process** that imports backend logic as a library, plus a separate Python service for video processing.

## Essential Commands

### Initial Setup

```bash
npm run install:all          # Install all dependencies (Node.js + Python)
brew install ffmpeg          # Required for audio/video processing
```

### Development

```bash
npm run dev:all              # Start both frontend and Python backend
npm run dev:frontend         # Start frontend only (port 3000)
npm run dev:python          # Start Python backend only (port 8000)
```

### Code Quality

```bash
npm run format              # Auto-format all files
npm run lint               # Lint all workspaces
npm run format:check       # Check formatting without fixing
```

### Python Backend Specific

```bash
cd python-backend
python -m venv venv
source venv/bin/activate    # Activate virtual environment
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest                     # Run tests
```

### Testing

```bash
# Test API endpoints
curl http://localhost:3000/api/recordings
curl http://localhost:8000/api/health
```

## Architecture Deep Dive

### File Processing Pipeline

1. **Upload**: User uploads video via frontend
2. **Storage**: File saved via LocalStorageAdapter
3. **Database**: Recording entry created via LocalDataAdapter
4. **Processing**: Background API call triggers processing
5. **Audio Extraction**: Python backend extracts audio from video
6. **Transcription**: OpenAI Whisper API transcribes audio
7. **Analysis**: GPT-4 analyzes transcript for insights
8. **Metrics**: Communication metrics calculated
9. **Storage**: Intelligence data saved to JSON files
10. **Completion**: Recording status updated, frontend displays results

### Key Types and Interfaces

- **Recording**: Core video/audio file metadata with status tracking
- **Intelligence**: AI-generated insights including transcript, analysis, metrics
- **StorageAdapter**: Abstraction for file storage (local vs cloud)
- **DataAdapter**: Abstraction for metadata storage (local JSON vs database)

### Environment Variables

Required in `frontend/.env.local`:

```bash
OPENAI_API_KEY=sk-your-key-here
PYTHON_BACKEND_URL=http://localhost:8000  # For production
```

### Directory Structure

```
├── frontend/                    # Next.js app (primary server)
│   ├── app/api/                # API routes import supabase-backend
│   └── public/uploads/         # Served static files
├── supabase-backend/           # Complete Supabase project + business logic
│   ├── config.toml             # Supabase project configuration
│   ├── migrations/             # Database schema migrations
│   ├── functions/              # Supabase Edge Functions
│   ├── lib/                    # Business logic imported by frontend
│   │   ├── ai/                 # Transcription, analysis, metrics
│   │   ├── storage/            # File storage adapters
│   │   └── data/               # Data persistence adapters
│   ├── storage/                # Local file storage
│   └── data/                   # Local JSON database
└── python-backend/             # FastAPI service for video ops
    ├── app/routes/             # Video, audio, analysis endpoints
    └── storage/                # Temporary processing files
```

## Development Workflow

### Making Backend Changes

1. Edit `supabase-backend/lib/` files
2. Changes are automatically imported by frontend API routes
3. Restart Next.js dev server if hot reload doesn't work

### Adding New Features

1. Update types in `supabase-backend/lib/types.ts`
2. Add logic to appropriate `supabase-backend/lib/` modules
3. Create/update frontend API routes in `frontend/app/api/`
4. Update UI components in `frontend/app/`

### Python Service Development

- Used for CPU-intensive operations (video compression, audio extraction)
- Provides REST API consumed by frontend
- Includes health checks, video processing, and future ML capabilities

## Service URLs

- **Frontend**: http://localhost:3000
- **Python Backend**: http://localhost:8000
- **Python API Docs**: http://localhost:8000/docs

## Key Technical Decisions

### Why This Architecture?

- **Monorepo**: Simplifies development and deployment coordination
- **Library Pattern**: supabase-backend is imported, not run as separate service
- **Python for Video**: Better ecosystem for FFmpeg, OpenCV, ML libraries
- **Local Storage**: Simple development setup, easily migrated to cloud storage

### Adapter Pattern

The codebase uses adapter patterns for both storage and data persistence, allowing easy migration from local development (JSON files, local storage) to production (Supabase, cloud storage) without changing business logic.

## Common Issues

### Missing FFmpeg

```bash
brew install ffmpeg  # macOS
```

### Path Resolution Issues

Update `frontend/tsconfig.json` if imports fail:

```json
{
  "compilerOptions": {
    "paths": {
      "@/supabase-backend/*": ["../supabase-backend/*"]
    }
  }
}
```

### Processing Failures

- Check Python backend is running (port 8000)
- Verify OpenAI API key is set
- Check required directories exist (storage/uploads, data/)
