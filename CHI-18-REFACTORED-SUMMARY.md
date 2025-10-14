# CHI-18: Edge Function Architecture - Refactored Implementation

## Status: Ready for Deployment ✅

The implementation has been refactored to use Supabase Edge Functions instead of Next.js API routes, following best practices for Supabase architecture.

---

## Why Edge Functions?

The original implementation used Next.js API routes to call the Python backend. This has been refactored to use Supabase Edge Functions because:

1. **Security:** Frontend never calls Python backend directly
2. **Authentication:** Edge Functions handle user auth automatically with RLS
3. **Proximity:** Runs close to Supabase infrastructure (lower latency)
4. **Service Role Access:** Can securely use service role key for admin operations
5. **No CORS Issues:** Same origin as Supabase
6. **Serverless:** Auto-scaling, pay-per-use pricing

## Architecture Comparison

### ❌ Old Architecture (Next.js API Routes)
```
Frontend → Next.js API Route → Python Backend → Supabase
```

Problems:
- Frontend would need Python backend URL
- CORS configuration required
- More complex auth flow
- Two separate deployment domains

### ✅ New Architecture (Edge Functions)
```
Frontend → Supabase Edge Function → Python Backend → Supabase
```

Benefits:
- Frontend only talks to Supabase
- No CORS issues
- Simpler auth (just pass access token)
- Unified Supabase ecosystem

---

## What Changed

### Removed

- ❌ `frontend/app/api/process-job/route.ts` - Next.js API route (deleted)
- ❌ `PYTHON_BACKEND_URL` from frontend environment (removed)

### Added

- ✅ `supabase-backend/functions/process-meeting/index.ts` - Updated Edge Function
- ✅ `supabase-backend/functions/get-job-status/index.ts` - New Edge Function
- ✅ `supabase-backend/.env.example` - Edge Function environment template
- ✅ `EDGE-FUNCTION-DEPLOYMENT.md` - Complete deployment guide

### Modified

- 🔄 `frontend/lib/use-job-status.ts` - Now calls Edge Functions
- 🔄 `frontend/.env.example` - Removed Python backend variables
- 🔄 `supabase-backend/config.toml` - Added get-job-status function
- 🔄 `INTEGRATION.md` - Updated with Edge Function architecture

---

## File Structure

```
chip-mono-mvp/
├── frontend/
│   ├── lib/
│   │   └── use-job-status.ts        (UPDATED - calls Edge Functions)
│   └── .env.example                 (UPDATED - removed PYTHON_BACKEND_URL)
│
├── supabase-backend/
│   ├── functions/
│   │   ├── process-meeting/
│   │   │   └── index.ts             (UPDATED - generates signed URLs)
│   │   └── get-job-status/
│   │       └── index.ts             (NEW - status polling)
│   ├── config.toml                  (UPDATED - added get-job-status)
│   └── .env.example                 (NEW - Edge Function secrets)
│
├── python-backend/
│   ├── app/routes/process.py        (EXISTING - no changes needed)
│   ├── Dockerfile                   (EXISTING - ready for Cloud Run)
│   ├── deploy.sh                    (EXISTING - deployment script)
│   └── DEPLOYMENT.md                (EXISTING - deployment guide)
│
├── EDGE-FUNCTION-DEPLOYMENT.md      (NEW - complete deployment guide)
├── INTEGRATION.md                   (UPDATED - Edge Function architecture)
└── CHI-18-REFACTORED-SUMMARY.md     (this file)
```

---

## Edge Functions

### 1. process-meeting

**Purpose:** Triggers processing of an uploaded video/audio file

**Flow:**
1. Receives `jobId` from frontend
2. Validates job exists and status is `pending`
3. Generates signed URL for Python backend (2 hour expiry)
4. Updates job status to `processing`
5. Calls Python backend with signed URL
6. Returns success response immediately (processing runs in background)

**Authentication:** Service role key (admin access)

**Configuration:**
```toml
[functions.process-meeting]
verify_jwt = false  # Edge Function handles auth manually
```

### 2. get-job-status

**Purpose:** Polls current status of a processing job

