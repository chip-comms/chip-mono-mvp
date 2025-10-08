# Development Commands

This is a monorepo with workspace support. You can run commands from the root directory or within individual packages.

## 🚀 Quick Start

### Initial Setup

```bash
# Install all dependencies (Node.js + Python)
npm run install:all

# Or manually:
npm install                           # Root dependencies
cd frontend && npm install            # Frontend dependencies
cd ../supabase-backend && npm install # Backend dependencies
cd ../python-backend && pip install -r requirements.txt  # Python dependencies
```

## 📝 Formatting & Linting (Root Level)

Run these commands from the **root directory** to check/fix all files:

### Format All Files

```bash
npm run format              # Auto-fix formatting in all files
npm run format:check        # Check formatting without fixing
```

### Format Specific Workspace

```bash
npm run format:frontend     # Format frontend only
npm run format:backend      # Format backend only
```

### Lint

```bash
npm run lint               # Lint ALL workspaces (frontend + backend)
npm run lint:frontend      # Lint frontend only
npm run lint:backend       # Lint backend only
```

## 🔧 Development Commands

### Frontend (Next.js)

```bash
npm run dev:frontend       # Start frontend dev server (port 3000)
npm run build:frontend     # Build frontend for production

# Or cd into frontend directory
cd frontend
npm run dev
npm run build
npm run lint
npm run format
```

### Python Backend (FastAPI)

```bash
npm run dev:python         # Start Python backend (port 8000)

# Or cd into python-backend directory
cd python-backend
source venv/bin/activate   # Activate virtual environment
uvicorn app.main:app --reload --port 8000
```

### Run All Services

```bash
npm run dev:all            # Start both frontend and Python backend concurrently
```

### Node.js Backend

```bash
cd supabase-backend
npm run format
npm run format:check
```

## 🐍 Python Backend Specific

### Setup Virtual Environment

```bash
cd python-backend
python -m venv venv
source venv/bin/activate    # On macOS/Linux
# venv\Scripts\activate     # On Windows
pip install -r requirements.txt
```

### Run Dev Server

```bash
# From python-backend directory
uvicorn app.main:app --reload --port 8000

# Or from root
npm run dev:python
```

### Test Python Backend

```bash
cd python-backend
pytest                      # Run tests
pytest --cov=app           # Run with coverage
```

### Access Python API Docs

```bash
# Start the server, then visit:
http://localhost:8000/docs        # Swagger UI
http://localhost:8000/redoc       # ReDoc
```

## 💡 Tips

1. **Before committing**: Run `npm run format` and `npm run lint` from root
2. **CI/CD**: GitHub Actions will automatically check formatting and linting on PRs
3. **VS Code**: Install Prettier extension for automatic formatting on save
4. **Performance**: Root commands use globs, so they're fast even with many files
5. **Python Backend**: Make sure ffmpeg is installed on your system (`brew install ffmpeg`)

## 🎯 Recommended Workflow

```bash
# 1. Install everything
npm run install:all

# 2. Start all services
npm run dev:all

# 3. Make your changes

# 4. Format and lint
npm run format
npm run lint

# 5. Commit and push
git add .
git commit -m "Your message"
git push
```

## 🌐 Service URLs

When running locally:

- **Frontend**: http://localhost:3000
- **Python Backend**: http://localhost:8000
- **Python API Docs**: http://localhost:8000/docs

## 🔍 Architecture

```
┌──────────────────┐
│   Frontend       │ Port 3000 (Next.js)
│   + API Routes   │
└────────┬─────────┘
         │
         ├─────────► supabase-backend/lib (Node.js logic)
         │
         └─────────► Python Backend (Port 8000)
                     - Video processing
                     - Audio extraction
                     - Compression
```

The GitHub Actions workflow will automatically verify formatting and linting on your PR! ✨
