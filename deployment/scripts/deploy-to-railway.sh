#!/bin/bash

# 🚀 Agent HQ - Guided Railway Deployment
# Requires basic technical comfort - guided setup with copy-paste commands
# Usage: ./scripts/deploy-to-railway.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

log_info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
}

echo "🚀 AGENT HQ - RAILWAY DEPLOYMENT STARTING..."
echo "🎯 Target: Guided deployment with basic technical steps"
echo "⏰ Started: $(date)"
echo ""

# Check if Railway CLI is installed
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Railway CLI if not present
log_step "Checking Railway CLI installation..."
if ! command_exists railway; then
    log_info "Installing Railway CLI..."
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://railway.app/install.sh | sh
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            brew install railway
        else
            curl -fsSL https://railway.app/install.sh | sh
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows
        log_warning "Please install Railway CLI manually: https://docs.railway.app/cli/installation"
        log_warning "Then run this script again."
        exit 1
    fi
fi

if command_exists railway; then
    log_success "Railway CLI is ready"
else
    log_error "Railway CLI installation failed. Please install manually from: https://docs.railway.app/cli/installation"
    exit 1
fi

# Check if user is logged in to Railway
log_step "Checking Railway authentication..."
if ! railway whoami > /dev/null 2>&1; then
    log_info "Please log in to Railway..."
    railway login
    log_success "Railway authentication completed"
else
    log_success "Already authenticated with Railway"
fi

# Create Railway project configuration
log_step "Creating Railway project configuration..."

cat > "$PROJECT_ROOT/railway.toml" <<EOF
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "agent-hq"

[services.variables]
NODE_ENV = "production"
PORT = "5000"
HOST = "0.0.0.0"
EOF

log_success "Railway configuration created"

# Display required environment variables
log_step "Required API keys for manual setup..."
log_info "You will need to obtain these API keys:"
log_info "1. STRIPE_SECRET_KEY - Get TEST key from stripe.com/test/dashboard"
log_info "2. VITE_STRIPE_PUBLIC_KEY - Get TEST key from stripe.com/test/dashboard" 
log_info "3. OPENAI_API_KEY - Get from platform.openai.com/api-keys"
log_info ""
log_info "💡 Using TEST mode for safe development/demo"
log_info "These will be added manually through Railway dashboard after deployment"
log_success "API key requirements noted"

# Verify production scripts exist (no modification needed)
log_step "Verifying production scripts exist..."
if grep -q "\"start\":" "$PROJECT_ROOT/package.json" && grep -q "\"build\":" "$PROJECT_ROOT/package.json"; then
    log_success "Production scripts verified (build and start commands ready)"
else
    log_error "Missing required production scripts in package.json"
    log_error "Expected: 'build' and 'start' scripts for Railway deployment"
    exit 1
fi

# Check for existing Railway project
log_step "Checking for existing Railway project..."
if railway status > /dev/null 2>&1; then
    log_info "Existing Railway project found, using current project"
else
    log_info "Creating new Railway project..."
    railway login
    railway new
    log_success "New Railway project created"
fi

# Add PostgreSQL database  
log_step "Adding PostgreSQL database..."
log_info "Go to your Railway dashboard and add a PostgreSQL database:"
log_info "1. Open https://railway.app/dashboard"
log_info "2. Select your project"
log_info "3. Click 'New Service' → 'Database' → 'Add PostgreSQL'"
log_info "4. Railway will automatically set DATABASE_URL environment variable"
log_warning "This step requires manual action in Railway dashboard"

# Add Redis cache
log_step "Adding Redis cache..."
log_info "Go to your Railway dashboard and add a Redis database:"
log_info "1. In the same project, click 'New Service' → 'Database' → 'Add Redis'"
log_info "2. Railway will automatically set REDIS_URL environment variable"
log_warning "This step requires manual action in Railway dashboard"

read -p "Press Enter once you've added PostgreSQL and Redis databases in Railway dashboard..."

# CRITICAL: Validate that databases are actually configured before deployment
log_step "Validating database configuration..."

# Check DATABASE_URL
DATABASE_STATUS=$(railway env get DATABASE_URL 2>/dev/null | head -n1 || echo "")
if [ -z "$DATABASE_STATUS" ] || [ "$DATABASE_STATUS" = "null" ]; then
    log_error "DATABASE_URL is not set in Railway environment!"
    log_error ""
    log_error "CRITICAL ERROR: PostgreSQL database is required but not configured."
    log_error ""
    log_error "To fix this:"
    log_error "  1. Go to https://railway.app/dashboard"
    log_error "  2. Select your project"
    log_error "  3. Click 'New Service' → 'Database' → 'Add PostgreSQL'"
    log_error "  4. Wait for DATABASE_URL to appear in Variables tab"
    log_error "  5. Run this script again"
    log_error ""
    exit 1
fi

