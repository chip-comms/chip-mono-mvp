# Python Backend Setup Guide

## 🎯 Quick Setup (5 minutes)

### Step 1: Install System Dependencies

You need **Python 3.10+** and **FFmpeg**.

#### macOS:

```bash
# Install Python (if not already installed)
brew install python@3.10

# Install FFmpeg
brew install ffmpeg
```

#### Ubuntu/Debian:

```bash
# Install Python
sudo apt-get update
sudo apt-get install python3.10 python3.10-venv python3-pip

# Install FFmpeg
sudo apt-get install ffmpeg
```

#### Windows:

```powershell
# Install Python from python.org or:
choco install python

# Install FFmpeg
choco install ffmpeg
```

### Step 2: Set Up Python Backend

```bash
# Navigate to python-backend directory
cd python-backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### Step 3: Verify Installation

```bash
# Check Python version
python --version
# Should show: Python 3.10.x or higher

# Check FFmpeg
ffmpeg -version
# Should show FFmpeg version info

# Check if all Python packages installed
pip list
```

### Step 4: Start the Server

```bash
# From python-backend directory (with venv activated)
uvicorn app.main:app --reload --port 8000

# OR from project root
npm run dev:python
```

Visit http://localhost:8000/docs to see the API documentation!

---

## 🚀 Running Everything Together

### Option 1: Two Terminals

**Terminal 1 - Frontend:**

```bash
cd frontend
npm run dev
```

**Terminal 2 - Python Backend:**

```bash
cd python-backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Option 2: Single Command (Recommended)

From the root directory:

```bash
npm run dev:all
```

This starts both frontend (port 3000) and Python backend (port 8000) simultaneously.

---

## 🧪 Test the Python Backend

### 1. Health Check

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "python_version": "3.10.x",
  "ffmpeg_available": true
}
```

### 2. Extract Audio from Video

```bash
# Upload a video file and get audio back
curl -X POST http://localhost:8000/api/video/extract-audio \
  -F "file=@path/to/your/video.mp4" \
  -F "format=wav" \
  --output audio.wav
```

### 3. Generate Thumbnail

```bash
curl -X POST http://localhost:8000/api/video/thumbnail \
  -F "file=@path/to/your/video.mp4" \
  -F "timestamp=5.0" \
  --output thumbnail.jpg
```

### 4. Get Video Info

```bash
curl -X POST http://localhost:8000/api/video/info \
  -F "file=@path/to/your/video.mp4"
```

---

## 🔗 Integrating with Frontend

### Example: Extract Audio in Frontend API Route

```typescript
// frontend/app/api/process/route.ts
import { PythonBackendClient } from '@/lib/python-client';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  // Extract audio using Python backend
  const audioBlob = await PythonBackendClient.extractAudio(file, 'wav');

  // Convert to buffer for transcription
  const audioBuffer = await audioBlob.arrayBuffer();
  const uint8Array = new Uint8Array(audioBuffer);

  // Now use with OpenAI Whisper...
  const transcription = await transcribeAudio(uint8Array);

  return NextResponse.json({ success: true, transcription });
}
```

### Example: Generate Thumbnail on Upload

```typescript
// frontend/app/api/upload/route.ts
import { PythonBackendClient } from '@/lib/python-client';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  // Generate thumbnail
  const thumbnailBlob = await PythonBackendClient.generateThumbnail(file, {
    timestamp: 0.0,
    width: 320,
    height: 180,
  });

  // Save thumbnail or return URL
  // ...
}
```

---

## 🐛 Troubleshooting

### "python3: command not found"

Install Python:

```bash
# macOS
brew install python@3.10

# Ubuntu
sudo apt-get install python3.10
```

### "ffmpeg: command not found"

Install FFmpeg:

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

### "ModuleNotFoundError: No module named 'fastapi'"

Activate virtual environment and install dependencies:

```bash
cd python-backend
source venv/bin/activate
pip install -r requirements.txt
```

### "Address already in use (port 8000)"

Kill the process using port 8000:

```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9

# Or change the port
uvicorn app.main:app --reload --port 8001
```

### CORS Errors

Make sure your `.env` file has the correct CORS origins:

```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## 📦 Available Endpoints

| Endpoint                   | Method | Purpose                       |
| -------------------------- | ------ | ----------------------------- |
| `/api/health`              | GET    | Health check                  |
| `/api/video/extract-audio` | POST   | Extract audio from video      |
| `/api/video/thumbnail`     | POST   | Generate video thumbnail      |
| `/api/video/info`          | POST   | Get video metadata            |
| `/api/video/compress`      | POST   | Compress video file           |
| `/docs`                    | GET    | Interactive API documentation |

---

## 🎓 Learn More

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [OpenCV Python Tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html)

---

## 🚢 Production Deployment

See the main README for Docker and systemd deployment options.

For quick production deployment:

```bash
# Install dependencies
pip install -r requirements.txt

# Run with production settings
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Consider using:

- **Docker** for containerization
- **Gunicorn + Uvicorn** for production server
- **Nginx** as reverse proxy
- **Systemd** for service management
