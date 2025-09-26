# 🚨 RAILWAY REDIS CONNECTION FIX SCRIPT (PowerShell)
# This script helps fix Redis connection issues in Railway deployment

Write-Host "🚨 RAILWAY REDIS CONNECTION FIX" -ForegroundColor Red
Write-Host "================================" -ForegroundColor Red
Write-Host ""

# Check if Railway CLI is installed
try {
    railway --version | Out-Null
    Write-Host "✅ Railway CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Installing..." -ForegroundColor Red
    npm install -g @railway/cli
}

Write-Host ""
Write-Host "🔧 STEP 1: Check Railway Project Status" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
railway status

Write-Host ""
Write-Host "🔧 STEP 2: List Services" -ForegroundColor Yellow
Write-Host "======================" -ForegroundColor Yellow
railway service

Write-Host ""
Write-Host "🔧 STEP 3: Check Environment Variables" -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Yellow
railway variables

Write-Host ""
Write-Host "🔧 STEP 4: Check Redis Service (if exists)" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "Looking for Redis service..."

# Check if Redis service exists
$redisService = railway service | Select-String -Pattern "redis" -CaseSensitive:$false

if (-not $redisService) {
    Write-Host "❌ No Redis service found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 FIX: Create Redis service" -ForegroundColor Yellow
    Write-Host "1. Go to Railway Dashboard"
    Write-Host "2. Click your project"
    Write-Host "3. Click '+ New' → 'Database' → 'Redis'"
    Write-Host "4. Wait for deployment to complete"
    Write-Host "5. Copy the REDIS_URL from Redis service variables"
    Write-Host "6. Add REDIS_URL to your main application variables"
    Write-Host ""
    Write-Host "Then run this script again."
} else {
    Write-Host "✅ Redis service found: $redisService" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔧 STEP 5: Get Redis Connection Details" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor Yellow
    
    # Get Redis service variables
    Write-Host "Getting Redis service variables..."
    try {
        railway variables --service redis
    } catch {
        Write-Host "Could not get Redis service variables" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "🔧 STEP 6: Update Main Application" -ForegroundColor Yellow
    Write-Host "==================================" -ForegroundColor Yellow
    Write-Host "1. Copy the REDIS_URL from Redis service"
    Write-Host "2. Go to your main application service"
    Write-Host "3. Add/update REDIS_URL variable"
    Write-Host "4. Redeploy the application"
}

Write-Host ""
Write-Host "🔧 STEP 7: Test Connection" -ForegroundColor Yellow
Write-Host "========================" -ForegroundColor Yellow
Write-Host "After updating REDIS_URL, redeploy and check logs for:"
Write-Host "✅ REDIS: Connection established successfully" -ForegroundColor Green
Write-Host "✅ SECURITY: Redis connection established for session storage" -ForegroundColor Green

Write-Host ""
Write-Host "🚨 If still failing, try this manual fix:" -ForegroundColor Red
Write-Host "1. Delete the Redis service completely"
Write-Host "2. Create a new Redis service"
Write-Host "3. Wait for full deployment"
Write-Host "4. Copy the new REDIS_URL to your main application"
Write-Host "5. Redeploy main application"

Write-Host ""
Write-Host "📞 Need help? Check the logs in Railway Dashboard → Deployments" -ForegroundColor Cyan
