#!/bin/bash

# 🚀 DEPLOY TO YOUR EXISTING RAILWAY PROJECT
# Project ID: f30acd64-58f4-4868-80fb-6dffb4d66fc1
# Project: agent-for-all

echo "🚀 DEPLOYING TO YOUR RAILWAY PROJECT (agent-for-all)"
echo "=================================================="

# Link to your existing project
echo "🔗 Step 1: Linking to your Railway project..."
npx railway link f30acd64-58f4-4868-80fb-6dffb4d66fc1

# Add databases if not already present
echo "🗄️  Step 2: Adding databases (if needed)..."
echo "   Adding PostgreSQL..."
npx railway add --database=postgresql || echo "   PostgreSQL already exists"

echo "   Adding Redis..."
npx railway add --database=redis || echo "   Redis already exists"

# Set production configuration
echo "⚙️  Step 3: Setting production environment variables..."
npx railway variables:set NODE_ENV=production
npx railway variables:set PORT=5000
npx railway variables:set HOST=0.0.0.0
npx railway variables:set FORCE_HTTPS=true

# Generate fresh security secrets
echo "🔐 Step 4: Generating fresh security secrets..."
SESSION_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
npx railway variables:set SESSION_SECRET="$SESSION_SECRET"
npx railway variables:set CSRF_SECRET="$CSRF_SECRET"

# Get Railway domain for CORS
echo "🌐 Step 5: Getting your Railway domain..."
RAILWAY_DOMAIN=$(npx railway domain | grep -o 'https://[^[:space:]]*')
echo "   Your Railway domain: $RAILWAY_DOMAIN"

# Set flexible CORS configuration
echo "🔧 Step 6: Setting CORS configuration..."
if [ -n "$RAILWAY_DOMAIN" ]; then
    npx railway variables:set CORS_ORIGINS="https://onedollaragent.ai,https://www.onedollaragent.ai,$RAILWAY_DOMAIN"
    npx railway variables:set DOMAIN="$(echo $RAILWAY_DOMAIN | sed 's|https://||')"
    echo "   ✅ CORS configured for both Railway and custom domain"
else
    npx railway variables:set CORS_ORIGINS="https://onedollaragent.ai,https://www.onedollaragent.ai"
    echo "   ⚠️  Railway domain not detected - CORS set for custom domain only"
fi

# Production security settings
echo "🛡️  Step 7: Setting production security..."
npx railway variables:set VNC_ENABLE=false
npx railway variables:set ENABLE_SESSION_VALIDATION=true
npx railway variables:set ENABLE_RATE_LIMITING=true

echo ""
echo "⚠️  CRITICAL: Add your API keys in Railway dashboard NOW:"
echo "   1. Go to: https://railway.app/project/f30acd64-58f4-4868-80fb-6dffb4d66fc1"
echo "   2. Click your main service → Variables tab"
echo "   3. Add these variables:"
echo "      • STRIPE_SECRET_KEY (from Stripe dashboard)"
echo "      • VITE_STRIPE_PUBLIC_KEY (from Stripe dashboard)"
echo "      • OPENAI_API_KEY (from OpenAI dashboard)"
echo ""

# Deploy
echo "🚀 Step 8: Deploying your AI platform..."
npx railway up --detach

echo ""
echo "🎉 DEPLOYMENT TO RAILWAY COMPLETE!"
echo "================================="
echo ""
echo "📍 Your project: https://railway.app/project/f30acd64-58f4-4868-80fb-6dffb4d66fc1"
if [ -n "$RAILWAY_DOMAIN" ]; then
    echo "🌐 Your app: $RAILWAY_DOMAIN"
fi
echo "🏠 Custom domain: onedollaragent.ai (add in Railway dashboard)"
echo ""
echo "🔍 Monitor deployment:"
echo "   npx railway logs"
echo "   npx railway status"
echo ""
echo "✅ Ready for production traffic!"