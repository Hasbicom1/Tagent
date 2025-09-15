# 🌐 Custom Domain DNS Configuration Guide

## Overview
This guide provides comprehensive instructions for configuring DNS records and SSL/TLS certificates for the custom domain **www.onedollaragent.ai** with Replit hosting.

## 📋 Prerequisites

- **Domain Registration**: Ensure onedollaragent.ai is registered and accessible via domain registrar
- **DNS Access**: Admin access to DNS management for onedollaragent.ai
- **Replit Deployment**: Agent HQ application must be deployed and running on Replit first

## 🔧 DNS Configuration Steps

### Step 1: Deploy Application on Replit

1. **Deploy the application** on Replit and note the generated URL:
   ```
   https://agent-hq-[username].replit.app
   ```

2. **Verify deployment** is working:
   ```bash
   curl https://agent-hq-[username].replit.app/health
   ```

### Step 2: Configure DNS Records

#### Primary Configuration: Using CNAME (Required)

Set up the following DNS record in your domain registrar:

```dns
# Primary subdomain (www) - REQUIRED
www.onedollaragent.ai    CNAME    agent-hq-[username].replit.app
```

#### Apex Domain Handling (onedollaragent.ai)

Since Replit hosting requires CNAME records (which cannot be used for apex domains), handle the apex domain using ONE of these methods:

**Option A: Registrar HTTP Redirect (Recommended)**
Most domain registrars provide built-in HTTP redirect services:
```dns
# Configure in your registrar's control panel:
onedollaragent.ai → HTTP 301 redirect to → https://www.onedollaragent.ai
```

**Option B: DNS Provider ALIAS/ANAME (If Supported)**
Some DNS providers (CloudFlare, AWS Route 53) support ALIAS/ANAME records:
```dns
# Only if your DNS provider supports ALIAS/ANAME
onedollaragent.ai        ALIAS    agent-hq-[username].replit.app
```

**⚠️ IMPORTANT**: 
- Do NOT use static A records for Replit hosting - IPs may change
- CNAME for www subdomain is the primary supported method
- Apex domain should redirect to www for consistency

### Step 3: Domain Verification in Replit

1. **Access Replit Console** and navigate to your deployment
2. **Go to Settings** → **Domains**
3. **Add Custom Domain**: Enter `www.onedollaragent.ai`
4. **Copy TXT Record**: Replit will provide a verification TXT record
5. **Add TXT Record** to your DNS:
   ```dns
   _replit-domain-verification.onedollaragent.ai    TXT    "replit-verification-[token]"
   ```

### Step 4: SSL/TLS Certificate Configuration

Replit automatically provisions SSL certificates once domain verification is complete.

#### SSL Certificate Status Check

```bash
# Verify SSL certificate
curl -I https://www.onedollaragent.ai
```

Expected response should show:
- Status: `200 OK` or redirect
- `Strict-Transport-Security` header present
- Valid SSL certificate (no warnings)

## 🔒 Security Configuration

### HTTPS Enforcement

The application automatically enforces HTTPS in production:

```javascript
// Automatic HTTPS redirect for production domains
if (productionDomains.some(domain => host.includes(domain))) {
  if (protocol !== "https") {
    return res.redirect(301, `https://${host}${req.url}`);
  }
}
```

### CORS Origins Configuration

Ensure environment variables are set:

```env
ALLOWED_ORIGINS=https://onedollaragent.ai,https://www.onedollaragent.ai,https://[replit-url]
FRONTEND_URL=https://www.onedollaragent.ai
```

### Content Security Policy

The application includes production CSP headers:

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://js.stripe.com"],
    connectSrc: ["'self'", "wss:", "https:", "https://api.stripe.com"],
    frameSrc: ["https://checkout.stripe.com", "https://js.stripe.com"]
  }
}
```

## 🔄 DNS Propagation

### Checking Propagation Status

