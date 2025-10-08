# 🚀 Deployment Guide

This project uses GitHub Actions for CI/CD and Railway for hosting the Python backend.

## 🔧 Setup Instructions

### 1. Railway Setup
1. Sign up at [railway.app](https://railway.app)
2. Generate a Railway token: 
   - Go to Railway Dashboard → Account Settings → Tokens
   - Create a new token with deployment permissions
   - Copy the token

### 2. GitHub Secrets Setup
Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

```
RAILWAY_TOKEN=your_railway_token_here
SUPABASE_URL=https://kfikvadshmptpwscgbyu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
GEMINI_API_KEY=your_gemini_api_key
PYTHON_BACKEND_URL=https://your-app.railway.app (optional, auto-updated)
```

### 3. How to Get Supabase Access Token
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your profile → Access Tokens
3. Create a new token with appropriate permissions
4. Copy the token

### 4. Deployment Workflows

We have three GitHub Actions workflows:

#### 🔄 **Complete Stack Deployment** (`deploy-complete-stack.yml`)
- **Triggers**: Changes to `python-backend/` OR `supabase/functions/`
- **Smart Detection**: Only deploys what changed
- **Coordination**: Updates Edge Functions with new Python backend URL
- **Recommended**: Use this for most deployments

#### 🐍 **Python Backend Only** (`python-backend-cicd.yml`) 
- **Triggers**: Changes to `python-backend/` only
- **Features**: Testing + Railway deployment
- **Use case**: Python-only changes

#### 🌟 **Edge Functions Only** (`deploy-edge-functions.yml`)
- **Triggers**: Changes to `supabase/functions/` only  
- **Features**: Supabase function deployment + testing
- **Use case**: Function-only changes

The workflows will:
1. **Detect** what changed (Python backend vs Edge Functions)
2. **Test** the appropriate components
3. **Deploy** only what needs updating
4. **Coordinate** between Railway and Supabase
5. **Health check** all deployments
6. **Update** Edge Function environment with new URLs

## 🔄 Automatic Deployment

Deployments happen automatically when:
- ✅ Code is pushed to `main` branch
- ✅ Changes are made to `python-backend/` directory
- ✅ All tests pass

## 🧪 Manual Deployment

You can also trigger deployments manually:
1. Go to GitHub Actions tab
2. Select "Python Backend CI/CD" workflow  
3. Click "Run workflow"

## 📍 After Deployment

After each successful deployment:

1. **Copy the Railway URL** from the GitHub Actions logs
2. **Update Supabase Edge Function**:
   ```bash
   supabase secrets set PYTHON_BACKEND_URL=https://your-app.railway.app
   ```
3. **Test the complete flow** in your frontend

## 🔍 Monitoring

- **Railway Dashboard**: Monitor app performance, logs, and metrics
- **GitHub Actions**: View deployment history and logs  
- **Supabase Dashboard**: Monitor Edge Function calls and database

## 🛠 Local Development

For local development, keep running:
```bash
# Python Backend
cd python-backend
uvicorn app.main:app --reload --port 8000

# Frontend  
cd frontend
npm run dev
```

## 📊 Architecture Flow

```
GitHub Push → GitHub Actions → Railway → Supabase Edge Function → Frontend
```

1. **Developer** pushes to main branch
2. **GitHub Actions** tests and deploys to Railway
3. **Railway** hosts the Python backend
4. **Supabase Edge Function** calls Railway backend
5. **Frontend** displays results

## 🔧 Troubleshooting

### Deployment Fails
- Check GitHub Actions logs for errors
- Verify all secrets are set correctly
- Ensure Railway token has correct permissions

### Health Check Fails
- Railway apps can take 1-2 minutes to start
- Check Railway logs in dashboard
- Verify environment variables are set

### Supabase Connection Issues
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Test connection locally first
- Check Supabase project is active

## 🎯 Production Checklist

Before going live:
- [ ] All GitHub secrets configured
- [ ] Railway deployment successful
- [ ] Supabase Edge Function updated with Railway URL
- [ ] End-to-end test completed
- [ ] Error monitoring set up
- [ ] Backup strategy in place