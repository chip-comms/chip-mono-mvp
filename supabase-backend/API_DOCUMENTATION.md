# Backend API Documentation

## Overview

This document describes the API endpoints for the Meeting Intelligence Backend. These APIs should be implemented as Next.js API routes in your frontend application.

## Base URL

Local development: `http://localhost:3000/api`

---

## Authentication

**Current**: No authentication (prototype)  
**Future**: Will add JWT tokens from Supabase Auth

---

## Endpoints

### 1. Upload Recording

Upload a video or audio file for processing.

**Endpoint**: `POST /api/upload`

**Content-Type**: `multipart/form-data`

**Request Body**:

```typescript
FormData {
  file: File;           // Video or audio file
  title?: string;       // Optional custom title (defaults to filename)
}
```

**Supported File Types**:

- `video/mp4`
- `video/webm`
- `video/quicktime` (.mov)
- `audio/mpeg` (.mp3)
- `audio/wav`
- `audio/mp4` (.m4a)

**Max File Size**: 200MB

**Response**:

```typescript
{
  success: boolean;
  recordingId?: string;  // UUID of created recording
  error?: string;        // Error message if failed
}
```

**Status Codes**:

- `200` - Success
- `400` - Invalid request (bad file type, too large, etc.)
- `500` - Server error

**Example**:

```typescript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('title', 'Team Standup - Oct 7');

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
// { success: true, recordingId: "abc-123-def-456" }
```

---

### 2. Get All Recordings

Retrieve list of all recordings with their status.

**Endpoint**: `GET /api/recordings`

**Request**: No body

**Response**:

```typescript
{
  recordings: Recording[];
  error?: string;
}

interface Recording {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  durationSeconds?: number;        // Populated after processing
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  createdAt: string;               // ISO 8601 timestamp
}
```

**Status Codes**:

- `200` - Success (even if recordings array is empty)
- `500` - Server error

**Example**:

```typescript
const response = await fetch('/api/recordings');
const data = await response.json();

// Poll this endpoint every 3 seconds to check for status updates
setInterval(async () => {
  const response = await fetch('/api/recordings');
  const { recordings } = await response.json();
  updateUI(recordings);
}, 3000);
```

---

### 3. Get Intelligence

Retrieve AI-generated intelligence for a specific recording.

**Endpoint**: `GET /api/intelligence/[id]`

**URL Parameters**:

- `id` - Recording ID (UUID)

**Request**: No body

**Response**:

```typescript
{
  intelligence: Intelligence | null;
  error?: string;
}

interface Intelligence {
  recordingId: string;
  transcript: Transcript;
  summary: string;
  actionItems: ActionItem[];
  keyTopics: KeyTopic[];
  sentiment: Sentiment;
  speakerStats: SpeakerStats[];
  communicationMetrics: CommunicationMetrics;
  createdAt: string;
}

interface Transcript {
  segments: TranscriptSegment[];
  fullText: string;
  durationSeconds: number;
  speakers: string[];
}

interface TranscriptSegment {
  start: number;        // Seconds
  end: number;          // Seconds
  text: string;
  speaker: string;      // "Speaker 1", "Speaker 2", etc.
}

interface ActionItem {
  text: string;
  priority: 'high' | 'medium' | 'low';
}

interface KeyTopic {
  topic: string;
  relevance: number;    // 0.0 to 1.0
}

interface Sentiment {
  overall: 'positive' | 'neutral' | 'negative';
  score: number;        // -1.0 to 1.0
}

interface SpeakerStats {
  speaker: string;
  durationSeconds: number;
  wordCount: number;
  percentage: number;   // % of total talk time
}

interface CommunicationMetrics {
  talkTimePercentage: number;
  speakerBreakdown: SpeakerStats[];
  averageResponseDelay: number;
  responseDelays: ResponseDelay[];
  interruptions: number;
  companyValuesAlignment: {
    overallAlignment: number;     // 0.0 to 1.0
    values: CompanyValue[];
  };
  insights: string;               // AI-generated text insights
}

interface ResponseDelay {
  afterSpeaker: string;
  delaySeconds: number;           // Negative = interruption
  context?: string;
}

interface CompanyValue {
  value: string;                  // e.g., "Collaboration"
  score: number;                  // 0.0 to 1.0
  examples: string[];             // Quotes from transcript
}
```

**Status Codes**:

- `200` - Success (check if intelligence is null)
- `404` - Intelligence not found (recording not yet processed)
- `500` - Server error

**Example**:

```typescript
const response = await fetch(`/api/intelligence/${recordingId}`);
const { intelligence, error } = await response.json();

if (intelligence) {
  // Display intelligence
  console.log('Summary:', intelligence.summary);
  console.log('Action Items:', intelligence.actionItems);
  console.log(
    'Talk Time:',
    intelligence.communicationMetrics.talkTimePercentage + '%'
  );
}
```

---

### 4. Process Recording (Internal)

This endpoint is called automatically by the upload endpoint. You typically don't need to call it directly from the frontend.

**Endpoint**: `POST /api/process`

**Request Body**:

```typescript
{
  recordingId: string; // UUID of recording to process
}
```

**Response**:

```typescript
{
  success: boolean;
  recordingId?: string;
  intelligenceId?: string;
  processingTimeSeconds?: number;
  error?: string;
}
```

---

## Frontend Integration Guide

### Recommended Flow

