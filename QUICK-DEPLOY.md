# Quick Deployment Reference

Quick commands for deploying CHI-18 with Edge Functions.

## Prerequisites

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Authenticate
gcloud auth login
supabase login
```

## 1. Deploy Python Backend

```bash
cd python-backend
./deploy.sh
```

**Save the service URL** that gets printed at the end!

## 2. Deploy Edge Functions

```bash
cd ../supabase-backend

# Link project
supabase link --project-ref kfikvadshmptpwscgbyu

# Set secrets (replace with your actual service URL)
supabase secrets set PYTHON_BACKEND_URL=https://meeting-intelligence-backend-xxx-uc.a.run.app

# Generate and set API key
PYTHON_API_KEY=$(openssl rand -hex 32)
supabase secrets set PYTHON_BACKEND_API_KEY=$PYTHON_API_KEY

# Add API key to Cloud Run
gcloud run services update meeting-intelligence-backend \
  --region us-central1 \
  --update-env-vars "API_KEY=$PYTHON_API_KEY"

# Deploy functions
supabase functions deploy process-meeting
supabase functions deploy get-job-status
```

## 3. Verify

```bash
# Check Edge Functions
supabase functions list

# Test Python backend
curl https://your-service-url.run.app/api/health

# View logs
supabase functions logs process-meeting
```

## Done!

Your frontend will automatically use the Edge Functions through the Supabase client.

---

## Local Development

```bash
# Terminal 1: Supabase
cd supabase-backend
supabase start

# Terminal 2: Python backend
cd python-backend
source venv/bin/activate
export PYTHON_BACKEND_URL=http://host.docker.internal:8000
uvicorn app.main:app --reload --port 8000

# Terminal 3: Frontend
cd frontend
npm run dev
```

---

## Troubleshooting

### View logs
```bash
# Edge Functions
supabase functions logs process-meeting --follow

# Cloud Run
gcloud run services logs read meeting-intelligence-backend \
  --region us-central1 --follow
```

### Check secrets
```bash
supabase secrets list
```

### Update secrets
```bash
supabase secrets set PYTHON_BACKEND_URL=new-url
supabase secrets set PYTHON_BACKEND_API_KEY=new-key
```

---

For detailed instructions, see [EDGE-FUNCTION-DEPLOYMENT.md](./EDGE-FUNCTION-DEPLOYMENT.md)
