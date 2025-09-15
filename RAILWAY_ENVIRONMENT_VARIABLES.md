# Railway Environment Variables Configuration

## Overview
Complete reference for all environment variables required for OneDollarAgent.ai production deployment on Railway with custom domain and Redis addon.

---

## Core Application Variables

### Node.js Environment
```bash
NODE_ENV=production
PORT=${{PORT}}  # Auto-configured by Railway
FORCE_HTTPS=true
FRONTEND_URL=https://www.onedollaragent.ai
```

**Important Notes:**
- `NODE_ENV=production` triggers production optimizations
- `PORT` is automatically set by Railway (typically 5000)
- `FORCE_HTTPS=true` redirects all HTTP traffic to HTTPS
- `FRONTEND_URL` must match custom domain exactly

---

## Database & Redis Configuration

### PostgreSQL (Auto-configured by Railway)
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Redis Cache (Auto-configured by Railway)  
```bash
REDIS_URL=${{Redis.REDIS_URL}}
```

**How Railway Addons Work:**
- Railway automatically injects addon connection URLs
- No manual configuration needed for DATABASE_URL or REDIS_URL
- Connection strings include authentication and networking
- Format: `redis://default:password@redis.railway.internal:6379`

---

## Authentication & Security

### Session Management
```bash
SESSION_SECRET=<64-character-secure-random-string>
JWT_SECRET=<64-character-secure-random-string>
```

**Generate Secure Secrets:**
```bash
# Generate SESSION_SECRET
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT_SECRET  
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

**Security Requirements:**
- Must be exactly 64 characters long
- Use cryptographically secure random generation
- Never reuse between environments
- Store securely in Railway dashboard

---

## Payment Processing (Stripe)

### Production Stripe Keys
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Stripe Configuration Steps:**

#### 1. Obtain Live API Keys
1. Login to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Live mode** (top right toggle)
3. Go to **Developers** → **API keys**
4. Copy **Secret key** (starts with `sk_live_`)
5. Copy **Publishable key** (starts with `pk_live_`)

#### 2. Configure Webhook Endpoint
1. Go to **Developers** → **Webhooks**
2. Create new webhook endpoint:
   ```
   URL: https://www.onedollaragent.ai/api/stripe/webhook
   ```
3. Select these events:
   - `payment_intent.succeeded`
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy **Signing secret** (starts with `whsec_`)

**Critical Security Notes:**
- Never use test keys in production
- Webhook secret must match exact Railway domain
- Rotate keys if compromised
- Monitor webhook delivery status

---

## AI Integration

### OpenAI API Configuration
```bash
OPENAI_API_KEY=sk-...
```

**Setup Instructions:**
1. Login to [OpenAI Platform](https://platform.openai.com)
2. Go to **API keys** section
3. Create new secret key for production
4. Set usage limits and billing alerts
5. Copy key (starts with `sk-`)

**Usage Monitoring:**
- Set reasonable usage limits
- Enable billing alerts
- Monitor API usage in OpenAI dashboard
- Consider implementing rate limiting

---

## Railway-Specific Variables

### Platform Detection
```bash
RAILWAY_ENVIRONMENT=production
RAILWAY_PUBLIC_DOMAIN=www.onedollaragent.ai
```

**Auto-configured by Railway:**
- `RAILWAY_ENVIRONMENT` - Deployment environment
- `RAILWAY_PUBLIC_DOMAIN` - Custom domain
- `RAILWAY_PROJECT_ID` - Project identifier
- `RAILWAY_SERVICE_ID` - Service identifier

### Build Configuration
```bash
NODE_VERSION=18
NPM_VERSION=latest
```

**Build Optimization:**
- Railway automatically detects Node.js version from package.json
- Uses Nixpacks for optimized builds
- Includes dependency caching
- Supports custom build commands

---

## Complete Environment Variables Checklist

### Required for Application Start
```bash
# Core Application
NODE_ENV=production
FRONTEND_URL=https://www.onedollaragent.ai
FORCE_HTTPS=true

# Database & Cache (Auto-configured)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Security  
SESSION_SECRET=<generate-64-char-string>
JWT_SECRET=<generate-64-char-string>

# Payment Processing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...  
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Integration
OPENAI_API_KEY=sk-...
```

### Optional Configuration
```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # requests per window

# Session Configuration  
SESSION_MAX_AGE=86400        # 24 hours in seconds
SESSION_SECURE=true          # HTTPS only cookies

# Logging
LOG_LEVEL=info              # error, warn, info, debug
LOG_FORMAT=json             # json or text

# Performance
NODE_OPTIONS=--max-old-space-size=1024  # Increase memory limit
```

---

## Setting Environment Variables in Railway

### Method 1: Railway Dashboard
1. Login to [railway.app](https://railway.app)
2. Select your project
3. Go to **Variables** tab
4. Click **Add Variable**
5. Enter **Key** and **Value**
6. Click **Save**

### Method 2: Railway CLI
```bash
# Set single variable
railway vars set NODE_ENV=production

# Set multiple variables from file
railway vars set --file .env.production

# View all variables
railway vars

