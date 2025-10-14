# Edge Function + Cloud Run Deployment Guide

This guide explains how to deploy the complete system with Supabase Edge Functions and Python backend on Cloud Run.

## Architecture

```
Frontend → Supabase Edge Functions → Python Backend (Cloud Run) → Supabase
```

**Why Edge Functions?**
- Secure: Frontend never calls Python backend directly
- Authentication: Edge Functions handle user auth automatically
- Proximity: Runs close to Supabase for low latency
- Service Role: Can use service role key securely
- No CORS issues: Same origin as Supabase

## Deployment Steps

### 1. Deploy Python Backend to Cloud Run

First, deploy the Python backend as explained in CHI-18.

```bash
cd python-backend
./deploy.sh
```

After deployment, save the service URL:
```bash
SERVICE_URL=$(gcloud run services describe meeting-intelligence-backend \
  --region us-central1 \
  --format="value(status.url)")

echo $SERVICE_URL
# Example: https://meeting-intelligence-backend-xxx-uc.a.run.app
```

### 2. Deploy Supabase Edge Functions

#### Install Supabase CLI (if not already installed)

```bash
# macOS
brew install supabase/tap/supabase

# Other platforms
# See: https://supabase.com/docs/guides/cli
```

#### Login to Supabase

```bash
supabase login
```

#### Link to your project

```bash
cd supabase-backend
supabase link --project-ref kfikvadshmptpwscgbyu
```

#### Set Edge Function secrets

```bash
# Set Python backend URL
supabase secrets set PYTHON_BACKEND_URL=$SERVICE_URL

# Set Python backend API key (generate a secure key)
PYTHON_API_KEY=$(openssl rand -hex 32)
supabase secrets set PYTHON_BACKEND_API_KEY=$PYTHON_API_KEY

# Also add this key to Cloud Run
gcloud run services update meeting-intelligence-backend \
  --region us-central1 \
  --update-env-vars "API_KEY=$PYTHON_API_KEY"
```

#### Deploy Edge Functions

```bash
# Deploy process-meeting function
supabase functions deploy process-meeting

# Deploy get-job-status function
supabase functions deploy get-job-status
```

#### Verify deployment

```bash
# Check function status
supabase functions list

# View logs
supabase functions logs process-meeting
supabase functions logs get-job-status
```

### 3. Update Frontend Configuration

No changes needed! Frontend only needs Supabase URL and anon key, which are already configured.

```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://kfikvadshmptpwscgbyu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Test End-to-End Flow

#### Test from frontend

```tsx
import { useProcessJob, useJobStatus } from '@/lib/use-job-status';

// 1. Upload file (already implemented)
const formData = new FormData();
formData.append('file', file);
const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
const { jobId } = await uploadResponse.json();

// 2. Trigger processing via Edge Function
const { processJob } = useProcessJob();
await processJob(jobId);

// 3. Poll status via Edge Function
const { job } = useJobStatus(jobId, {
  onComplete: (job) => console.log('Done!', job),
  onError: (job) => console.error('Failed:', job.error)
});
```

#### Test Edge Function directly

```bash
# Get your access token from browser DevTools (Application > Local Storage)
TOKEN="your-access-token"

# Test process-meeting
curl -X POST \
  https://kfikvadshmptpwscgbyu.supabase.co/functions/v1/process-meeting \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "your-job-id"}'

# Test get-job-status
curl "https://kfikvadshmptpwscgbyu.supabase.co/functions/v1/get-job-status?jobId=your-job-id" \
  -H "Authorization: Bearer $TOKEN"
```

## Local Development

### Run Edge Functions locally

```bash
cd supabase-backend

# Start Supabase (includes Edge Functions)
supabase start

# Edge Functions will be available at:
# http://localhost:54321/functions/v1/process-meeting
# http://localhost:54321/functions/v1/get-job-status
```

### Set local environment variables

Create `supabase-backend/.env` for local Edge Functions:

```bash
PYTHON_BACKEND_URL=http://host.docker.internal:8000
PYTHON_BACKEND_API_KEY=dev_key_for_local_testing
```

Note: Use `host.docker.internal` to access localhost from Docker container.

### Start Python backend

```bash
cd python-backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Test locally

```bash
# Get local anon key
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

# Test process-meeting
curl -X POST \
  http://localhost:54321/functions/v1/process-meeting \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-id"}'
```

## Monitoring

### View Edge Function logs

```bash
# Real-time logs
supabase functions logs process-meeting --follow
supabase functions logs get-job-status --follow

# Recent logs
supabase functions logs process-meeting --limit 100
```

### View Python backend logs

```bash
# Cloud Run logs
gcloud run services logs read meeting-intelligence-backend \
  --region us-central1 \
  --limit 100 \
  --follow
```

### View database activity

```bash
# Check processing jobs
supabase db psql
> SELECT id, status, processing_error, created_at
  FROM processing_jobs
  ORDER BY created_at DESC
  LIMIT 10;
```

## Troubleshooting

### Edge Function errors

**Error: "PYTHON_BACKEND_URL not configured"**

```bash
# Set the secret
supabase secrets set PYTHON_BACKEND_URL=https://your-service.run.app

# Verify
supabase secrets list
```

**Error: "Failed to connect to processing service"**

1. Check Python backend is running:
   ```bash
   curl https://your-service.run.app/api/health
   ```

2. Check CORS configuration in Python backend
3. Verify API key matches if authentication is enabled

### Python backend errors

**Error: "Failed to download file"**

- Check signed URL is valid and not expired
- Verify Supabase service role key is correct
- Ensure file exists in storage

**Error: "Transcription failed"**

- Check file format is supported
- Verify audio quality
- Check Cloud Run memory/CPU limits

### Authentication errors

**Error: "Unauthorized"**

- User must be logged in to call Edge Functions
- Check auth token is being passed correctly
- Verify JWT is not expired

## Security Checklist

- [ ] Python backend deployed with API key authentication
- [ ] API key stored in both Cloud Run and Edge Function secrets
- [ ] Edge Functions use service role key (not anon key) for admin operations
- [ ] Frontend uses anon key (never service role key)
- [ ] RLS policies enforced on all tables
- [ ] CORS configured on Python backend
- [ ] Signed URLs have reasonable expiry (2 hours)
- [ ] Secrets not committed to git
- [ ] Production URLs configured (not localhost)

## Cost Considerations

### Supabase Edge Functions

- **Free tier:** 500K invocations/month
- **After free tier:** $2 per million invocations
- **Estimated cost:** Free for most projects

### Google Cloud Run

- **Free tier:** 2M requests/month, 360K GB-seconds
- **After free tier:** ~$0.024 per GB-second
- **Estimated cost:** $5-20/month for light usage

### Total estimated cost

- Development: Free (within free tiers)
- Light production (10-50 jobs/day): $5-15/month
- Medium production (100-500 jobs/day): $15-50/month

## Next Steps

After successful deployment:

1. **Monitor usage:** Check Edge Function and Cloud Run metrics
2. **Optimize:** Adjust resource limits based on actual usage
3. **Scale:** Increase max instances if needed
4. **Enhance:** Add real-time updates with Supabase Realtime
5. **Queue:** Implement job queue for batch processing
6. **Analytics:** Add tracking for processing times and success rates

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Project CLAUDE.md](./CLAUDE.md) - Full project documentation
- [INTEGRATION.md](./INTEGRATION.md) - Detailed integration guide
