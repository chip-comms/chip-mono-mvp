# Frontend-Backend Integration Guide

This document explains how the Next.js frontend integrates with the Python backend for video/audio processing.

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Next.js       │      │  Supabase Edge   │      │  Python Backend  │
│   Frontend      │─────▶│    Functions     │─────▶│    (FastAPI)     │
│                 │      │                  │      │   Cloud Run      │
└─────────────────┘      └──────────────────┘      └──────────────────┘
        │                         │                         │
        │                         ▼                         ▼
        │                ┌─────────────────┐               │
        └───────────────▶│   Supabase      │◀──────────────┘
                         │  (Database +    │
                         │   Storage)      │
                         └─────────────────┘

Frontend → Supabase Edge Function → Python Backend → Database/Storage
```

**Key Principle:** Frontend never calls Python backend directly. All communication goes through Supabase Edge Functions for security and proper authentication handling.

## Processing Flow

### 1. File Upload (CHI-17 ✅)

**Endpoint:** `POST /api/upload`

**Flow:**

1. User selects video/audio file in frontend
2. File is uploaded directly to Supabase Storage bucket `recordings`
3. Processing job record created in `processing_jobs` table with status `pending`
4. Signed URL generated for Python backend access

**Storage Path Format:**

```
recordings/{user_id}/{year}/{month}/{job_id}.{ext}
```

**Response:**

```json
{
  "success": true,
  "jobId": "uuid-here",
  "storagePath": "user-id/2025/10/job-id.mp4",
  "signedUrl": "https://...",
  "message": "File uploaded successfully"
}
```

### 2. Trigger Processing

**Endpoint:** Supabase Edge Function `process-meeting`

**Frontend Call:**

```tsx
import { useProcessJob } from '@/lib/use-job-status';

const { processJob } = useProcessJob();
await processJob(jobId);
```

**What happens:**

1. Frontend calls Supabase Edge Function with auth token
2. Edge Function validates job exists and status is `pending`
3. Generates fresh signed URL for file download (2 hour expiry)
4. Updates job status to `processing`
5. Calls Python backend at `/api/process` with signed URL
6. Returns immediately (processing happens in background)

**Response:**

```json
{
  "success": true,
  "jobId": "uuid-here",
  "pythonJobId": "py_uuid-here",
  "message": "Processing started"
}
```

### 3. Python Backend Processing

**Endpoint:** `POST /api/process` (Python backend)

**What happens:**

1. Receives job request with signed URL
2. Starts background task (returns immediately)
3. Downloads file from Supabase Storage
4. **Transcription:** Uses WhisperX for speech-to-text with timestamps
5. **Diarization:** Uses pyannote.audio for speaker identification
6. **AI Analysis:** Uses Gemini/OpenAI to generate:
   - Summary
   - Key topics
   - Action items
   - Effectiveness score
7. **Speaker Stats:** Calculates talk time, word count, percentages
8. **Saves Results:** Writes to `meeting_analysis` table
9. **Updates Status:** Changes job status to `completed` or `failed`

**Background Task:**

- Runs asynchronously (doesn't block API response)
- Updates database directly via Supabase service role key
- Cleans up temporary files after processing
- Logs progress with `[Job {job_id}]` prefix

### 4. Status Polling

**Endpoint:** Supabase Edge Function `get-job-status`

**Frontend Usage:**

```tsx
import { useJobStatus } from '@/lib/use-job-status';

