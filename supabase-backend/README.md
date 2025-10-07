# Meeting Intelligence Backend

Backend logic for the meeting intelligence assistant. This contains all the business logic, AI processing, and storage adapters.

## Structure

```
supabase-backend/
├── lib/
│   ├── ai/               # Portable AI processing (works in Node & Deno)
│   │   ├── transcription.ts   # Whisper API integration
│   │   ├── analysis.ts        # GPT-4 analysis
│   │   └── metrics.ts         # Communication metrics calculation
│   ├── storage/          # Storage adapters
│   │   └── local.ts           # Local filesystem implementation
│   ├── data/             # Data adapters
│   │   └── local.ts           # Local JSON file implementation
│   ├── types.ts          # TypeScript type definitions
│   └── config.ts         # Configuration
├── storage/              # Local file storage
│   └── uploads/          # Uploaded files
└── data/                 # Local JSON database
    ├── recordings.json   # Recordings metadata
    └── intelligence/     # Intelligence results
```

## Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY

# Create storage directories
mkdir -p storage/uploads
mkdir -p data/intelligence
echo "[]" > data/recordings.json

# Install FFmpeg (required for video processing)
# macOS:
brew install ffmpeg
# Ubuntu:
sudo apt install ffmpeg
```

## Usage

The backend code is imported by Next.js API routes in the frontend application. When you run the frontend dev server, it will use these modules.

## Migration to Supabase Edge Functions

When ready to deploy, convert the API routes to Edge Functions:

### What Stays the Same

- ✅ All `lib/ai/*` modules (100% portable)
- ✅ `lib/types.ts` (shared types)
- ✅ `lib/config.ts` (just update env vars)

### What Changes

- 🔄 `lib/storage/local.ts` → Create `lib/storage/supabase.ts`
- 🔄 `lib/data/local.ts` → Create `lib/data/supabase.ts`
- 🔄 API routes → Edge Functions (different syntax, same logic)

The portable AI modules can be directly imported into Deno edge functions!

## Testing AI Modules

You can test the portable modules independently:

```typescript
import { transcribeAudio } from './lib/ai/transcription';
import { analyzeTranscript } from './lib/ai/analysis';
import { calculateCommunicationMetrics } from './lib/ai/metrics';

// Load your audio file
const audioFile = new File([buffer], 'test.mp3', { type: 'audio/mpeg' });

// Transcribe
const transcript = await transcribeAudio(audioFile, process.env.OPENAI_API_KEY);

// Analyze
const analysis = await analyzeTranscript(
  transcript,
  process.env.OPENAI_API_KEY
);

// Calculate metrics
const metrics = calculateCommunicationMetrics(transcript);

console.log({ transcript, analysis, metrics });
```

## Dependencies

- `openai` - OpenAI API client
- `fluent-ffmpeg` - FFmpeg wrapper for audio extraction
- Standard Node.js `fs`, `path` modules (will be replaced for Deno)
