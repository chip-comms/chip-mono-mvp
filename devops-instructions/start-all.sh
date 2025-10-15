#!/bin/bash

###############################################################################
# Start All Services for Local Development
###############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

step() {
    echo -e "\n${BLUE}▶${NC} $1"
}

echo "========================================================"
echo "  Meeting Intelligence - Start All Services"
echo "========================================================"
echo ""

# Get the script's directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

info "Project root: $PROJECT_ROOT"

###############################################################################
# Step 1: Check Prerequisites
###############################################################################

step "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker not found. Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
fi

if ! docker ps &> /dev/null; then
    error "Docker is not running. Please start Docker Desktop and try again."
fi
info "Docker is running"

# Check Node.js
if ! command -v node &> /dev/null; then
    error "Node.js not found. Please install Node.js 18+: https://nodejs.org/"
fi
info "Node.js $(node --version)"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    error "Supabase CLI not found. Install with: npm install -g supabase"
fi
info "Supabase CLI $(supabase --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    warn "Root dependencies not installed. Running npm install..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    warn "Frontend dependencies not installed. This may take a few minutes..."
    cd frontend && npm install && cd ..
fi

###############################################################################
# Step 2: Check Environment Files
###############################################################################

step "Checking environment configuration..."

# Check frontend .env.local
if [ ! -f "frontend/.env.local" ]; then
    warn "frontend/.env.local not found"
    if [ -f "frontend/.env.local.example" ]; then
        echo "Creating frontend/.env.local from example..."
        cp frontend/.env.local.example frontend/.env.local
        echo ""
        echo -e "${YELLOW}IMPORTANT:${NC} Please edit frontend/.env.local with your Supabase keys"
        echo "After starting Supabase, get keys from: http://localhost:54323"
        echo ""
    fi
else
    info "Frontend environment configured"
fi

# Check python-backend .env.local
if [ ! -f "python-backend/.env.local" ]; then
    warn "python-backend/.env.local not found"
    if [ -f "python-backend/.env.local.example" ]; then
        echo "Creating python-backend/.env.local from example..."
        cp python-backend/.env.local.example python-backend/.env.local
        echo ""
        echo -e "${YELLOW}IMPORTANT:${NC} Please edit python-backend/.env.local with your API keys:"
        echo "  1. Gemini API: https://aistudio.google.com/app/apikey"
        echo "  2. HuggingFace: https://huggingface.co/settings/tokens"
        echo ""
        read -p "Press Enter after you've configured python-backend/.env.local..."
    fi
else
    info "Python backend environment configured"
fi

# Check edge functions .env
if [ ! -f "supabase/functions/.env" ]; then
    if [ -f "supabase/functions/.env.example" ]; then
        echo "Creating supabase/functions/.env from example..."
        cp supabase/functions/.env.example supabase/functions/.env
        info "Edge functions environment configured"
    fi
else
    info "Edge functions environment configured"
fi

###############################################################################
# Step 3: Start Supabase
###############################################################################

step "Starting Supabase services..."

# Check if Supabase is already running
if docker ps | grep -q "supabase"; then
    info "Supabase is already running"
else
    echo "Starting Supabase (this may take a minute)..."
    ./db-ops.sh start

    # Wait for services to be ready
    echo "Waiting for Supabase to be ready..."
    sleep 5

    if docker ps | grep -q "supabase"; then
        info "Supabase started successfully"
    else
        error "Failed to start Supabase. Check logs with: docker ps"
    fi
fi

# Display Supabase URLs
echo ""
echo "  API:    http://localhost:54321"
echo "  Studio: http://localhost:54323"

###############################################################################
# Step 4: Start Python Backend
###############################################################################

step "Starting Python backend..."

cd python-backend

# Check if container is already running
if docker ps | grep -q "meeting-intelligence-python-backend"; then
    info "Python backend is already running"
else
    # Use docker-compose directly for quieter output
    docker-compose up -d

    # Wait for service to be ready
    echo "Waiting for Python backend to be ready..."
    MAX_RETRIES=10
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            info "Python backend started successfully"
            break
        else
            RETRY_COUNT=$((RETRY_COUNT+1))
            if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
                warn "Python backend health check failed. It may still be starting."
                echo "Check logs with: cd python-backend && docker-compose logs -f"
            else
                sleep 2
            fi
        fi
    done
fi

echo ""
echo "  API:    http://localhost:8000"
echo "  Docs:   http://localhost:8000/docs"

cd ..

###############################################################################
# Step 5: Start Frontend
###############################################################################

step "Starting Frontend..."

echo ""
echo "The frontend will start in a new terminal window/tab."
echo "You can also start it manually with:"
echo "  cd frontend && npm run dev"
echo ""

# Try to open a new terminal tab/window based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript <<EOF
tell application "Terminal"
    do script "cd '$PROJECT_ROOT/frontend' && npm run dev"
    activate
end tell
EOF
    info "Frontend starting in new Terminal tab"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try various terminal emulators
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$PROJECT_ROOT/frontend' && npm run dev; exec bash"
        info "Frontend starting in new terminal"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$PROJECT_ROOT/frontend' && npm run dev" &
        info "Frontend starting in new terminal"
    else
        warn "Could not open new terminal. Start frontend manually:"
        echo "  cd frontend && npm run dev"
    fi
else
    # Windows or other
    warn "Could not detect terminal type. Start frontend manually:"
    echo "  cd frontend && npm run dev"
fi

###############################################################################
# Success Summary
###############################################################################

echo ""
echo "========================================================"
echo "  All Services Started!"
echo "========================================================"
echo ""
echo "📱 Frontend:          ${GREEN}http://localhost:3000${NC}"
echo "🐍 Python Backend:    ${GREEN}http://localhost:8000${NC}"
echo "🗄️  Supabase API:      ${GREEN}http://localhost:54321${NC}"
echo "🎨 Supabase Studio:   ${GREEN}http://localhost:54323${NC}"
echo ""
echo "📚 Useful Commands:"
echo ""
echo "  View Python logs:      cd python-backend && docker-compose logs -f"
echo "  View Supabase status:  ./db-ops.sh status"
echo "  Stop all services:     ./devops-instructions/stop-all.sh"
echo ""
echo "  Restart Python:        cd python-backend && docker-compose restart"
echo "  Restart Supabase:      ./db-ops.sh stop && ./db-ops.sh start"
echo ""
echo "📖 Documentation:"
echo "  Getting Started:       ./devops-instructions/GETTING_STARTED.md"
echo "  Architecture:          ./CLAUDE.md"
echo ""
echo "Happy coding! 🚀"
echo ""
