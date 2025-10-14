#!/bin/bash

###############################################################################
# Deploy Python Backend to Google Cloud Run
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
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

prompt() {
    read -p "$(echo -e ${YELLOW}?${NC}) $1: " response
    echo $response
}

###############################################################################
# Step 1: Check Prerequisites
###############################################################################

echo "================================================"
echo "  Meeting Intelligence - Python Backend Deploy"
echo "================================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install"
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    error "Not authenticated with gcloud. Run: gcloud auth login"
fi

info "gcloud CLI authenticated"

###############################################################################
# Step 2: Get Project Configuration
###############################################################################

# Get current project or prompt for one
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [ -z "$CURRENT_PROJECT" ]; then
    echo ""
    echo "Available projects:"
    gcloud projects list --format="table(projectId,name)"
    echo ""
    PROJECT_ID=$(prompt "Enter your GCP project ID")
    gcloud config set project $PROJECT_ID
else
    echo ""
    info "Current project: $CURRENT_PROJECT"
    USE_CURRENT=$(prompt "Use this project? (y/n)")
    if [ "$USE_CURRENT" != "y" ]; then
        echo ""
        echo "Available projects:"
        gcloud projects list --format="table(projectId,name)"
        echo ""
        PROJECT_ID=$(prompt "Enter your GCP project ID")
        gcloud config set project $PROJECT_ID
    else
        PROJECT_ID=$CURRENT_PROJECT
    fi
fi

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
info "Project number: $PROJECT_NUMBER"

# Set region
REGION=${REGION:-us-central1}
echo ""
CUSTOM_REGION=$(prompt "Deploy region (default: $REGION)")
if [ ! -z "$CUSTOM_REGION" ]; then
    REGION=$CUSTOM_REGION
fi
info "Using region: $REGION"

###############################################################################
# Step 3: Enable Required APIs
###############################################################################

echo ""
echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

info "APIs enabled"

###############################################################################
# Step 4: Create Artifact Registry (if needed)
###############################################################################

echo ""
echo "Checking Artifact Registry..."

if gcloud artifacts repositories describe meeting-intelligence \
    --location=$REGION &>/dev/null; then
    info "Artifact Registry repository already exists"
else
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create meeting-intelligence \
      --repository-format=docker \
      --location=$REGION \
      --description="Meeting Intelligence container images"
    info "Artifact Registry repository created"
fi

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
info "Docker authentication configured"

###############################################################################
# Step 5: Setup Secrets
###############################################################################

echo ""
echo "================================================"
echo "  Secret Configuration"
echo "================================================"
echo ""
warn "You'll need the following credentials:"
echo "  1. Supabase URL (e.g., https://xxxxx.supabase.co)"
echo "  2. Supabase Service Role Key (from Settings > API)"
echo "  3. Gemini API Key (or other AI provider)"
echo ""

SETUP_SECRETS=$(prompt "Setup secrets now? (y/n)")

if [ "$SETUP_SECRETS" = "y" ]; then
    # Supabase URL
    if gcloud secrets describe supabase-url &>/dev/null; then
        info "Secret 'supabase-url' already exists"
    else
        SUPABASE_URL=$(prompt "Enter Supabase URL")
        echo -n "$SUPABASE_URL" | gcloud secrets create supabase-url --data-file=-
        info "Created secret 'supabase-url'"
    fi

    # Supabase Service Role Key
    if gcloud secrets describe supabase-service-role-key &>/dev/null; then
        info "Secret 'supabase-service-role-key' already exists"
    else
        echo ""
        warn "IMPORTANT: Use the service_role key, NOT the anon key!"
        SUPABASE_KEY=$(prompt "Enter Supabase Service Role Key")
        echo -n "$SUPABASE_KEY" | gcloud secrets create supabase-service-role-key --data-file=-
        info "Created secret 'supabase-service-role-key'"
    fi

    # Gemini API Key
    if gcloud secrets describe gemini-api-key &>/dev/null; then
        info "Secret 'gemini-api-key' already exists"
    else
        GEMINI_KEY=$(prompt "Enter Gemini API Key (or press Enter to skip)")
        if [ ! -z "$GEMINI_KEY" ]; then
            echo -n "$GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=-
            info "Created secret 'gemini-api-key'"
        fi
    fi

    # Grant secret access to Cloud Run service account
    echo ""
    echo "Granting secret access to Cloud Run service account..."
    for SECRET in supabase-url supabase-service-role-key gemini-api-key; do
        if gcloud secrets describe $SECRET &>/dev/null; then
            gcloud secrets add-iam-policy-binding $SECRET \
              --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
              --role="roles/secretmanager.secretAccessor" \
              --quiet || warn "Could not grant access to $SECRET (may already exist)"
        fi
    done
    info "Secret access configured"
fi

###############################################################################
# Step 6: Build Container
###############################################################################

echo ""
echo "================================================"
echo "  Building Container"
echo "================================================"
echo ""

IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/meeting-intelligence/python-backend:latest"

echo "Building container image..."
echo "Image: $IMAGE_NAME"
echo ""

gcloud builds submit \
  --tag $IMAGE_NAME \
  --timeout=20m \
  .

info "Container built successfully"

###############################################################################
# Step 7: Deploy to Cloud Run
###############################################################################

echo ""
echo "================================================"
echo "  Deploying to Cloud Run"
echo "================================================"
echo ""

# Get CORS origins
echo ""
FRONTEND_URL=$(prompt "Enter your frontend URL (e.g., https://yourdomain.com)")
CORS_ORIGINS="${FRONTEND_URL},http://localhost:3000"

echo ""
echo "Deploying service..."
echo "  Memory: 2Gi"
echo "  CPU: 2"
echo "  Timeout: 300s"
echo "  Min instances: 0"
echo "  Max instances: 10"
echo ""

gcloud run deploy meeting-intelligence-backend \
  --image $IMAGE_NAME \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300s \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets "SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars "PORT=8080,AI_PROVIDER=gemini,CORS_ORIGINS=${CORS_ORIGINS}" \
  --quiet

###############################################################################
# Step 8: Get Service URL and Test
###############################################################################

echo ""
echo "================================================"
echo "  Deployment Complete"
echo "================================================"
echo ""

SERVICE_URL=$(gcloud run services describe meeting-intelligence-backend \
  --region $REGION \
  --format="value(status.url)")

info "Service deployed successfully!"
echo ""
echo "Service URL: ${GREEN}$SERVICE_URL${NC}"
echo ""

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/api/health" || echo "ERROR")

if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    info "Health check passed!"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    warn "Health check failed. Check logs with:"
    echo "  gcloud run services logs read meeting-intelligence-backend --region $REGION"
fi

echo ""
echo "================================================"
echo "  Next Steps"
echo "================================================"
echo ""
echo "1. Add this to your frontend/.env.local:"
echo "   ${YELLOW}PYTHON_BACKEND_URL=$SERVICE_URL${NC}"
echo ""
echo "2. View logs:"
echo "   gcloud run services logs read meeting-intelligence-backend --region $REGION"
echo ""
echo "3. View service details:"
echo "   gcloud run services describe meeting-intelligence-backend --region $REGION"
echo ""
echo "4. Update service (after code changes):"
echo "   ./deploy.sh"
echo ""
