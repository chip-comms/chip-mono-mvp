# Meeting Intelligence Assistant

A monorepo for processing video/audio and generating AI-powered insights.

## Architecture

This project uses a **unified backend structure** where all Supabase configuration and business logic are consolidated:

```
├── frontend/                    # Next.js app (port 3000)
├── supabase-backend/           # Complete backend (database + logic)
│   ├── config.toml             # Supabase project configuration
│   ├── migrations/             # Database schema
│   ├── functions/              # Edge Functions
│   └── lib/                    # Business logic imported by frontend
└── python-backend/             # FastAPI service (port 8000)
```

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Start both frontend and Python backend
npm run dev:all

# Database operations
./db-ops.sh help
```

## Key Features

- **Unified Backend**: Single `supabase-backend/` directory contains both database config and business logic
- **Portable AI**: Business logic in `lib/` can be imported by frontend or Edge Functions
- **Adapter Pattern**: Easy migration from local development to production
- **Full Stack**: Frontend → Business Logic → Python Processing → AI Analysis
