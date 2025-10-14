# Railway Automatic Deployment Setup

This guide explains how to set up automatic Railway deployment triggered by GitHub pushes.

## Current Configuration

✅ **GitHub Repository**: `https://github.com/Hasbicom1/Tagent.git`
✅ **Railway Config**: `railway.json` configured with Dockerfile builder
✅ **GitHub Actions**: Workflow created at `.github/workflows/railway-deploy.yml`

## Setup Steps

### 1. Railway Project Setup

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Create a new project or select existing project
3. Connect your GitHub repository: `Hasbicom1/Tagent`
4. Set the build configuration to use the Dockerfile at `deployment/Dockerfile`

### 2. GitHub Secrets Configuration

Add these secrets to your GitHub repository settings:

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add the following secrets:

```
RAILWAY_TOKEN=your_railway_api_token
RAILWAY_SERVICE_ID=your_railway_service_id
```

**To get Railway Token:**
- Go to Railway Dashboard → Account Settings → Tokens
- Create a new token with deployment permissions

**To get Service ID:**
- Go to your Railway project → Settings → General
- Copy the Service ID

### 3. Railway Environment Variables

Ensure these environment variables are set in Railway:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=your_database_url
REDIS_PRIVATE_URL=your_redis_url
```

### 4. Automatic Deployment Triggers

The deployment will automatically trigger on:
- ✅ Push to `main` branch
- ✅ Pull request to `main` branch

### 5. Build Process

The deployment follows this process:
1. Checkout code from GitHub
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Build application (`npm run build`)
5. Deploy to Railway using Dockerfile

## Verification

After setup, test the deployment by:
1. Making a code change
2. Committing and pushing to `main` branch
3. Check GitHub Actions tab for deployment status
4. Verify deployment in Railway dashboard
5. Test the live application at your Railway URL

## Troubleshooting

- **Build fails**: Check GitHub Actions logs
- **Deployment fails**: Verify Railway secrets are correct
- **App doesn't start**: Check Railway deployment logs
- **Environment issues**: Verify all required environment variables are set

## Current Status

✅ Frontend fix pushed to GitHub
✅ GitHub Actions workflow configured
⏳ Awaiting Railway project connection setup
⏳ Awaiting GitHub secrets configuration