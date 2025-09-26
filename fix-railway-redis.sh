#!/bin/bash

# 🚨 RAILWAY REDIS CONNECTION FIX SCRIPT
# This script helps fix Redis connection issues in Railway deployment

echo "🚨 RAILWAY REDIS CONNECTION FIX"
echo "================================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "🔧 STEP 1: Check Railway Project Status"
echo "======================================"
railway status

echo ""
echo "🔧 STEP 2: List Services"
echo "======================"
railway service

echo ""
echo "🔧 STEP 3: Check Environment Variables"
echo "===================================="
railway variables

echo ""
echo "🔧 STEP 4: Check Redis Service (if exists)"
echo "========================================="
echo "Looking for Redis service..."

# Check if Redis service exists
REDIS_SERVICE=$(railway service | grep -i redis || echo "No Redis service found")

if [[ "$REDIS_SERVICE" == *"No Redis service found"* ]]; then
    echo "❌ No Redis service found!"
    echo ""
    echo "🔧 FIX: Create Redis service"
    echo "1. Go to Railway Dashboard"
    echo "2. Click your project"
    echo "3. Click '+ New' → 'Database' → 'Redis'"
    echo "4. Wait for deployment to complete"
    echo "5. Copy the REDIS_URL from Redis service variables"
    echo "6. Add REDIS_URL to your main application variables"
    echo ""
    echo "Then run this script again."
else
    echo "✅ Redis service found: $REDIS_SERVICE"
    echo ""
    echo "🔧 STEP 5: Get Redis Connection Details"
    echo "======================================"
    
    # Get Redis service variables
    echo "Getting Redis service variables..."
    railway variables --service redis 2>/dev/null || echo "Could not get Redis service variables"
    
    echo ""
    echo "🔧 STEP 6: Update Main Application"
    echo "=================================="
    echo "1. Copy the REDIS_URL from Redis service"
    echo "2. Go to your main application service"
    echo "3. Add/update REDIS_URL variable"
    echo "4. Redeploy the application"
fi

echo ""
echo "🔧 STEP 7: Test Connection"
echo "========================"
echo "After updating REDIS_URL, redeploy and check logs for:"
echo "✅ REDIS: Connection established successfully"
echo "✅ SECURITY: Redis connection established for session storage"

echo ""
echo "🚨 If still failing, try this manual fix:"
echo "1. Delete the Redis service completely"
echo "2. Create a new Redis service"
echo "3. Wait for full deployment"
echo "4. Copy the new REDIS_URL to your main application"
echo "5. Redeploy main application"

echo ""
echo "📞 Need help? Check the logs in Railway Dashboard → Deployments"