**Flow:**
1. Receives `jobId` from frontend
2. Verifies user is authenticated
3. Fetches job status from database (RLS enforced)
4. Checks if analysis results exist (if completed)
5. Returns job status and metadata

**Authentication:** User access token (RLS enforced)

**Configuration:**
```toml
[functions.get-job-status]
verify_jwt = true  # Automatic JWT verification
```

---

## Frontend Integration

### Hooks

The frontend uses two hooks to interact with Edge Functions:

#### `useProcessJob()`

Triggers processing via `process-meeting` Edge Function:

```tsx
import { useProcessJob } from '@/lib/use-job-status';

const { processJob, isProcessing, error } = useProcessJob();

const handleProcess = async () => {
  try {
    await processJob(jobId);
    console.log('Processing started!');
  } catch (err) {
    console.error('Failed to start processing:', err);
  }
};
```

#### `useJobStatus()`

Polls status via `get-job-status` Edge Function:

```tsx
import { useJobStatus } from '@/lib/use-job-status';

const { job, isLoading, error } = useJobStatus(jobId, {
  interval: 3000, // Poll every 3 seconds
  onComplete: (job) => {
    router.push(`/results/${job.id}`);
  },
  onError: (job) => {
    toast.error(`Processing failed: ${job.error}`);
  }
});

// job.status: 'uploading' | 'pending' | 'processing' | 'completed' | 'failed'
```

Both hooks:
- Automatically get user's auth token
- Call appropriate Edge Function
- Handle errors gracefully
- TypeScript typed

---

## Deployment Steps

### 1. Deploy Python Backend (if not already deployed)

```bash
cd python-backend
./deploy.sh
```

Save the Cloud Run service URL.

### 2. Deploy Edge Functions

```bash
cd supabase-backend

# Link to project
supabase link --project-ref kfikvadshmptpwscgbyu

# Set secrets
supabase secrets set PYTHON_BACKEND_URL=https://your-service.run.app
supabase secrets set PYTHON_BACKEND_API_KEY=$(openssl rand -hex 32)

# Deploy functions
supabase functions deploy process-meeting
supabase functions deploy get-job-status

# Verify
supabase functions list
```

### 3. Update Python Backend with API Key

```bash
# Get the API key you set above
API_KEY=$(supabase secrets get PYTHON_BACKEND_API_KEY)

# Update Cloud Run
gcloud run services update meeting-intelligence-backend \
  --region us-central1 \
  --update-env-vars "API_KEY=$API_KEY"
```

### 4. Test End-to-End

1. Upload a file
2. Call `processJob(jobId)`
3. Poll status with `useJobStatus(jobId)`
4. Verify results in database

Detailed testing instructions in `EDGE-FUNCTION-DEPLOYMENT.md`.

---

## Environment Configuration

### Frontend

```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://kfikvadshmptpwscgbyu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

That's it! No Python backend URL needed.

### Edge Functions

Set via Supabase CLI or Dashboard:

```bash
PYTHON_BACKEND_URL=https://your-service.run.app
PYTHON_BACKEND_API_KEY=your_secure_api_key
```

### Python Backend

```bash
# python-backend/.env
SUPABASE_URL=https://kfikvadshmptpwscgbyu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
API_KEY=same_as_edge_function_api_key
PORT=8080
CORS_ORIGINS=https://kfikvadshmptpwscgbyu.supabase.co
```

---

## Security Improvements

### Old Architecture Issues

- Frontend needed Python backend URL (exposure risk)
- CORS configuration could be misconfigured
- Harder to validate user authentication

### New Architecture Benefits

✅ **Frontend never knows Python backend URL**
- Reduces attack surface
- No direct access to processing service

✅ **Service role key only in Edge Functions**
- Never exposed to frontend
- Managed securely by Supabase

✅ **Automatic RLS enforcement**
- Users can only access their own jobs
- No manual auth checks needed

✅ **API key authentication**
- Edge Function ↔ Python backend secured
- Prevents unauthorized processing requests

---

## Local Development

### Start all services

```bash
# Terminal 1: Supabase (includes Edge Functions)
cd supabase-backend
supabase start

# Terminal 2: Python backend
cd python-backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3: Frontend
cd frontend
npm run dev
```

### Test locally

Edge Functions available at:
- `http://localhost:54321/functions/v1/process-meeting`
- `http://localhost:54321/functions/v1/get-job-status`

