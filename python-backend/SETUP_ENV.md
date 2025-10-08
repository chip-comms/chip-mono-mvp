# Environment Setup Guide

## 🔑 Setting Up API Keys

This project uses environment variables for API keys. Follow these steps:

### Step 1: Copy the environment template

```bash
cd python-backend
cp .env.example .env
```

### Step 2: Add your API keys to `.env`

Open the `.env` file and add your keys:

```bash
# Get Gemini API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-actual-gemini-key-here

# Get OpenAI API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-actual-openai-key-here
```

### Step 3: Share keys with Node.js backend (optional)

If you want to use the same keys across both backends, you can:

**Option A: Create a root `.env` file**

```bash
# In project root
touch .env

# Add keys:
GEMINI_API_KEY=your-key
OPENAI_API_KEY=your-key
```

Then both frontends can reference it.

**Option B: Copy from existing location**

If you already have keys in `supabase-backend/.env` or `frontend/.env.local`:

```bash
# Copy Gemini key from wherever it exists
grep GEMINI_API_KEY ../supabase-backend/.env >> .env
# or
grep GEMINI_API_KEY ../frontend/.env.local >> .env
```

---

## 🔒 Security Notes

1. **Never commit `.env` files** to git
   - `.env` is already in `.gitignore`
   - Only commit `.env.example` (without real keys)

2. **Don't share API keys**
   - Each developer should use their own keys
   - Use separate keys for dev/staging/production

3. **Rotate keys regularly**
   - Change keys if they're exposed
   - Use different keys for different environments

---

## ✅ Verify Setup

Test that your keys are loaded correctly:

```bash
# Start Python backend
cd python-backend
source venv/bin/activate
uvicorn app.main:app --reload

# In another terminal, test the health endpoint
curl http://localhost:8000/api/health

# You should see:
# {
#   "status": "healthy",
#   "python_version": "...",
#   "ffmpeg_available": true
# }
```

To test AI providers are configured:

```python
# Run this in Python shell or script
from app.services.llm import LLMAdapter

adapter = LLMAdapter()
providers = await adapter.get_available_providers()
print(f"Available providers: {providers}")
# Should show: ["Gemini"] or ["OpenAI"] or ["Gemini", "OpenAI"]
```

---

## 🌍 Environment Variables Reference

### Required for AI Analysis

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `GEMINI_API_KEY` | Google Gemini API key | https://aistudio.google.com/app/apikey |
| `OPENAI_API_KEY` | OpenAI API key | https://platform.openai.com/api-keys |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `auto` | Preferred provider: `auto`, `openai`, `gemini`, `anthropic` |
| `PORT` | `8000` | Python backend port |
| `HOST` | `0.0.0.0` | Python backend host |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `MAX_FILE_SIZE` | `500` | Max upload size in MB |

---

## 💡 Tips

1. **Use Gemini for development** (it's cheaper)
   ```bash
   AI_PROVIDER=gemini
   ```

2. **Use OpenAI for production** (generally more accurate)
   ```bash
   AI_PROVIDER=openai
   ```

3. **Let it auto-select** (uses first available)
   ```bash
   AI_PROVIDER=auto
   ```

---

## 🐛 Troubleshooting

### "No AI provider available" error

**Problem:** No API keys configured or keys are invalid

**Solution:**
1. Check `.env` file exists in `python-backend/`
2. Verify keys are correct (not empty or placeholder)
3. Test keys work:
   ```bash
   # For Gemini
   curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=YOUR_KEY"
   ```

### Keys work in Node.js but not Python

**Problem:** Different `.env` locations

**Solution:** Make sure Python backend has its own `.env` file with keys:
```bash
cd python-backend
cat .env  # Should show your keys
```

### "ImportError: google.generativeai not found"

**Problem:** Python package not installed

**Solution:**
```bash
cd python-backend
source venv/bin/activate
pip install google-generativeai
# or
pip install -r requirements.txt
```

