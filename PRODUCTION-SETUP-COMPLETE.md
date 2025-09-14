# 🚀 COMPLETE PRODUCTION SETUP FOR ONEDOLLARAGENT.AI

## ✅ ALREADY CONFIGURED:
- PostgreSQL Database ✅
- Stripe Keys ✅ (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLIC_KEY)
- OpenAI API Key ✅

## 🔧 NEED TO CONFIGURE:

### 1. REDIS SETUP (FREE - UPSTASH)
**Go to:** https://upstash.com
1. Sign up for free account
2. Create new Redis database (free tier: 500K commands/month)
3. Copy the "UPSTASH_REDIS_REST_URL" - this becomes your REDIS_URL
4. Format: `REDIS_URL=https://your-redis-url.upstash.io`

### 2. SECURE SECRETS (GENERATED):
```
SESSION_SECRET=8apc4uefmqJYNTN6nreaKIOL1ogxxEqdS2pBc5CjyQ8=
JWT_SECRET=zN1Vw+GRfHx65WmryRAFzHhyAFPnB8E06QM6/YEhzvc=
```

### 3. STRIPE WEBHOOK SECRET:
**Go to:** https://dashboard.stripe.com/webhooks
1. Create new webhook endpoint
2. URL: `https://your-app-url.replit.app/api/stripe/webhook`
3. Copy the "Webhook signing secret" (starts with `whsec_`)
4. Format: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

## 🔧 COMPLETE ENVIRONMENT VARIABLES LIST:

```bash
# Database (Already Set)
DATABASE_URL=postgresql://...

# Redis (NEED TO ADD)
REDIS_URL=https://your-redis-url.upstash.io

# Security Secrets (USE THESE)
SESSION_SECRET=8apc4uefmqJYNTN6nreaKIOL1ogxxEqdS2pBc5CjyQ8=
JWT_SECRET=zN1Vw+GRfHx65WmryRAFzHhyAFPnB8E06QM6/YEhzvc=

# Stripe (Already Set + Need Webhook)
STRIPE_SECRET_KEY=sk_...
VITE_STRIPE_PUBLIC_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI
OPENAI_API_KEY=sk-...

# Production Settings
NODE_ENV=production
PORT=5000
DOMAIN=onedollaragent.ai
```

## 📋 NEXT STEPS:
1. Set up Redis (5 min)
2. Configure all env vars in Replit
3. Create production deployment
4. Connect domain onedollaragent.ai