# Remove variable
railway vars remove VARIABLE_NAME
```

### Method 3: Environment File (Local Development)
Create `.env.production` file (never commit to git):
```bash
NODE_ENV=production
FRONTEND_URL=https://www.onedollaragent.ai
SESSION_SECRET=your-64-char-secret-here
JWT_SECRET=your-64-char-secret-here
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
OPENAI_API_KEY=sk-your_key_here
```

Then import to Railway:
```bash
railway vars set --file .env.production
rm .env.production  # Delete file after import
```

---

## Variable Validation & Testing

### Application Startup Validation
The application automatically validates required environment variables:

```bash
# Check validation logs in Railway
railway logs | grep "Environment Configuration"
```

Expected output:
```
🚀 AUTO-DETECTED: Production environment for Railway deployment
   RAILWAY_ENVIRONMENT: production
   FRONTEND_URL: https://www.onedollaragent.ai
🔧 Environment Configuration:
   NODE_ENV: production
   IS_RAILWAY: YES
   DATABASE_URL: CONFIGURED
   SESSION_SECRET: CONFIGURED
   JWT_SECRET: CONFIGURED
   STRIPE_SECRET_KEY: CONFIGURED
   STRIPE_WEBHOOK_SECRET: CONFIGURED
   OPENAI_API_KEY: CONFIGURED
   REDIS_URL: CONFIGURED
```

### Manual Variable Testing
```bash
# Test environment variable access
railway connect
> echo $NODE_ENV
> echo $FRONTEND_URL
> echo ${REDIS_URL:0:20}...  # Show partial Redis URL
```

---

## Security Best Practices

### 1. Secret Management
```bash
# ✅ GOOD: Using Railway's secure variable storage
railway vars set STRIPE_SECRET_KEY=sk_live_...

# ❌ BAD: Committing secrets to git
# .env file committed to repository
```

### 2. Secret Rotation
```bash
# Regular secret rotation process
1. Generate new secret
2. Update in service (Stripe, OpenAI, etc.)  
3. Update in Railway variables
4. Restart deployment to pick up changes
5. Verify functionality
6. Delete old secret from service
```

### 3. Access Control
- Limit Railway project access to essential team members
- Use separate API keys for development and production
- Enable two-factor authentication on all service accounts
- Regularly audit access permissions

### 4. Monitoring
```bash
# Monitor for security events
railway logs | grep -E "(ERROR|SECURITY|UNAUTHORIZED)"

# Set up alerts for authentication failures
railway logs | grep "Authentication failed"
```

---

## Environment-Specific Considerations

### Production vs Development

#### Production Environment
- All secrets must be production API keys
- HTTPS enforcement enabled
- Redis required for session storage
- Comprehensive logging and monitoring
- Rate limiting enabled

#### Development Environment  
- Test/development API keys acceptable
- HTTP allowed for local development
- Memory storage fallback available
- Verbose logging enabled
- Relaxed rate limiting

### Domain Configuration
```bash
# Production domain configuration
FRONTEND_URL=https://www.onedollaragent.ai

# Staging domain configuration (if used)
FRONTEND_URL=https://staging.onedollaragent.ai

# Development domain (Replit)
FRONTEND_URL=https://onedollara.replit.app
```

---

## Troubleshooting Environment Variables

### Common Issues

#### Issue 1: Variables Not Loading
**Symptoms:**
```
❌ Environment variable STRIPE_SECRET_KEY not found
```

**Solutions:**
1. Check variable exists in Railway dashboard
2. Verify variable name spelling exactly
3. Restart Railway service: `railway redeploy`
4. Check for typos in variable names

#### Issue 2: Redis Connection Failed
**Symptoms:**  
```
❌ REDIS_URL environment variable is required
```

**Solutions:**
1. Ensure Redis addon is added to project
2. Check Railway service status
3. Verify REDIS_URL appears in variables list
4. Restart service to refresh addon connections

#### Issue 3: Stripe Webhook Verification Failed
**Symptoms:**
```
❌ WEBHOOK: Signature verification failed
```

**Solutions:**
1. Verify webhook URL matches exactly: `https://www.onedollaragent.ai/api/stripe/webhook`
2. Check STRIPE_WEBHOOK_SECRET is correctly copied
3. Ensure webhook events include required event types
4. Test webhook delivery in Stripe dashboard

#### Issue 4: OpenAI API Authentication Failed  
**Symptoms:**
```
❌ OpenAI API authentication failed
```

**Solutions:**
1. Verify OPENAI_API_KEY format (starts with `sk-`)
2. Check API key has not expired
3. Ensure sufficient OpenAI credit balance
4. Verify API key permissions for required models

---

## Production Deployment Checklist

### Pre-Deployment Verification
- [ ] All required environment variables configured
- [ ] All secrets generated securely (64+ characters)
- [ ] Stripe live keys configured and webhook endpoint updated
- [ ] OpenAI API key configured with appropriate limits
- [ ] Custom domain configured (www.onedollaragent.ai)
- [ ] PostgreSQL and Redis addons added to Railway

### Post-Deployment Validation  
- [ ] Application starts successfully
- [ ] Environment detection shows "production"
- [ ] Database connection established
- [ ] Redis connection established  
- [ ] Stripe webhook receiving events
- [ ] OpenAI API calls working
- [ ] Custom domain accessible via HTTPS
- [ ] Health checks passing

### Monitoring Setup
- [ ] Application logs monitoring configured
- [ ] Database performance monitoring enabled
- [ ] Redis memory usage monitoring set up
- [ ] Stripe webhook delivery monitoring
- [ ] OpenAI usage monitoring and alerts
- [ ] Custom domain SSL certificate monitoring

---

This completes the comprehensive environment variables configuration for Railway production deployment of www.onedollaragent.ai with full security, monitoring, and troubleshooting guidance.