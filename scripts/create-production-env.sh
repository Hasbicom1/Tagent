#!/bin/bash

# 🔐 Agent HQ - Railway Environment Configuration  
# Securely configures production environment directly in Railway (no local secrets)
# Usage: ./scripts/create-production-env.sh [domain]

set -e

DOMAIN=${1:-"your-domain.com"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔐 RAILWAY ENVIRONMENT CONFIGURATION"
echo "🎯 Domain: $DOMAIN"
echo "⏰ Started: $(date)"
echo ""

# Verify Railway CLI is available
log_step "Checking Railway CLI availability..."
if ! command -v railway >/dev/null 2>&1; then
    log_error "Railway CLI not found. Please install it first:"
    log_error "  macOS: brew install railway"
    log_error "  Linux/Windows: curl -fsSL https://railway.app/install.sh | sh"
    exit 1
fi

# Check Railway authentication
log_step "Verifying Railway authentication..."
if ! railway whoami > /dev/null 2>&1; then
    log_error "Not authenticated with Railway. Please run: railway login"
    exit 1
fi

log_success "Railway CLI ready and authenticated"

# Generate secure secrets (no local storage)
log_step "Generating and setting secure environment variables..."
SESSION_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# Security secrets (auto-generated and set directly)
railway env:set SESSION_SECRET="$SESSION_SECRET"
railway env:set CSRF_SECRET="$CSRF_SECRET"  
railway env:set JWT_SECRET="$JWT_SECRET"

# Application configuration
railway env:set NODE_ENV=production
railway env:set PORT=5000
railway env:set HOST=0.0.0.0
railway env:set DOMAIN="$DOMAIN"
# Get Railway app URL for CORS configuration - improved detection
RAILWAY_URL=""
# Try multiple methods to detect Railway URL
if command -v railway >/dev/null 2>&1; then
    RAILWAY_URL=$(railway status --json 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin) if sys.stdin else {}; print(data.get('deployments', [{}])[0].get('url', ''))" 2>/dev/null || echo "")
    if [ -z "$RAILWAY_URL" ]; then
        RAILWAY_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | head -1 || echo "")
    fi
fi

# Configure CORS origins with proper validation
if [ -n "$RAILWAY_URL" ]; then
    # Use detected Railway URL
    railway env:set ALLOWED_ORIGINS="https://$DOMAIN,https://www.$DOMAIN,$RAILWAY_URL"
    log_info "CORS configured with Railway URL: $RAILWAY_URL"
else
    # Safe fallback without invalid wildcard pattern
    railway env:set ALLOWED_ORIGINS="https://$DOMAIN,https://www.$DOMAIN"
    log_warning "Railway URL not detected - CORS limited to domain only"
    log_warning "You may need to manually add Railway URL to ALLOWED_ORIGINS in Railway dashboard"
fi
railway env:set FORCE_HTTPS=true

# Security settings
railway env:set STRICT_WEBHOOK_VERIFICATION=true
railway env:set ENABLE_RATE_LIMITING=true
railway env:set MAX_REQUESTS_PER_MINUTE=100
railway env:set MAX_PAYMENT_REQUESTS_PER_HOUR=10

# Session configuration - Use lax for Stripe payment redirects
railway env:set SESSION_MAX_AGE=86400
railway env:set SESSION_SECURE=true
railway env:set SESSION_SAME_SITE=lax

# Feature flags
railway env:set ENABLE_BROWSER_AUTOMATION=true
railway env:set ENABLE_TASK_QUEUE=true
railway env:set ENABLE_REAL_TIME_CHAT=true
railway env:set ENABLE_STRIPE_PAYMENTS=true
railway env:set ENABLE_WEBHOOK_VERIFICATION=true
railway env:set ENABLE_CSRF_PROTECTION=true
railway env:set ENABLE_SESSION_SECURITY=true

# Logging
railway env:set LOG_LEVEL=info

log_success "Railway environment variables configured securely"

# Display next steps for API keys
log_step "Providing API key configuration guidance..."

echo ""
echo "🔧 REQUIRED NEXT STEPS:"
echo ""
echo "Add these API keys manually in Railway dashboard:"
echo "  1. Go to https://railway.app/dashboard"
echo "  2. Select your project → Variables tab"
echo "  3. Add these required environment variables:"
echo ""
echo "     STRIPE_SECRET_KEY=sk_test_your_actual_stripe_key"
echo "     VITE_STRIPE_PUBLIC_KEY=pk_test_your_actual_stripe_public_key"  
echo "     OPENAI_API_KEY=sk-proj-your_actual_openai_key"
echo ""
echo "💡 NOTE: Using TEST mode for development."
echo "   For production, use sk_live_ and pk_live_ keys from Stripe."
echo ""
echo "Railway automatically provides:"
echo "  - DATABASE_URL (from PostgreSQL addon)"
echo "  - REDIS_URL (from Redis addon)"

log_success "Environment configuration completed"

# Create simplified API keys checklist (no file creation)
log_step "API Keys Checklist Information..."

echo ""
echo "🔑 API KEYS CHECKLIST FOR AGENT HQ"
echo "=================================="
echo ""
echo "Required API Keys:"
echo ""
echo "1. Stripe (Payment Processing) - TEST MODE"
echo "   Get from: https://dashboard.stripe.com/test/apikeys"
echo "   □ STRIPE_SECRET_KEY: sk_test_... (TEST key for development)"
echo "   □ VITE_STRIPE_PUBLIC_KEY: pk_test_... (TEST key for development)"
echo ""
echo "2. OpenAI (AI Agent)"
echo "   Get from: https://platform.openai.com/api-keys"
echo "   □ OPENAI_API_KEY: sk-proj-... (Project API key)"
echo ""
echo "How to Add Keys:"
echo "  1. Go to https://railway.app/dashboard"
echo "  2. Select your project → Variables tab"
echo "  3. Click 'New Variable' for each key above"
echo ""
echo "Test Payment Card (for TEST mode):"
echo "  Card: 4242 4242 4242 4242"
echo "  Expiry: Any future date"
echo "  CVC: Any 3 digits"
echo ""

log_success "API keys information provided"

# Security verification information (no script creation)
log_step "Security Configuration Verification..."

echo ""
echo "🔒 SECURITY CONFIGURATION COMPLETED"
echo "==================================="
echo ""
echo "Automatically configured:"
echo "  ✅ SESSION_SECRET: Generated and set"
echo "  ✅ CSRF_SECRET: Generated and set"  
echo "  ✅ JWT_SECRET: Generated and set"
echo "  ✅ HTTPS enforcement: Enabled"
echo "  ✅ Rate limiting: Enabled"
echo "  ✅ Secure sessions: Enabled"
echo ""
echo "Verification steps:"
echo "  1. Check Railway dashboard Variables tab"
echo "  2. Ensure all environment variables are set"
echo "  3. Test payment flow with test card"
echo "  4. Verify AI agent functionality"
echo ""

log_success "Security verification information provided"

# Final summary
echo ""
log_success "Railway environment configuration completed!"
echo ""
echo "🔧 NEXT STEPS:"
echo "  1. Add your API keys in Railway dashboard (see instructions above)"
echo "  2. Deploy with: ./scripts/deploy-to-railway.sh"
echo "  3. Test your app with test card: 4242 4242 4242 4242"
echo ""
echo "✅ WHAT'S CONFIGURED:"
echo "  - All security settings applied directly to Railway"
echo "  - No local files with secrets created"
echo "  - Test mode ready for development"
echo ""
echo "🎉 Your Railway environment is ready for secure deployment!"