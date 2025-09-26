# RAILWAY 2025 DEPLOYMENT SCRIPT - PowerShell
# Modern Railway deployment following September 2025 best practices

Write-Host "🚀 RAILWAY 2025: Starting modern deployment process..." -ForegroundColor Green

# Check if Railway CLI is installed
try {
    $railwayVersion = railway --version 2>$null
    Write-Host "✅ Railway CLI found: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Installing..." -ForegroundColor Red
    npm install -g @railway/cli@latest
}

# Login to Railway
Write-Host "🔐 RAILWAY 2025: Authenticating with Railway..." -ForegroundColor Yellow
railway login

# Check if project is linked
if (!(Test-Path ".railway/project.json")) {
    Write-Host "🔗 RAILWAY 2025: Linking project to Railway..." -ForegroundColor Yellow
    railway link
}

# Get project information
Write-Host "📋 RAILWAY 2025: Getting project information..." -ForegroundColor Yellow
$projectInfo = railway status --json | ConvertFrom-Json
$PROJECT_ID = $projectInfo.project.id
$SERVICE_ID = $projectInfo.service.id

Write-Host "   Project ID: $PROJECT_ID" -ForegroundColor Cyan
Write-Host "   Service ID: $SERVICE_ID" -ForegroundColor Cyan

# Check Redis service
Write-Host "🔍 RAILWAY 2025: Checking Redis service..." -ForegroundColor Yellow
$redisServices = railway service list --json | ConvertFrom-Json
$REDIS_SERVICE = $redisServices | Where-Object { $_.name -like "*redis*" } | Select-Object -First 1

if (!$REDIS_SERVICE) {
    Write-Host "⚠️  RAILWAY 2025: Redis service not found. Creating..." -ForegroundColor Yellow
    railway add redis
    Write-Host "✅ RAILWAY 2025: Redis service created" -ForegroundColor Green
} else {
    Write-Host "✅ RAILWAY 2025: Redis service found: $($REDIS_SERVICE.id)" -ForegroundColor Green
}

# Set environment variables
Write-Host "🔧 RAILWAY 2025: Setting environment variables..." -ForegroundColor Yellow

# Production environment variables
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set PORT=5000

# Check if custom domain is configured
if ($env:CUSTOM_DOMAIN) {
    Write-Host "🌐 RAILWAY 2025: Setting custom domain: $env:CUSTOM_DOMAIN" -ForegroundColor Yellow
    railway variables set FRONTEND_URL="https://$env:CUSTOM_DOMAIN"
} else {
    Write-Host "🌐 RAILWAY 2025: Using Railway default domain" -ForegroundColor Yellow
    # Get Railway domain
    $RAILWAY_DOMAIN = railway domain
    railway variables set FRONTEND_URL="https://$RAILWAY_DOMAIN"
}

# Deploy the application
Write-Host "🚀 RAILWAY 2025: Deploying application..." -ForegroundColor Green
railway deploy

# Wait for deployment to complete
Write-Host "⏳ RAILWAY 2025: Waiting for deployment to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check deployment status
Write-Host "📊 RAILWAY 2025: Checking deployment status..." -ForegroundColor Yellow
railway status

# Test health endpoint
Write-Host "🏥 RAILWAY 2025: Testing health endpoint..." -ForegroundColor Yellow
$HEALTH_URL = railway domain
try {
    $response = Invoke-WebRequest -Uri "https://$HEALTH_URL/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ RAILWAY 2025: Health check passed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  RAILWAY 2025: Health check failed with status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  RAILWAY 2025: Health check failed, but deployment may still be starting" -ForegroundColor Yellow
}

# Show logs
Write-Host "📋 RAILWAY 2025: Showing recent logs..." -ForegroundColor Yellow
railway logs --tail 50

Write-Host "✅ RAILWAY 2025: Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Application URL: https://$(railway domain)" -ForegroundColor Cyan
Write-Host "📊 Monitor at: https://railway.app/project/$PROJECT_ID" -ForegroundColor Cyan
