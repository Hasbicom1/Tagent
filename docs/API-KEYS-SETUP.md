# 🔑 SECURE API KEYS SETUP

## AFTER RAILWAY DEPLOYMENT

You need to manually add your API keys in Railway dashboard for security:

### 1. Go to Railway Dashboard
- Visit: https://railway.app/dashboard
- Select your "onedollaragent-ai" project
- Click your main service (not databases)
- Click "Variables" tab

### 2. Add These Variables
Click "+ New Variable" for each:

**STRIPE_SECRET_KEY**
- Get from: https://dashboard.stripe.com/apikeys
- Value starts with: `sk_`

**VITE_STRIPE_PUBLIC_KEY**  
- Get from: https://dashboard.stripe.com/apikeys
- Value starts with: `pk_`

**OPENAI_API_KEY**
- Get from: https://platform.openai.com/api-keys
- Value starts with: `sk-`

### 3. Auto-Generated Variables
These are set automatically by Railway:
- ✅ DATABASE_URL (from PostgreSQL service)
- ✅ REDIS_URL (from Redis service)
- ✅ SESSION_SECRET (generated fresh)
- ✅ CSRF_SECRET (generated fresh)

### 4. Deploy
After adding API keys:
- Railway will auto-redeploy
- Your app will be live with full functionality

## 🔒 Security Notes
- Never commit API keys to code
- Each deployment gets fresh session secrets
- Databases auto-connect securely