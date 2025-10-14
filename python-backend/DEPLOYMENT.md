# Python Backend Deployment to Google Cloud Run

This guide walks through deploying the FastAPI Python backend to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally (for testing builds)
4. **Supabase service role key** from your Supabase dashboard

## Part 1: Initial Google Cloud Setup

### 1.1 Set up Google Cloud Project

```bash
# Set your project ID (replace with your actual project ID)
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com
```

### 1.2 Create Artifact Registry Repository

```bash
# Create a Docker repository for container images
gcloud artifacts repositories create meeting-intelligence \
  --repository-format=docker \
  --location=$REGION \
  --description="Meeting Intelligence container images"

# Configure Docker to use gcloud for authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

## Part 2: Configure Secrets

### 2.1 Create Secrets in Secret Manager

```bash
# Supabase URL
echo -n "https://your-project.supabase.co" | \
  gcloud secrets create supabase-url --data-file=-

# Supabase Service Role Key (CRITICAL: Use service_role key, NOT anon key)
echo -n "your-supabase-service-role-key" | \
  gcloud secrets create supabase-service-role-key --data-file=-

# Gemini API Key
echo -n "your-gemini-api-key" | \
  gcloud secrets create gemini-api-key --data-file=-

# Optional: OpenAI API Key
echo -n "your-openai-api-key" | \
  gcloud secrets create openai-api-key --data-file=-
```

### 2.2 Grant Secret Access to Cloud Run Service Account

```bash
# Get your project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant access to secrets
for SECRET in supabase-url supabase-service-role-key gemini-api-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## Part 3: Build and Deploy

### 3.1 Build Container Image

```bash
# Navigate to python-backend directory
cd python-backend

# Build the container image
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/meeting-intelligence/python-backend:latest \
  .
```

### 3.2 Deploy to Cloud Run

```bash
# Deploy the service
gcloud run deploy meeting-intelligence-backend \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/meeting-intelligence/python-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300s \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets "SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars "PORT=8080,AI_PROVIDER=gemini,CORS_ORIGINS=https://yourdomain.com"
```

**Note:** Replace `https://yourdomain.com` with your actual frontend domain. For development, you can add `http://localhost:3000` separated by commas.

### 3.3 Get the Service URL

```bash
# Get the deployed service URL
gcloud run services describe meeting-intelligence-backend \
  --region $REGION \
  --format="value(status.url)"
```

Save this URL - you'll need it for frontend integration.

## Part 4: Test the Deployment

```bash
# Test health endpoint
export SERVICE_URL=$(gcloud run services describe meeting-intelligence-backend \
  --region $REGION \
  --format="value(status.url)")

curl $SERVICE_URL/api/health

# Expected response:
# {"status":"healthy","service":"meeting-intelligence-backend","timestamp":"..."}
```

## Part 5: Configure Authentication (Optional but Recommended)

By default, the service is deployed with `--allow-unauthenticated` for easier testing. For production, you should secure it.

### Option 1: Require Authentication

```bash
# Redeploy with authentication required
gcloud run deploy meeting-intelligence-backend \
  --region $REGION \
  --no-allow-unauthenticated

# Grant invoker role to your Next.js service account (if on Cloud Run)
# OR generate an identity token for API calls
```

### Option 2: Use API Key Authentication

Add an API key check in the Python backend:

1. Generate a secure API key
2. Store it in Secret Manager
3. Update the Python backend to validate the `X-API-Key` header
4. Pass the key from Next.js API routes

## Part 6: Update Frontend Configuration

Add the Cloud Run URL to your frontend environment variables:

```bash
# frontend/.env.local
PYTHON_BACKEND_URL=https://your-service-url.run.app
PYTHON_BACKEND_API_KEY=your-secure-api-key  # If using API key auth
```

## Part 7: Continuous Deployment (Optional)

### Using Cloud Build Triggers

Create a trigger to automatically deploy on git push:

```bash
gcloud builds triggers create github \
  --name=python-backend-deploy \
  --repo-name=your-repo \
  --repo-owner=your-github-username \
  --branch-pattern=^main$ \
  --build-config=python-backend/cloudbuild.yaml
```

Create `python-backend/cloudbuild.yaml`:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/$PROJECT_ID/meeting-intelligence/python-backend:$COMMIT_SHA', '.']
    dir: 'python-backend'

  # Push the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_REGION}-docker.pkg.dev/$PROJECT_ID/meeting-intelligence/python-backend:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'meeting-intelligence-backend'
      - '--image=${_REGION}-docker.pkg.dev/$PROJECT_ID/meeting-intelligence/python-backend:$COMMIT_SHA'
      - '--region=${_REGION}'
      - '--platform=managed'

substitutions:
  _REGION: us-central1

images:
  - '${_REGION}-docker.pkg.dev/$PROJECT_ID/meeting-intelligence/python-backend:$COMMIT_SHA'
```

## Monitoring and Logs

```bash
# View logs
gcloud run services logs read meeting-intelligence-backend \
  --region $REGION \
  --limit 50

# View metrics in Cloud Console
# Navigate to: Cloud Run > meeting-intelligence-backend > Metrics
```

## Cost Optimization

Cloud Run pricing:
- **Free tier**: 2 million requests/month, 360,000 GB-seconds
- **After free tier**: ~$0.024 per GB-second, ~$0.40 per million requests
- **Estimated cost**: $5-20/month for light usage with min-instances=0

Tips:
- Use `--min-instances=0` to scale to zero when not in use
- Set `--max-instances=10` to control costs
- Monitor usage in Cloud Console

## Troubleshooting

### Container fails to start
```bash
# Check logs
gcloud run services logs read meeting-intelligence-backend --region $REGION

# Common issues:
# - Missing environment variables
# - Secret access permissions
# - Port configuration (must use PORT=8080)
```

### Timeout errors
```bash
# Increase timeout (max 3600s for 2nd gen)
gcloud run services update meeting-intelligence-backend \
  --region $REGION \
  --timeout 600s
```

### Memory issues
```bash
# Increase memory
gcloud run services update meeting-intelligence-backend \
  --region $REGION \
  --memory 4Gi
```

## Security Checklist

- [ ] Service role key stored in Secret Manager (not in code)
- [ ] API keys stored in Secret Manager
- [ ] CORS configured with specific origins (not `*`)
- [ ] Authentication enabled (or API key required)
- [ ] Frontend URL whitelist configured
- [ ] Logs reviewed for sensitive data
- [ ] IAM permissions follow least privilege

## Next Steps

1. ✅ Backend deployed to Cloud Run
2. Create Next.js API route to trigger processing (`/api/process-job`)
3. Implement signed URL generation for Supabase Storage
4. Add processing status polling or webhooks
5. Test end-to-end flow: upload → process → results