Frontend calls these automatically when `NEXT_PUBLIC_SUPABASE_URL` points to localhost.

---

## Monitoring

### Edge Function logs

```bash
# Real-time
supabase functions logs process-meeting --follow
supabase functions logs get-job-status --follow

# Recent logs
supabase functions logs process-meeting --limit 100
```

### Python backend logs

```bash
gcloud run services logs read meeting-intelligence-backend \
  --region us-central1 \
  --limit 100 \
  --follow
```

### Database queries

```sql
-- Check recent jobs
SELECT id, status, processing_error, created_at, updated_at
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check completed analysis
SELECT job_id, created_at
FROM meeting_analysis
ORDER BY created_at DESC
LIMIT 10;
```

---

## Cost Comparison

### Edge Functions (NEW)

- **Free tier:** 500K invocations/month
- **After free tier:** $2 per million invocations
- **Typical usage:** Free for most projects

### Next.js API Routes (OLD)

- Depends on hosting (Vercel, etc.)
- Included in hosting plan
- No separate cost

### Winner: Edge Functions

- Still free/cheap for most usage
- Better security and architecture
- Worth the (minimal) cost

---

## Testing Checklist

### Local Testing

- [ ] Supabase started locally
- [ ] Python backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Can upload file
- [ ] Can trigger processing
- [ ] Status polling works
- [ ] Edge Functions logs show activity

### Production Testing

- [ ] Edge Functions deployed
- [ ] Secrets configured (PYTHON_BACKEND_URL, API_KEY)
- [ ] Python backend deployed to Cloud Run
- [ ] Cloud Run has API_KEY environment variable
- [ ] Frontend `.env.local` updated (if needed)
- [ ] Can upload file in production
- [ ] Can trigger processing in production
- [ ] Status polling works in production
- [ ] Results saved to database
- [ ] Logs visible in Supabase Dashboard

---

## Troubleshooting

### "PYTHON_BACKEND_URL not configured"

```bash
supabase secrets set PYTHON_BACKEND_URL=https://your-service.run.app
```

### "Failed to connect to processing service"

1. Check Python backend is running:
   ```bash
   curl https://your-service.run.app/api/health
   ```

2. Check API key matches:
   ```bash
   # Edge Function secret
   supabase secrets get PYTHON_BACKEND_API_KEY

   # Cloud Run environment
   gcloud run services describe meeting-intelligence-backend \
     --region us-central1 \
     --format="value(spec.template.spec.containers[0].env[?name=='API_KEY'].value)"
   ```

### "Unauthorized" errors

- User must be logged in
- Check auth token is valid
- Verify RLS policies allow access

---

## Next Steps

### Immediate (Required)

1. ✅ Python backend deployed to Cloud Run
2. ⏳ Deploy Edge Functions to Supabase
3. ⏳ Set Edge Function secrets
4. ⏳ Test end-to-end flow

### Future Enhancements

1. **Real-time updates:** Use Supabase Realtime instead of polling
2. **Webhooks:** Python backend calls webhook when done
3. **Progress streaming:** Send updates during processing
4. **Batch processing:** Process multiple files at once
5. **Advanced analytics:** Track processing metrics

---

## Documentation

- **[EDGE-FUNCTION-DEPLOYMENT.md](./EDGE-FUNCTION-DEPLOYMENT.md)** - Complete deployment guide
- **[INTEGRATION.md](./INTEGRATION.md)** - Detailed integration guide
- **[python-backend/DEPLOYMENT.md](./python-backend/DEPLOYMENT.md)** - Python backend deployment
- **[CLAUDE.md](./CLAUDE.md)** - Full project documentation

---

## Summary

✅ **Refactored** to use Supabase Edge Functions
✅ **Removed** Next.js API routes
✅ **Improved** security and architecture
✅ **Simplified** frontend configuration
✅ **Documented** complete deployment process
✅ **Ready** for production deployment

**Next:** Deploy Edge Functions following `EDGE-FUNCTION-DEPLOYMENT.md`

---

*Last Updated: 2025-10-13*
*Linear Ticket: CHI-18*
