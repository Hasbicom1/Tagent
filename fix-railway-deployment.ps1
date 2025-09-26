# 🚀 RAILWAY DEPLOYMENT FIX SCRIPT (PowerShell)
# This script helps you set the missing environment variables

Write-Host "🔧 FIXING RAILWAY DEPLOYMENT - MISSING ENVIRONMENT VARIABLES" -ForegroundColor Cyan
Write-Host ""

# Check if Railway CLI is installed
try {
    railway --version | Out-Null
    Write-Host "✅ Railway CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g @railway/cli" -ForegroundColor Yellow
    Write-Host "   railway login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Get Stripe keys from user
Write-Host "🔑 STRIPE CONFIGURATION:" -ForegroundColor Yellow
Write-Host "Please provide your Stripe publishable key:"
Write-Host "   Get it from: https://dashboard.stripe.com/apikeys"
Write-Host "   Should start with: pk_test_ or pk_live_"
$STRIPE_PUBLIC_KEY = Read-Host "VITE_STRIPE_PUBLIC_KEY"

Write-Host ""
Write-Host "🌐 FRONTEND URL CONFIGURATION:" -ForegroundColor Yellow
Write-Host "Enter your production frontend URL:"
Write-Host "   Railway domain: https://your-app-name.railway.app"
Write-Host "   Custom domain: https://www.onedollaragent.ai"
$FRONTEND_URL = Read-Host "FRONTEND_URL"

Write-Host ""
Write-Host "🚀 SETTING ENVIRONMENT VARIABLES..." -ForegroundColor Cyan

# Set the variables
railway variables set VITE_STRIPE_PUBLIC_KEY="$STRIPE_PUBLIC_KEY"
railway variables set FRONTEND_URL="$FRONTEND_URL"

Write-Host ""
Write-Host "✅ ENVIRONMENT VARIABLES SET SUCCESSFULLY!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 TRIGGERING NEW DEPLOYMENT..." -ForegroundColor Cyan

# Trigger redeploy
railway redeploy

Write-Host ""
Write-Host "🎉 DEPLOYMENT FIXED!" -ForegroundColor Green
Write-Host "   Check your Railway dashboard for deployment status"
Write-Host "   Your app should be accessible at: $FRONTEND_URL"
