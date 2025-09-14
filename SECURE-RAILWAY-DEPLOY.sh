#!/bin/bash

# 🔐 SECURE RAILWAY DEPLOYMENT FOR ONEDOLLARAGENT.AI
# Security-first deployment with proper secret management

echo "🔐 SECURE DEPLOYMENT FOR ONEDOLLARAGENT.AI"
echo "=========================================="

# Check if we're logged into Railway
if ! npx railway whoami >/dev/null 2>&1; then
    echo "🔐 Step 1: Please login to Railway..."
    npx railway login
fi

# Create new Railway project
echo "🏗️  Step 2: Creating Railway project..."
npx railway init --name "onedollaragent-ai"

# Add databases (these auto-inject correct environment variables)
echo "🗄️  Step 3: Adding PostgreSQL database..."
npx railway add --database=postgresql

echo "⚡ Step 4: Adding Redis cache..."
npx railway add --database=redis

# Set basic configuration (NO SECRETS HERE)
echo "⚙️  Step 5: Setting basic configuration..."
npx railway variables:set NODE_ENV=production
npx railway variables:set PORT=5000
npx railway variables:set HOST=0.0.0.0
npx railway variables:set FORCE_HTTPS=true

# Generate new secure secrets (DON'T hardcode them!)
echo "🔑 Step 6: Generating fresh security secrets..."
SESSION_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
npx railway variables:set SESSION_SECRET="$SESSION_SECRET"
npx railway variables:set CSRF_SECRET="$CSRF_SECRET"

# Domain configuration - will be set after deployment
echo "🌐 Step 7: Setting flexible CORS configuration..."
# Start with permissive CORS for Railway domain, will be tightened after custom domain setup
npx railway variables:set CORS_ORIGINS=https://onedollaragent.ai,https://www.onedollaragent.ai
echo "   Note: DOMAIN will be set after Railway URL is known"

echo ""
echo "⚠️  IMPORTANT: You need to manually set your API keys in Railway dashboard:"
echo "   Go to: Railway Dashboard → Your Project → Variables"
echo "   Add these variables with your actual values:"
echo "   • STRIPE_SECRET_KEY"
echo "   • VITE_STRIPE_PUBLIC_KEY" 
echo "   • OPENAI_API_KEY"
echo ""
echo "📝 Note: DATABASE_URL and REDIS_URL are automatically set by Railway services"
echo ""

# Deploy the application
echo "🚀 Step 8: Deploying to Railway..."
npx railway up --detach

echo ""
echo "🎉 SECURE DEPLOYMENT INITIATED!"
echo "=============================="
echo ""
echo "🔍 Next steps:"
echo "1. Add your API keys in Railway dashboard (Variables tab)"
echo "2. Get your Railway URL: npx railway domain" 
echo "3. Add Railway URL to CORS_ORIGINS variable in dashboard"
echo "4. Set DOMAIN variable to your Railway URL initially"
echo "5. Check deployment: npx railway status"
echo "6. View logs: npx railway logs"
echo "7. Test on Railway URL first, then add custom domain"
echo ""
echo "🔒 Security: All secrets handled safely!"