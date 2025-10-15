# DevOps Instructions

This directory contains scripts and documentation for setting up and running the Meeting Intelligence Assistant in local development.

## 📚 Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Complete setup guide for new developers
  - Prerequisites and installation
  - Step-by-step setup for all three services
  - Getting API keys
  - Testing and troubleshooting

## 🚀 Quick Start Scripts

### Start All Services

```bash
./devops-instructions/start-all.sh
```

This automated script will:
- ✅ Check all prerequisites (Docker, Node.js, Supabase CLI)
- ✅ Verify environment files exist
- ✅ Start Supabase services
- ✅ Start Python backend in Docker
- ✅ Open frontend in a new terminal window
- ✅ Display all service URLs and helpful commands

**What it does:**
1. Validates Docker is running
2. Checks Node.js and Supabase CLI are installed
3. Ensures dependencies are installed
4. Creates missing `.env.local` files from examples
5. Starts Supabase (`./db-ops.sh start`)
6. Starts Python backend (`docker-compose up`)
7. Opens frontend in new terminal (`npm run dev`)

**Services started:**
- Frontend: http://localhost:3000
- Python Backend: http://localhost:8000
- Supabase API: http://localhost:54321
- Supabase Studio: http://localhost:54323

### Stop All Services

```bash
./devops-instructions/stop-all.sh
```

This script will:
- ✅ Stop Python backend container
- ✅ Stop Supabase services
- ✅ Show instructions for stopping frontend

**Note:** Frontend must be stopped manually (Ctrl+C in the terminal running `npm run dev`)

## 📋 Prerequisites

Before running the scripts, ensure you have:

1. **Docker Desktop** - Running before you start
2. **Node.js 18+** - For frontend and tooling
3. **Supabase CLI** - Install with `npm install -g supabase`

## 🔑 First-Time Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd chip-mono-mvp
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment files**
   ```bash
   # Copy templates
   cp frontend/.env.local.example frontend/.env.local
   cp python-backend/.env.local.example python-backend/.env.local
   cp supabase/functions/.env.example supabase/functions/.env
   ```

4. **Get API keys** (see [GETTING_STARTED.md](./GETTING_STARTED.md#getting-api-keys))
   - Gemini API key (free): https://aistudio.google.com/app/apikey
   - HuggingFace token (free): https://huggingface.co/settings/tokens

5. **Fill in environment files**
   - `python-backend/.env.local` - Add Gemini and HuggingFace keys
   - `frontend/.env.local` - Will be updated after Supabase starts

6. **Start everything**
   ```bash
   ./devops-instructions/start-all.sh
   ```

## 🔄 Daily Development Workflow

```bash
# Morning: Start all services
./devops-instructions/start-all.sh

# Code, test, commit...

# Evening: Stop all services
./devops-instructions/stop-all.sh
```

## 🛠️ Manual Control (Alternative)

If you prefer more control or need to restart individual services:

```bash
# Start individually
./db-ops.sh start                    # Supabase
cd python-backend && ./start-local.sh # Python
cd frontend && npm run dev            # Frontend

# Stop individually
cd python-backend && docker-compose down  # Python
./db-ops.sh stop                          # Supabase
# Press Ctrl+C in frontend terminal        # Frontend
```

## 📖 Additional Resources

- **Project Architecture:** [../CLAUDE.md](../CLAUDE.md)
- **Frontend README:** [../frontend/README.md](../frontend/README.md)
- **Python Backend:** [../python-backend/](../python-backend/)
- **Database Operations:** [../db-ops.sh](../db-ops.sh)

## 🐛 Troubleshooting

See the [Troubleshooting section](./GETTING_STARTED.md#troubleshooting) in GETTING_STARTED.md for common issues and solutions.

**Quick fixes:**

```bash
# Docker not running
# → Start Docker Desktop application

# Port already in use
lsof -i :3000   # Check what's using port 3000
lsof -i :8000   # Check what's using port 8000

# Reset everything
./devops-instructions/stop-all.sh
docker system prune -a --volumes  # Caution: removes all Docker data
./devops-instructions/start-all.sh
```

## 📞 Getting Help

- Read [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed instructions
- Check [CLAUDE.md](../CLAUDE.md) for architecture details
- Ask in team Slack/Discord
- Open an issue on GitHub

Happy coding! 🚀
