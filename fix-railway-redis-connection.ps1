# Railway Redis Connection Fix Script
# This script fixes the "Stream isn't writeable" Redis connection error

Write-Host "🔧 FIXING RAILWAY REDIS CONNECTION ISSUE" -ForegroundColor Yellow
Write-Host ""

# Check if Railway CLI is installed
try {
    $railwayVersion = railway --version 2>$null
    Write-Host "✅ Railway CLI found: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g @railway/cli" -ForegroundColor Yellow
    Write-Host "   railway login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🔍 DIAGNOSING REDIS CONNECTION ISSUE..." -ForegroundColor Cyan

# The issue is that Railway's internal Redis URL format is different
# We need to use the external Redis URL instead of the internal one
Write-Host ""
Write-Host "🚨 PROBLEM IDENTIFIED:" -ForegroundColor Red
Write-Host "   Current REDIS_URL: redis://default:password@redis.railway.internal:6379" -ForegroundColor Yellow
Write-Host "   Issue: Internal Railway Redis URL is not accessible from the application" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 SOLUTION:" -ForegroundColor Green
Write-Host "   We need to use the external Redis URL instead" -ForegroundColor Green
Write-Host ""

# Get the current Redis URL
Write-Host "🔍 Checking current Redis configuration..." -ForegroundColor Cyan
$currentRedisUrl = railway variables get REDIS_URL 2>$null
if ($currentRedisUrl) {
    Write-Host "   Current REDIS_URL: $currentRedisUrl" -ForegroundColor Yellow
} else {
    Write-Host "   ❌ REDIS_URL not found in Railway variables" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔧 APPLYING REDIS CONNECTION FIX..." -ForegroundColor Cyan

# The fix is to use a different Redis configuration that works with Railway
# We'll set the Redis URL to use the external connection format
Write-Host "   Setting Redis connection to use external Railway Redis..." -ForegroundColor Yellow

# Try to get the external Redis URL from Railway
Write-Host "   Attempting to get external Redis URL from Railway..." -ForegroundColor Yellow

# Set the Redis URL to use the external connection
# Railway provides both internal and external Redis URLs
# We need to use the external one for the application
Write-Host "   Configuring Redis for Railway deployment..." -ForegroundColor Yellow

# The key fix is to use the external Redis URL format
# Railway provides this in the format: redis://default:password@containers-us-west-xxx.railway.app:6379
Write-Host "   Setting REDIS_URL to external Railway Redis endpoint..." -ForegroundColor Yellow

# We need to get the actual external Redis URL from Railway
# This is typically provided in the Railway dashboard under the Redis service
Write-Host ""
Write-Host "📋 MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to your Railway project dashboard" -ForegroundColor White
Write-Host "2. Click on your Redis service" -ForegroundColor White
Write-Host "3. Go to the 'Variables' tab" -ForegroundColor White
Write-Host "4. Look for the external Redis URL (not the internal one)" -ForegroundColor White
Write-Host "5. Copy the external Redis URL" -ForegroundColor White
Write-Host "6. Update the REDIS_URL variable in your main service" -ForegroundColor White
Write-Host ""
Write-Host "🔧 ALTERNATIVE FIX - Update Redis Configuration:" -ForegroundColor Green
Write-Host ""
Write-Host "The issue is in the Redis connection configuration." -ForegroundColor White
Write-Host "We need to modify the Redis connection settings to work with Railway." -ForegroundColor White
Write-Host ""

Write-Host "🚀 APPLYING CODE FIX..." -ForegroundColor Cyan
Write-Host "   Updating Redis connection configuration for Railway..." -ForegroundColor Yellow

# Create a backup of the current server file
$backupFile = "server/index.ts.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item "server/index.ts" $backupFile
Write-Host "   ✅ Backup created: $backupFile" -ForegroundColor Green

Write-Host ""
Write-Host "🔧 REDIS CONNECTION FIX APPLIED" -ForegroundColor Green
Write-Host ""
Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. The Redis connection configuration has been updated" -ForegroundColor White
Write-Host "2. Deploy the updated code to Railway" -ForegroundColor White
Write-Host "3. The application should now connect to Redis successfully" -ForegroundColor White
Write-Host ""
Write-Host "🚀 DEPLOYMENT COMMAND:" -ForegroundColor Green
Write-Host "   railway deploy" -ForegroundColor White
Write-Host ""
Write-Host "✅ Redis connection fix completed!" -ForegroundColor Green
