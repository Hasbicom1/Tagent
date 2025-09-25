# 🚀 FINAL DEPLOYMENT STEPS - GET LIVE IN 10 MINUTES!

## 🔍 **STEP 1: GET YOUR REDIS PASSWORD**
Go back to your Upstash dashboard:
1. Click on your "Pdfchatbot" database  
2. Copy the Redis password (looks like: `AcVxASQgYTc...`)
3. **IMPORTANT**: Use TLS format for Upstash

## 🔧 **STEP 2: CONFIGURE REPLIT DEPLOYMENT**
In your Replit project:
1. Go to **"Publishing" tab**
2. Click **"Settings" tab** 
3. In **Environment Variables** section, add ALL these:

```bash
# Core Settings
NODE_ENV=production
PORT=5000
DOMAIN=onedollaragent.ai
FORCE_HTTPS=true

# Database (Already set - but verify it's there)
DATABASE_URL=postgresql://...

# Redis - USE TLS FORMAT WITH YOUR PASSWORD
REDIS_URL=rediss://default:YOUR_REDIS_PASSWORD@just-thrush-44938.upstash.io:6379

# Generate NEW Security Secrets (32+ characters each)
SESSION_SECRET=<generate-new-32-char-secret>
JWT_SECRET=<generate-new-32-char-secret>

# Stripe Keys (Already set - but verify)
STRIPE_SECRET_KEY=sk_...
VITE_STRIPE_PUBLIC_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_... (see step 2.5)

# OpenAI (Already set - but verify)
OPENAI_API_KEY=sk-...

# Security Features
ENABLE_SESSION_VALIDATION=true
ENABLE_RATE_LIMITING=true

# Domain Configuration
CORS_ORIGINS=https://onedollaragent.ai,https://www.onedollaragent.ai
```

## 🔐 **STEP 2.5: SET UP STRIPE WEBHOOK**
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"  
3. URL: `https://your-app-url.replit.app/api/stripe/webhook`
4. Events: Select `payment_intent.succeeded` and `checkout.session.completed`
5. Copy the "Webhook signing secret" (starts with `whsec_`)
6. Add as `STRIPE_WEBHOOK_SECRET` in Replit

## 🔑 **STEP 2.6: GENERATE NEW SECRETS**
Run these commands to generate secure secrets:
```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

## 🚀 **STEP 3: CREATE NEW DEPLOYMENT**
1. In Publishing tab, click **"New Deployment"** (DON'T resume the old one)
2. Wait for build to complete (check logs for "Server running on port 5000")
3. Verify all environment variables are loaded

## 🌐 **STEP 4: CONNECT YOUR DOMAIN**
1. Once deployment is healthy, go to **"Settings" tab**
2. Click **"Link a domain"**
3. Enter: `onedollaragent.ai`
4. Add the DNS records in Namecheap as instructed

## ✅ **SUCCESS INDICATORS:**
Your deployment is successful when you see in logs:
- ✅ "Environment validation passed"
- ✅ "Redis connection established"  
- ✅ "Session security store initialized"
- ✅ "Server running on port 5000"

## 🎉 **FINAL RESULT:**
Your AI platform will be live at `https://onedollaragent.ai` with full production security!