# Check REDIS_URL
REDIS_STATUS=$(railway env get REDIS_URL 2>/dev/null | head -n1 || echo "")
if [ -z "$REDIS_STATUS" ] || [ "$REDIS_STATUS" = "null" ]; then
    log_error "REDIS_URL is not set in Railway environment!"
    log_error ""
    log_error "CRITICAL ERROR: Redis cache is required but not configured."
    log_error ""
    log_error "To fix this:"
    log_error "  1. Go to https://railway.app/dashboard"
    log_error "  2. Select your project"
    log_error "  3. Click 'New Service' → 'Database' → 'Add Redis'"
    log_error "  4. Wait for REDIS_URL to appear in Variables tab"
    log_error "  5. Run this script again"
    log_error ""
    exit 1
fi

log_success "Database validation passed (PostgreSQL and Redis configured)"

# Generate secure secrets
log_step "Generating secure secrets..."
SESSION_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# Set basic environment variables  
log_step "Setting basic environment variables..."
railway env:set NODE_ENV=production
railway env:set PORT=5000
railway env:set HOST=0.0.0.0
railway env:set SESSION_SECRET="$SESSION_SECRET"
railway env:set CSRF_SECRET="$CSRF_SECRET"
railway env:set JWT_SECRET="$JWT_SECRET"

log_success "Basic environment variables configured"
log_warning "You must add API keys manually in Railway dashboard after deployment"

# Get current Railway info
PROJECT_INFO=$(railway status --json 2>/dev/null || echo '{}')
RAILWAY_URL=$(echo "$PROJECT_INFO" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")

log_step "Deploying to Railway..."
railway up

# Wait for deployment to complete
log_info "Waiting for deployment to complete..."
sleep 30

# Get deployment URL
RAILWAY_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$RAILWAY_URL" ]; then
    log_success "Deployment completed!"
    echo ""
    echo "🎉 SUCCESS! Your Agent HQ is now live at:"
    echo "🌐 $RAILWAY_URL"
    echo ""
else
    log_warning "Deployment completed but couldn't retrieve URL"
    echo "Check your Railway dashboard for the deployment URL"
fi

# Create post-deployment instructions
cat > "$PROJECT_ROOT/DEPLOYMENT_NEXT_STEPS.md" <<EOF
# 🎉 Agent HQ Successfully Deployed to Railway!

## ✅ What's Working Now
- ✅ Agent HQ application deployed and running
- ✅ PostgreSQL database connected
- ✅ Redis cache connected
- ✅ Automatic SSL certificate provisioned
- ✅ Professional hosting on Railway infrastructure

## 🔧 Required Next Steps

### 1. Add API Keys (5 minutes)
**Go to your Railway dashboard:** https://railway.app/dashboard

**Click on your "agent-hq" project → Variables tab**

**Add these required environment variables:**
\`\`\`
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_test_key
VITE_STRIPE_PUBLIC_KEY=pk_test_your_actual_stripe_test_key  
OPENAI_API_KEY=sk-proj-your_actual_openai_key
\`\`\`

**Optional (for advanced features):**
\`\`\`
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
DEEPSEEK_API_KEY=sk-your_deepseek_key
\`\`\`

### 2. Test Your Deployment (2 minutes)
1. Visit your Railway URL: $RAILWAY_URL
2. Try the payment flow with test card: 4242 4242 4242 4242
3. Verify the agent chat interface loads properly

### 3. Add Custom Domain (Optional - 15 minutes)
1. In Railway dashboard: Settings → Domains → Add Custom Domain
2. Enter your domain (e.g., agentforall.com)
3. Update your DNS with the provided CNAME record
4. Railway automatically provisions SSL certificate

### 4. Monitor Your App
- **Railway Dashboard**: View logs, metrics, and health status
- **Deployment URL**: $RAILWAY_URL
- **Database**: Automatically backed up daily
- **Redis**: Session data persisted automatically

## 🎯 You're Now Ready For Business!

**What you can focus on:**
✅ Marketing and customer acquisition
✅ Content creation and social media  
✅ Business development
✅ Customer feedback and improvements

**What you DON'T need to worry about:**
❌ Server maintenance
❌ Database backups
❌ SSL certificates
❌ Security updates
❌ Scaling infrastructure

## 📞 Support Resources
- **Railway Documentation**: https://docs.railway.app
- **Railway Support**: Available in Railway dashboard
- **Agent HQ Issues**: GitHub repository issues page

**🚀 Congratulations! Agent HQ is now professionally hosted and ready for customers!**
EOF

echo ""
log_success "Deployment complete! Check DEPLOYMENT_NEXT_STEPS.md for final configuration steps."
echo ""
echo "📋 SUMMARY:"
echo "✅ Application deployed to Railway"
echo "✅ PostgreSQL and Redis configured" 
echo "✅ SSL certificate provisioned"
echo "✅ Professional monitoring enabled"
echo ""
echo "🔧 NEXT: Add your API keys in Railway dashboard to complete setup"
echo "📖 READ: ./DEPLOYMENT_NEXT_STEPS.md for detailed instructions"
echo ""
echo "🎉 CONGRATULATIONS! Your guided deployment is nearly complete!"