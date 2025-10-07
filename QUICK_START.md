# Quick Start Guide

## How to Run the Backend + Frontend

The backend is a **library** that runs inside your Next.js app. There's only ONE server to run.

---

## Setup (One-time)

### 1. Install Backend Dependencies

```bash
cd supabase-backend
npm install
```

This installs:
- `openai` - OpenAI API client
- `fluent-ffmpeg` - Audio extraction
- `formidable` - File upload parsing
- `uuid` - ID generation

### 2. Install FFmpeg (Required)

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### 3. Setup Frontend (If not already done)

```bash
cd ../frontend

# If Next.js not initialized yet:
npx create-next-app@latest . --typescript --tailwind --app

npm install
```

### 4. Create Environment Variables

```bash
# In the frontend directory
cd frontend
echo "OPENAI_API_KEY=sk-your-actual-key-here" > .env.local
```

Get your OpenAI API key from: https://platform.openai.com/api-keys

### 5. Create Required Directories

```bash
# Still in frontend directory
mkdir -p public/uploads
mkdir -p ../supabase-backend/storage/uploads
mkdir -p ../supabase-backend/data/intelligence

# Create empty recordings file
echo "[]" > ../supabase-backend/data/recordings.json
```

### 6. Link Backend to Frontend

Your Next.js API routes will import from `supabase-backend/`:

```typescript
// Example: frontend/app/api/upload/route.ts
import { LocalStorageAdapter } from '../../../supabase-backend/lib/storage/local';
import { transcribeAudio } from '../../../supabase-backend/lib/ai/transcription';
```

**Note**: You may need to add to `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/supabase-backend/*": ["../supabase-backend/*"]
    }
  }
}
```

---

## Running the App

### Development Mode

```bash
# From the frontend directory
cd frontend
npm run dev
```

This starts the Next.js dev server on `http://localhost:3000`

**That's it!** The Next.js server will:
- ✅ Serve the React frontend
- ✅ Run the API routes (which use the backend logic)
- ✅ Handle file uploads
- ✅ Process recordings with AI

### What's Running

```
Terminal:
├─ Next.js Dev Server (localhost:3000)
│  ├─ Frontend pages (React)
│  └─ API routes (imports supabase-backend/lib/)
```

Only **ONE** process is running!

---

## Testing the Setup

### 1. Check the Server

```bash
cd frontend
npm run dev
```

You should see:
```
> next dev
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in X.Xs
```

### 2. Test API Endpoint

Open another terminal and test:

```bash
# Test the recordings endpoint
curl http://localhost:3000/api/recordings
```

Should return:
```json
{"recordings":[]}
```

### 3. Upload a Test File

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/test-video.mp4" \
  -F "title=Test Recording"
```

Should return:
```json
{"success":true,"recordingId":"abc-123-..."}
```

---

## Project Structure

```
chip-mono-mvp/
├── frontend/                    # Next.js app (run this)
│   ├── app/
│   │   ├── api/                 # API routes (you create these)
│   │   │   ├── upload/route.ts
│   │   │   ├── process/route.ts
│   │   │   └── recordings/route.ts
│   │   ├── components/          # React components
│   │   └── page.tsx             # Main page
│   ├── public/
│   │   └── uploads/             # Uploaded files served here
│   └── package.json
│
└── supabase-backend/            # Backend logic (imported)
    ├── lib/                     # Portable AI logic
    │   ├── ai/                  # ← Imported by API routes
    │   ├── storage/             # ← Imported by API routes
    │   └── data/                # ← Imported by API routes
    ├── api/                     # Reference implementations
    ├── storage/                 # Local file storage
    ├── data/                    # Local JSON database
    └── package.json
```

---

## Common Issues

### Issue: "Cannot find module '@/supabase-backend/...'"

**Solution**: Update `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/supabase-backend/*": ["../supabase-backend/*"]
    }
  }
}
```

Then restart the dev server.

---

### Issue: "FFmpeg not found"

**Solution**: Install FFmpeg:
```bash
brew install ffmpeg  # macOS
```

Verify installation:
```bash
ffmpeg -version
```

---

### Issue: "OpenAI API key not found"

**Solution**: Create `frontend/.env.local`:
```bash
OPENAI_API_KEY=sk-your-key-here
```

Restart the dev server after adding env vars.

---

### Issue: "ENOENT: no such file or directory"

**Solution**: Create required directories:
```bash
mkdir -p public/uploads
mkdir -p ../supabase-backend/storage/uploads
mkdir -p ../supabase-backend/data/intelligence
echo "[]" > ../supabase-backend/data/recordings.json
```

---

## Development Workflow

### 1. Make Changes to Backend Logic

```bash
# Edit files in supabase-backend/lib/
vim supabase-backend/lib/ai/transcription.ts
```

### 2. Restart Next.js Server

Next.js hot reload should pick up changes, but if not:
```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

### 3. Test Changes

Upload a file and check the results.

---

## Environment Variables

Required in `frontend/.env.local`:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-your-key-here

# Optional: Customize limits
MAX_FILE_SIZE_MB=200
```

---

## What Happens When You Upload

```
1. User uploads file in browser
   ↓
2. POST /api/upload (Next.js API route)
   ↓
3. LocalStorageAdapter saves file
   ↓
4. LocalDataAdapter creates recording entry
   ↓
5. POST /api/process triggered (background)
   ↓
6. transcribeAudio() called (Whisper API)
   ↓
7. analyzeTranscript() called (GPT-4)
   ↓
8. calculateCommunicationMetrics() called
   ↓
9. Intelligence saved to data/intelligence/
   ↓
10. Recording status updated to 'completed'
    ↓
11. Frontend polls and displays results
```

All happens in the **same Next.js process**!

---

## Stopping the Server

```bash
# In the terminal running npm run dev
Ctrl + C
```

---

## Production Notes

This setup is for **local development only**. For production:

1. Deploy frontend to Vercel
2. Migrate backend logic to Supabase Edge Functions
3. Replace LocalStorageAdapter with SupabaseStorageAdapter
4. Replace LocalDataAdapter with SupabaseDataAdapter
5. Add authentication

See `supabase-backend/API_DOCUMENTATION.md` for migration guide.

---

## Next Steps

1. ✅ Run `npm run dev` in frontend/
2. ✅ Upload a test file
3. ✅ Check `supabase-backend/storage/uploads/` for file
4. ✅ Check `supabase-backend/data/recordings.json` for entry
5. ✅ Wait for processing (~2 min)
6. ✅ Check `supabase-backend/data/intelligence/` for results
7. ✅ View in browser at http://localhost:3000

**You're ready to build!** 🚀