const { job, isLoading, error } = useJobStatus(jobId, {
  interval: 3000, // Poll every 3 seconds
  onComplete: (job) => {
    router.push(`/results/${job.id}`);
  },
  onError: (job) => {
    toast.error(`Processing failed: ${job.error}`);
  },
});
```

The hook automatically calls the Edge Function with the user's auth token.

**Response:**

```json
{
  "success": true,
  "job": {
    "id": "uuid-here",
    "status": "processing",
    "error": null,
    "createdAt": "2025-10-13T...",
    "updatedAt": "2025-10-13T...",
    "hasAnalysis": false
  }
}
```

**Job Status States:**

- `uploading` - File is being uploaded to Supabase
- `pending` - Upload complete, waiting to start processing
- `processing` - Python backend is currently processing
- `completed` - Processing successful, results available
- `failed` - Processing failed (see `error` field)

### 5. View Results

**Location:** `meeting_analysis` table

**Data Structure:**

```json
{
  "id": "uuid",
  "job_id": "uuid",
  "user_id": "uuid",
  "transcript": {
    "text": "Full transcript...",
    "segments": [
      {
        "start": 0.0,
        "end": 5.2,
        "text": "Hello everyone",
        "speaker": "SPEAKER_00"
      }
    ]
  },
  "summary": "This meeting discussed...",
  "speaker_stats": {
    "SPEAKER_00": {
      "total_time": 120.5,
      "word_count": 350,
      "segments": 15,
      "percentage": 45.2
    }
  },
  "communication_metrics": {
    "overall_score": 75,
    "key_topics": ["Project timeline", "Budget"],
    "action_items": ["Review proposal by Friday"]
  },
  "behavioral_insights": null
}
```

## Environment Configuration

### Frontend (`frontend/.env.local`)

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

NODE_ENV=development
```

### Supabase Edge Functions (Set in Dashboard > Edge Functions > Secrets)

```bash
# Python Backend Configuration
PYTHON_BACKEND_URL=https://your-service.run.app
PYTHON_BACKEND_API_KEY=your_secure_api_key

# Note: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY
# are automatically available in Edge Functions
```

### Python Backend (`python-backend/.env`)

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # NOT anon key!

# AI Provider (at least one required)
GEMINI_API_KEY=your_gemini_key
# OPENAI_API_KEY=sk-your-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

AI_PROVIDER=gemini

# Server
PORT=8000
HOST=0.0.0.0

# CORS
CORS_ORIGINS=http://localhost:3000

# Optional: API Key for request authentication
API_KEY=your_secure_api_key
```

## Security

### 1. Row Level Security (RLS)

All database operations enforce RLS policies:

- Users can only access their own jobs
- Users can only access their own analysis results
- Enforced via `user_id = auth.uid()` check

### 2. Service Role Key

**CRITICAL:** The Python backend uses the Supabase service role key to:

- Download files from Storage (bypasses RLS for performance)
- Write to database tables
- Update job status

**Never expose the service role key in:**

- Frontend code
- Git repositories
- Client-side environment variables

**Best practices:**

- Store in Cloud Secret Manager (production)
- Use `.env` file locally (not committed to git)
- Rotate keys periodically

### 3. Signed URLs

Files are accessed via time-limited signed URLs:

- Generated by Next.js API route (server-side)
- 2 hour expiry
- Single-use recommended (though not enforced)
- Cannot be used to access other users' files

### 4. API Authentication (Optional but Recommended)

**Setup:**

1. Generate secure random API key:

   ```bash
   openssl rand -hex 32
   ```

2. Add to both environments:
   - Frontend: `PYTHON_BACKEND_API_KEY=xxx`
   - Python: `API_KEY=xxx`

3. Python backend validates `X-API-Key` header

**When to use:**

- Production deployments
- When Python backend is publicly accessible
- To prevent unauthorized processing requests

## Error Handling

### Upload Errors

```tsx
try {
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    // Handle validation errors
    toast.error(data.message);
  }
} catch (error) {
  // Handle network errors
  toast.error('Upload failed. Please try again.');
}
```

### Processing Errors

Processing errors are saved to `processing_jobs.processing_error`:

```tsx
const { job } = useJobStatus(jobId);

if (job?.status === 'failed') {
  console.error('Processing error:', job.error);
  // Display user-friendly error message
}
```

**Common errors:**

- `"Failed to download file"` - Signed URL expired or invalid
- `"Transcription failed"` - Audio quality issues or unsupported format
- `"Backend not configured"` - PYTHON_BACKEND_URL not set
- `"Failed to connect to processing service"` - Python backend unreachable

### Retry Logic

```tsx
const { processJob } = useProcessJob();

const handleRetry = async (jobId: string) => {
  // Reset job status to pending
  await fetch('/api/jobs/reset', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  });

  // Trigger processing again
  await processJob(jobId);
};
```

## Testing

### 1. Local Development

**Start all services:**

```bash
# Terminal 1: Frontend
npm run dev:frontend

