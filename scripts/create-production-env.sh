#!/bin/bash

# Create Production Environment Configuration
# This script helps set up .env.production with generated secrets

echo "🔐 Agent For All - Production Environment Setup"
echo "=============================================="

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <domain.com>"
    echo "Example: $0 agenthq.ai"
    exit 1
fi

DOMAIN=$1

# Generate secrets
echo "🔑 Generating secure secrets..."
SECRETS=$(node scripts/generate-secrets.js)
SESSION_SECRET=$(echo "$SECRETS" | grep "SESSION_SECRET=" | cut -d'=' -f2)
CSRF_SECRET=$(echo "$SECRETS" | grep "CSRF_SECRET=" | cut -d'=' -f2)

# Create production environment file
cat > .env.production <<EOF
# Agent For All - Production Environment
# Generated on $(date)
# Domain: $DOMAIN

# REQUIRED: Domain Configuration
DOMAIN=$DOMAIN
NODE_ENV=production

# REQUIRED: Database (Get from Neon Dashboard)
DATABASE_URL=postgresql://username:password@hostname.neon.tech/dbname?sslmode=require

# REQUIRED: Redis Configuration  
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=agentforall2024

# REQUIRED: Stripe Configuration (LIVE KEYS)
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
VITE_STRIPE_PUBLIC_KEY=pk_live_YOUR_PUBLIC_KEY_HERE

# REQUIRED: OpenAI API
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE

# Generated Security Secrets
SESSION_SECRET=$SESSION_SECRET
CSRF_SECRET=$CSRF_SECRET

# Server Configuration
PORT=5000
HOST=0.0.0.0

# Database Password (for Docker PostgreSQL - not needed if using Neon)
DB_PASSWORD=your-secure-database-password

# Security Configuration
STRICT_WEBHOOK_VERIFICATION=true
ENABLE_RATE_LIMITING=true
MAX_REQUESTS_PER_MINUTE=60
MAX_PAYMENT_REQUESTS_PER_HOUR=5
EOF

echo "✅ Production environment file created: .env.production"
echo ""
echo "📝 REQUIRED ACTIONS:"
echo "   1. Update DATABASE_URL with your Neon database URL"
echo "   2. Update STRIPE_SECRET_KEY with live key from Stripe Dashboard"
echo "   3. Update STRIPE_WEBHOOK_SECRET from Stripe Dashboard"  
echo "   4. Update VITE_STRIPE_PUBLIC_KEY with live public key"
echo "   5. Update OPENAI_API_KEY with your OpenAI key"
echo ""
echo "🔒 Keep this file secure - never commit to version control!"

# Create gitignore entry
if ! grep -q ".env.production" .gitignore 2>/dev/null; then
    echo ".env.production" >> .gitignore
    echo "✅ Added .env.production to .gitignore"
fi