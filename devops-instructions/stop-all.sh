#!/bin/bash

###############################################################################
# Stop All Services
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

step() {
    echo -e "\n${BLUE}▶${NC} $1"
}

echo "========================================================"
echo "  Meeting Intelligence - Stop All Services"
echo "========================================================"
echo ""

# Get the script's directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

###############################################################################
# Stop Python Backend
###############################################################################

step "Stopping Python backend..."

cd python-backend

if docker ps | grep -q "meeting-intelligence-python-backend"; then
    docker-compose down
    info "Python backend stopped"
else
    info "Python backend was not running"
fi

cd ..

###############################################################################
# Stop Supabase
###############################################################################

step "Stopping Supabase services..."

if docker ps | grep -q "supabase"; then
    ./db-ops.sh stop
    info "Supabase stopped"
else
    info "Supabase was not running"
fi

###############################################################################
# Frontend Info
###############################################################################

step "Frontend (manual stop)..."

warn "Frontend must be stopped manually:"
echo "  Find the terminal running 'npm run dev' and press Ctrl+C"
echo ""

# Try to find and show running node processes (frontend)
if command -v lsof &> /dev/null; then
    FRONTEND_PID=$(lsof -ti:3000 2>/dev/null || true)
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Frontend is running on port 3000 (PID: $FRONTEND_PID)"
        echo "To kill it: kill $FRONTEND_PID"
        echo ""
    fi
fi

###############################################################################
# Summary
###############################################################################

echo "========================================================"
echo "  Services Stopped"
echo "========================================================"
echo ""
echo "✓ Python backend stopped"
echo "✓ Supabase stopped"
echo "⚠ Frontend - stop manually (Ctrl+C in terminal)"
echo ""
echo "To start again: ./devops-instructions/start-all.sh"
echo ""
