#!/bin/bash

# 🚀 Agent HQ - Simple Railway Deployment
# Uses existing API keys from Replit environment
# Usage: ./scripts/simple-deploy.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 AGENT HQ - SIMPLE DEPLOYMENT"
echo "Using your existing API keys..."
echo ""

# Check Railway CLI
if ! command -v railway >/dev/null 2>&1; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   Mac: brew install railway"
    echo "   Other: curl -fsSL https://railway.app/install.sh | sh"
    exit 1
fi

# Check Railway auth
if ! railway whoami > /dev/null 2>&1; then
    echo "🔐 Please log in to Railway first:"
    railway login
fi

echo -e "${GREEN}✅ Railway ready!${NC}"

# Create Railway project
echo -e "${BLUE}📦 Creating Railway project...${NC}"
if ! railway status > /dev/null 2>&1; then
    railway new
fi

# Create railway.toml configuration
echo -e "${BLUE}⚙️ Setting up configuration...${NC}"
cat > railway.toml <<EOF
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"

[[services]]
name = "agent-hq"
EOF

# Set environment variables using existing keys
echo -e "${BLUE}🔑 Setting up API keys...${NC}"
railway variables set NODE_ENV=production
railway variables set PORT=5000
railway variables set HOST=0.0.0.0

# Use existing API keys from environment
if [ -n "$OPENAI_API_KEY" ]; then
    railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
    echo -e "${GREEN}✅ OpenAI API key configured${NC}"
fi

if [ -n "$DEEPSEEK_API_KEY" ]; then
    railway variables set DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY"
    echo -e "${GREEN}✅ DeepSeek API key configured${NC}"
fi

if [ -n "$STRIPE_SECRET_KEY" ]; then
    railway variables set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
    echo -e "${GREEN}✅ Stripe secret key configured${NC}"
fi

if [ -n "$VITE_STRIPE_PUBLIC_KEY" ]; then
    railway variables set VITE_STRIPE_PUBLIC_KEY="$VITE_STRIPE_PUBLIC_KEY"
    echo -e "${GREEN}✅ Stripe public key configured${NC}"
fi

# Generate secure secrets
echo -e "${BLUE}🔐 Generating security secrets...${NC}"
SESSION_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

railway variables set SESSION_SECRET="$SESSION_SECRET"
railway variables set CSRF_SECRET="$CSRF_SECRET"
railway variables set JWT_SECRET="$JWT_SECRET"

# Security settings
railway variables set SESSION_SAME_SITE=lax
railway variables set STRICT_WEBHOOK_VERIFICATION=true
railway variables set ENABLE_RATE_LIMITING=true

echo -e "${GREEN}✅ All variables configured!${NC}"

echo ""
echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
echo "1. Add PostgreSQL database in Railway dashboard"
echo "2. Add Redis database in Railway dashboard"
echo "3. Deploy the application"
echo ""
echo "🌐 Open Railway dashboard: https://railway.app/dashboard"
echo ""
echo -e "${BLUE}Press Enter when you've added the databases...${NC}"
read

# Deploy
echo -e "${BLUE}🚀 Deploying application...${NC}"
railway up

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo ""
echo "Your app is being deployed. Check Railway dashboard for the URL."
echo "It will be something like: https://your-app-name.railway.app"