# Railway Deployment Guide - Agent HQ

## Quick Start for Railway Deployment

### 1. Environment Variables Required

Set these in Railway Dashboard → Project → Variables:

```env
# Core Application
NODE_ENV=production
PORT=5000
FORCE_HTTPS=true

# Database (automatically set by Railway PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (automatically set by Railway Redis service)  
REDIS_URL=${{Redis.REDIS_URL}}

# Security Secrets (generate with: openssl rand -base64 32)
SESSION_SECRET=your-32-character-secret-here
JWT_SECRET=your-32-character-secret-here

# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
VITE_STRIPE_PUBLIC_KEY=pk_live_your-stripe-public-key

# AI Integration
OPENAI_API_KEY=sk-your-openai-api-key

# SSL Configuration (optional - defaults to strict verification)
# Set to 'false' only if Railway SSL certificate verification fails
# DB_SSL_REJECT_UNAUTHORIZED=false
```

### 2. Required Railway Services

1. **PostgreSQL Database**
   - Add via Railway Dashboard → Add Service → Database → PostgreSQL
   - Automatically provides `DATABASE_URL` variable

2. **Redis Cache**
   - Add via Railway Dashboard → Add Service → Database → Redis
   - Automatically provides `REDIS_URL` variable

### 3. Deployment Steps

1. **Connect Repository**
   ```bash
   # Connect your GitHub repo to Railway
   railway login
   railway init
   railway link <your-project-id>
   ```

2. **Deploy**
   ```bash
   # Push to trigger deployment
   git push origin main
   ```

3. **Monitor Health**
   - Health check endpoint: `https://your-app.railway.app/health`
   - Live probe: `https://your-app.railway.app/health/live`
   - Ready probe: `https://your-app.railway.app/health/ready`

## Production Features Enabled

✅ **Railway PostgreSQL Integration** - Replaced Neon driver with pg for Railway compatibility  
✅ **Environment Validation** - Validates all required secrets at startup  
✅ **Health Endpoints** - `/health`, `/health/live`, `/health/ready` for Railway monitoring  
✅ **Request Logging** - Structured logging with request IDs  
✅ **Global Error Handling** - Catches and logs all unhandled errors  
✅ **Production Security** - HTTPS redirect, security headers, CSRF protection  
✅ **Stripe Webhook Handling** - Raw body parsing for signature verification  

## Architecture

- **Web Service**: Handles HTTP requests, WebSocket connections, payments
- **Database**: PostgreSQL for sessions, payments, agent data  
- **Redis**: Session storage, rate limiting, WebSocket scaling
- **Health Monitoring**: Railway automatic health checks and restarts

## Environment-Specific Behavior

**Development Mode:**
- Uses memory store for sessions
- Relaxed security headers
- Debug logging enabled
- HTTPS redirect disabled

**Production Mode:**
- Redis required for sessions/rate limiting
- Strict security headers
- Info-level logging only
- HTTPS redirect enforced
- Environment validation fails without required secrets

## Troubleshooting

**Common Issues:**

1. **App won't start** - Check Railway logs for missing environment variables
2. **Database connection fails** - Verify PostgreSQL service is running and DATABASE_URL is correct
3. **Session issues** - Verify Redis service is running and REDIS_URL is correct
4. **Payment failures** - Check Stripe keys and webhook secret configuration

**Debug Commands:**
```bash
# View logs
railway logs

# Check environment variables
railway variables

# SSH into container
railway shell
```

## Performance & Scaling

- **Auto-scaling**: Railway handles traffic spikes automatically
- **Health monitoring**: Automatic restart on health check failures
- **Request timeout**: 300 seconds for long AI operations
- **Memory limit**: Configurable via Railway dashboard
- **CPU scaling**: Automatic based on load

Ready for production deployment! 🚀