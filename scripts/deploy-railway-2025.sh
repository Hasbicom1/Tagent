#!/bin/bash

# RAILWAY 2025 DEPLOYMENT SCRIPT
# Modern Railway deployment following September 2025 best practices

set -e

echo "🚀 RAILWAY 2025: Starting modern deployment process..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli@latest
fi

# Login to Railway
echo "🔐 RAILWAY 2025: Authenticating with Railway..."
railway login

# Check if project is linked
if [ ! -f ".railway/project.json" ]; then
    echo "🔗 RAILWAY 2025: Linking project to Railway..."
    railway link
fi

# Get project information
echo "📋 RAILWAY 2025: Getting project information..."
PROJECT_ID=$(railway status --json | jq -r '.project.id')
SERVICE_ID=$(railway status --json | jq -r '.service.id')

echo "   Project ID: $PROJECT_ID"
echo "   Service ID: $SERVICE_ID"

# Check Redis service
echo "🔍 RAILWAY 2025: Checking Redis service..."
REDIS_SERVICE=$(railway service list --json | jq -r '.[] | select(.name | contains("redis")) | .id' | head -1)

if [ -z "$REDIS_SERVICE" ]; then
    echo "⚠️  RAILWAY 2025: Redis service not found. Creating..."
    railway add redis
    echo "✅ RAILWAY 2025: Redis service created"
else
    echo "✅ RAILWAY 2025: Redis service found: $REDIS_SERVICE"
fi

# Set environment variables
echo "🔧 RAILWAY 2025: Setting environment variables..."

# Production environment variables
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set PORT=5000

# Check if custom domain is configured
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    echo "🌐 RAILWAY 2025: Setting custom domain: $CUSTOM_DOMAIN"
    railway variables set FRONTEND_URL="https://$CUSTOM_DOMAIN"
else
    echo "🌐 RAILWAY 2025: Using Railway default domain"
    # Get Railway domain
    RAILWAY_DOMAIN=$(railway domain)
    railway variables set FRONTEND_URL="https://$RAILWAY_DOMAIN"
fi

# Deploy the application
echo "🚀 RAILWAY 2025: Deploying application..."
railway deploy

# Wait for deployment to complete
echo "⏳ RAILWAY 2025: Waiting for deployment to complete..."
sleep 30

# Check deployment status
echo "📊 RAILWAY 2025: Checking deployment status..."
railway status

# Test health endpoint
echo "🏥 RAILWAY 2025: Testing health endpoint..."
HEALTH_URL=$(railway domain)
if curl -f "https://$HEALTH_URL/health" > /dev/null 2>&1; then
    echo "✅ RAILWAY 2025: Health check passed"
else
    echo "⚠️  RAILWAY 2025: Health check failed, but deployment may still be starting"
fi

# Show logs
echo "📋 RAILWAY 2025: Showing recent logs..."
railway logs --tail 50

echo "✅ RAILWAY 2025: Deployment completed successfully!"
echo "🌐 Application URL: https://$(railway domain)"
echo "📊 Monitor at: https://railway.app/project/$PROJECT_ID"