# Terminal 2: Python Backend
cd python-backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Test upload:**

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.mp4" \
  -H "Cookie: your-auth-cookie"
```

**Test processing:**

```bash
curl -X POST http://localhost:3000/api/process-job \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"jobId": "your-job-id"}'
```

### 2. Python Backend Testing

**Health check:**

```bash
curl http://localhost:8000/api/health
```

**Direct process call (for debugging):**

```bash
curl -X POST http://localhost:8000/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "job_id": "test-job",
    "user_id": "test-user",
    "file_url": "https://signed-url...",
    "original_filename": "test.mp4",
    "storage_path": "test/path.mp4"
  }'
```

### 3. Cloud Run Testing

After deployment:

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe meeting-intelligence-backend \
  --region us-central1 \
  --format="value(status.url)")

# Test health endpoint
curl $SERVICE_URL/api/health

# Test process endpoint
curl -X POST $SERVICE_URL/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"job_id": "test", ...}'
```

## Monitoring

### Logs

**Frontend (Next.js):**

```bash
# Vercel deployment
vercel logs

# Local development
# Check terminal where npm run dev is running
```

**Python Backend (Cloud Run):**

```bash
# View recent logs
gcloud run services logs read meeting-intelligence-backend \
  --region us-central1 \
  --limit 100

# Follow logs in real-time
gcloud run services logs tail meeting-intelligence-backend \
  --region us-central1
```

### Database

**Check job status:**

```sql
SELECT id, status, processing_error, created_at, updated_at
FROM processing_jobs
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

**Check analysis results:**

```sql
SELECT job_id, summary, created_at
FROM meeting_analysis
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

### Metrics

**Cloud Run Console:**

- Request count
- Request latency
- Error rate
- Instance count
- Memory usage
- CPU utilization

**Key metrics to monitor:**

- Average processing time per job
- Success rate (completed / total)
- Error rate
- Storage usage

## Deployment Checklist

- [ ] Python backend deployed to Cloud Run
- [ ] Secrets configured in Cloud Secret Manager
- [ ] `PYTHON_BACKEND_URL` set in frontend environment
- [ ] `CORS_ORIGINS` includes production frontend URL
- [ ] API key authentication enabled (optional)
- [ ] RLS policies verified in Supabase
- [ ] Health check endpoint responding
- [ ] Test upload → process → results flow
- [ ] Error handling tested
- [ ] Monitoring and logging configured

## Troubleshooting

### "Backend not configured" error

**Cause:** `PYTHON_BACKEND_URL` not set in frontend environment

**Fix:**

```bash
# frontend/.env.local
PYTHON_BACKEND_URL=https://your-service.run.app
```

### "Failed to connect to processing service"

**Causes:**

1. Python backend not running
2. Wrong URL in `PYTHON_BACKEND_URL`
3. CORS issues
4. Network connectivity

**Debug:**

```bash
# Test health endpoint
curl https://your-service.run.app/api/health

# Check CORS headers
curl -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  https://your-service.run.app/api/process
```

### Processing takes too long

**Causes:**

1. Large file size
2. Long audio duration
3. Resource constraints (CPU/memory)

**Solutions:**

- Increase Cloud Run memory (2Gi → 4Gi)
- Increase timeout (300s → 600s)
- Use GPU instances (if available)
- Implement queue system for batch processing

### "Signed URL expired" error

**Cause:** Processing took longer than 2 hours

**Fix:**

- Increase signed URL expiry time in upload route
- Or implement URL refresh mechanism

## Next Steps

After basic integration is working:

1. **Real-time Updates:** Replace polling with WebSockets or Server-Sent Events
2. **Queue System:** Implement job queue (Bull, BullMQ) for better scaling
3. **Webhooks:** Python backend calls webhook when processing completes
4. **Progress Updates:** Stream processing progress to frontend
5. **Batch Processing:** Support processing multiple files at once
6. **Video Analysis:** Add face detection, emotion recognition
7. **Advanced Metrics:** Calculate all 13 communication metrics
8. **Company Values:** Implement configurable values alignment scoring