```typescript
// 1. Upload file
async function uploadRecording(file: File, title?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.recordingId;
}

// 2. Poll for status updates
async function pollRecordings(onUpdate: (recordings: Recording[]) => void) {
  const intervalId = setInterval(async () => {
    const response = await fetch('/api/recordings');
    const { recordings } = await response.json();
    onUpdate(recordings);
  }, 3000); // Poll every 3 seconds

  return () => clearInterval(intervalId); // Cleanup function
}

// 3. Fetch intelligence when ready
async function getIntelligence(recordingId: string) {
  const response = await fetch(`/api/intelligence/${recordingId}`);
  const { intelligence, error } = await response.json();

  if (error) {
    throw new Error(error);
  }

  return intelligence;
}

// 4. Complete flow
async function handleUpload(file: File) {
  try {
    // Upload
    const recordingId = await uploadRecording(file);

    // Poll until completed
    const stopPolling = pollRecordings((recordings) => {
      const recording = recordings.find((r) => r.id === recordingId);

      if (recording?.status === 'completed') {
        stopPolling();
        // Fetch and display intelligence
        getIntelligence(recordingId).then(displayIntelligence);
      } else if (recording?.status === 'failed') {
        stopPolling();
        console.error('Processing failed:', recording.processingError);
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
  }
}
```

---

## State Management Recommendations

### Recording States

```typescript
type RecordingStatus = 'uploading' | 'processing' | 'completed' | 'failed';

// Display appropriate UI for each state:
switch (recording.status) {
  case 'uploading':
    return <Spinner>Uploading...</Spinner>;
  case 'processing':
    return <Spinner>Processing... (1-3 min)</Spinner>;
  case 'completed':
    return <IntelligenceViewer recordingId={recording.id} />;
  case 'failed':
    return <Error>{recording.processingError}</Error>;
}
```

### React Hooks Example

```typescript
function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchRecordings();

    // Poll for updates
    const interval = setInterval(fetchRecordings, 3000);

    return () => clearInterval(interval);
  }, []);

  async function fetchRecordings() {
    const response = await fetch('/api/recordings');
    const data = await response.json();
    setRecordings(data.recordings);
    setLoading(false);
  }

  return { recordings, loading };
}
```

---

## Error Handling

All endpoints follow this error response format:

```typescript
{
  success: false,
  error: string,  // Human-readable error message
}
```

Common errors:

- `"No file provided"` - Upload without file
- `"Unsupported file type: ..."` - Wrong file format
- `"File too large. Max size: 200MB"` - File exceeds limit
- `"Recording not found"` - Invalid recording ID
- `"Intelligence not found for this recording"` - Recording not yet processed
- `"Failed to transcribe audio: ..."` - Whisper API error
- `"Failed to analyze transcript: ..."` - GPT-4 API error

---

## Performance Considerations

### Processing Time

- **Audio (10 min)**: ~1-2 minutes
- **Video (10 min)**: ~2-3 minutes (includes audio extraction)
- **Video (30 min)**: ~5-7 minutes

Processing includes:

1. Audio extraction (if video): 10-30 seconds
2. Whisper transcription: 30-60 seconds
3. GPT-4 analysis: 15-30 seconds
4. Metrics calculation: < 1 second

### Polling Strategy

- Poll `/api/recordings` every 3 seconds
- Stop polling when status is `completed` or `failed`
- Consider exponential backoff for long-running processes

### File Size Limits

- Current limit: 200MB
- Recommended: < 100MB for best performance
- Large files take longer to upload and process

---

## Video Playback

To play uploaded videos in the browser:

```typescript
// Videos are served from public/uploads/ in development
const videoUrl = `/uploads/${recording.id}.mp4`;

<video controls src={videoUrl}>
  Your browser does not support video playback.
</video>
```

**Note**: In production with Supabase, you'll need to:

1. Generate presigned URLs
2. Use Supabase Storage URLs
3. Set appropriate CORS headers

---

## Next.js Implementation

### File Structure

```
frontend/app/api/
├── upload/
│   └── route.ts          # POST /api/upload
├── process/
│   └── route.ts          # POST /api/process
├── recordings/
│   └── route.ts          # GET /api/recordings
└── intelligence/
    └── [id]/
        └── route.ts      # GET /api/intelligence/[id]
```

### Importing Backend Logic

```typescript
// In your API routes
import { transcribeAudio } from '@/supabase-backend/lib/ai/transcription';
import { analyzeTranscript } from '@/supabase-backend/lib/ai/analysis';
import { LocalStorageAdapter } from '@/supabase-backend/lib/storage/local';
import { LocalDataAdapter } from '@/supabase-backend/lib/data/local';
```

---

## Environment Variables

Required in `.env.local`:

```bash
OPENAI_API_KEY=sk-your-key-here
```

---

## Migration to Supabase Edge Functions

When migrating, these endpoints will become:

- `POST /api/upload` → Supabase Edge Function `upload`
- `POST /api/process` → Supabase Edge Function `process`
- `GET /api/recordings` → Supabase Edge Function `list-recordings`
- `GET /api/intelligence/[id]` → Supabase Edge Function `get-intelligence`

The **request/response formats stay the same**, only the base URL changes!

---

## Support

For issues or questions about the API:

1. Check `supabase-backend/lib/types.ts` for complete type definitions
2. Review `supabase-backend/api/` for implementation details
3. See `BUILD_STATUS.md` for current implementation status