```bash
# Check DNS propagation globally
nslookup www.onedollaragent.ai
dig www.onedollaragent.ai

# Check from different locations
curl -H "Host: www.onedollaragent.ai" https://agent-hq-[username].replit.app/health
```

### Propagation Timeline

- **Local ISP**: 1-2 hours
- **Global Propagation**: 24-48 hours maximum
- **Replit SSL Provisioning**: 5-15 minutes after domain verification

## 🧪 Verification & Testing

### DNS Verification Checklist

- [ ] **DNS Records Active**: `nslookup www.onedollaragent.ai` resolves correctly
- [ ] **Domain Verification**: TXT record validates in Replit dashboard
- [ ] **SSL Certificate**: HTTPS loads without warnings
- [ ] **Application Health**: `https://www.onedollaragent.ai/health` returns healthy
- [ ] **Payment Flow**: Stripe checkout works with custom domain URLs

### Test Commands

```bash
# 1. DNS Resolution
nslookup www.onedollaragent.ai
dig www.onedollaragent.ai CNAME

# 2. SSL Certificate
curl -I https://www.onedollaragent.ai

# 3. Application Health
curl https://www.onedollaragent.ai/health

# 4. WebSocket Connection (from browser console)
new WebSocket('wss://www.onedollaragent.ai/ws')
```

## ⚡ Troubleshooting

### Common Issues

#### 1. DNS Not Resolving
**Symptom**: Domain doesn't resolve or points to wrong location
**Solution**: 
- Verify DNS records are correct
- Check with `nslookup www.onedollaragent.ai`
- Wait 1-24 hours for propagation

#### 2. SSL Certificate Issues
**Symptom**: "Not Secure" or certificate warnings
**Solution**:
- Ensure domain verification is complete in Replit
- Wait 5-15 minutes after verification
- Check TXT record is properly set

#### 3. CORS Errors
**Symptom**: API calls fail with CORS errors
**Solution**:
- Verify `ALLOWED_ORIGINS` includes custom domain
- Check `FRONTEND_URL` is set correctly
- Restart Replit deployment after environment changes

#### 4. Stripe Payment Issues
**Symptom**: Payment redirects fail or show errors
**Solution**:
- Verify webhook URL in Stripe dashboard
- Update success/cancel URLs to use custom domain
- Test payment flow end-to-end

### Diagnostic Tools

```bash
# DNS Diagnostic
dig +trace www.onedollaragent.ai

# SSL Diagnostic
openssl s_client -connect www.onedollaragent.ai:443 -servername www.onedollaragent.ai

# HTTP Headers
curl -I -H "User-Agent: Mozilla/5.0" https://www.onedollaragent.ai
```

## 🔧 Environment Variables for Production

Set these in your Replit deployment:

```env
# Domain Configuration
FRONTEND_URL=https://www.onedollaragent.ai
ALLOWED_ORIGINS=https://onedollaragent.ai,https://www.onedollaragent.ai

# Force HTTPS (automatically enabled for custom domains)
NODE_ENV=production

# Stripe Configuration (update webhook URL in Stripe dashboard)
STRIPE_WEBHOOK_URL=https://www.onedollaragent.ai/api/stripe/webhook
```

## ✅ Go-Live Checklist

Before switching traffic to custom domain:

- [ ] DNS records configured and propagated
- [ ] SSL certificate active and valid
- [ ] Application health checks passing
- [ ] Environment variables updated
- [ ] Stripe webhook URL updated in dashboard
- [ ] CORS origins include custom domain
- [ ] Payment flow tested end-to-end
- [ ] WebSocket connections tested
- [ ] All absolute URLs use custom domain

## 📞 Support Resources

- **Replit Custom Domains**: https://docs.replit.com/hosting/custom-domains
- **DNS Checker**: https://dnschecker.org
- **SSL Checker**: https://www.sslshopper.com/ssl-checker.html
- **Stripe Webhook Testing**: Stripe Dashboard → Webhooks → Test webhook

---

*Last Updated: September 2025*
*Application: Agent HQ - AI Browser Automation Platform*