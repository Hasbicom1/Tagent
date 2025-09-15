# 🚀 Custom Domain Migration Guide: www.onedollaragent.ai

## Overview
Complete step-by-step guide for migrating Agent HQ from Replit's default domain to the custom domain **www.onedollaragent.ai**.

## 📋 Pre-Migration Checklist

### Application Status
- [ ] **Current Deployment**: Application running successfully on Replit
- [ ] **Health Checks**: All endpoints returning healthy status
- [ ] **Payment Flow**: Stripe integration working on current domain
- [ ] **Environment Variables**: All production secrets configured
- [ ] **Database**: Production database connected and functional

### Domain Prerequisites
- [ ] **Domain Ownership**: Verified ownership of onedollaragent.ai
- [ ] **DNS Access**: Admin access to domain registrar DNS settings
- [ ] **SSL Requirements**: Understanding of SSL certificate provisioning
- [ ] **Backup Plan**: Current working domain documented for rollback

## 🔧 Phase 1: Application Configuration

### 1.1 Update Environment Variables

```bash
# In Replit Secrets (Environment Variables)
FRONTEND_URL=https://www.onedollaragent.ai
ALLOWED_ORIGINS=https://onedollaragent.ai,https://www.onedollaragent.ai,https://[current-replit-url]
NODE_ENV=production
```

### 1.2 Verify Code Changes

The application has been updated to support custom domains:

✅ **Environment Configuration** (`server/env-config.ts`):
- Auto-detects `www.onedollaragent.ai` as production domain
- HTTPS enforcement for custom domain
- Validated URL construction

✅ **Security Configuration** (`server/security.ts`):
- CORS origins include custom domain
- CSP policies support custom domain
- Origin validation includes custom domain

✅ **URL Generation** (`server/routes.ts`):
- Dynamic base URL construction
- Stripe success/cancel URLs use custom domain
- Production domain detection updated

### 1.3 Test Application Locally (Optional)

```bash
# Test with custom domain simulation
FRONTEND_URL=https://www.onedollaragent.ai npm run dev
```

## 🌐 Phase 2: DNS Configuration

### 2.1 Initial DNS Setup

1. **Add DNS Records** (before domain verification):
   ```dns
   www.onedollaragent.ai    CNAME    [your-replit-url].replit.app
   ```

2. **Wait for Initial Propagation** (30-60 minutes):
   ```bash
   nslookup www.onedollaragent.ai
   ```

### 2.2 Replit Domain Verification

1. **Navigate to Replit Console**:
   - Go to your deployment
   - Click "Settings" → "Domains"

2. **Add Custom Domain**:
   - Enter: `www.onedollaragent.ai`
   - Copy the provided TXT verification record

3. **Add TXT Record to DNS**:
   ```dns
   _replit-domain-verification.onedollaragent.ai    TXT    "replit-verification-[provided-token]"
   ```

4. **Verify in Replit**:
   - Click "Verify Domain"
   - Wait for verification success (5-15 minutes)

### 2.3 SSL Certificate Provisioning

1. **Automatic SSL**: Replit provisions SSL automatically after verification
2. **Verification**: Check SSL status in Replit dashboard
3. **Testing**: 
   ```bash
   curl -I https://www.onedollaragent.ai
   ```

## 💳 Phase 3: Payment Integration Updates

### 3.1 Update Stripe Dashboard

1. **Webhook Endpoint**:
   - Navigate to: Stripe Dashboard → Webhooks
   - Update endpoint URL: `https://www.onedollaragent.ai/api/stripe/webhook`
   - Ensure events are configured:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

2. **Test Webhook Endpoint**:
   ```bash
   curl -X POST https://www.onedollaragent.ai/api/stripe/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

### 3.2 Verify Payment URLs

The application automatically uses the custom domain for:
- Success URL: `https://www.onedollaragent.ai/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `https://www.onedollaragent.ai/cancel`

## 🧪 Phase 4: Testing & Validation

### 4.1 Connectivity Tests

```bash
# DNS Resolution
nslookup www.onedollaragent.ai
dig www.onedollaragent.ai

# SSL Certificate
curl -I https://www.onedollaragent.ai

# Application Health
curl https://www.onedollaragent.ai/health

# API Endpoints
curl https://www.onedollaragent.ai/api/csrf-token
```

### 4.2 Browser Testing

1. **Navigation**: Open `https://www.onedollaragent.ai`
2. **SSL Verification**: Check for green lock icon
3. **Console Errors**: Verify no CORS or CSP violations
4. **WebSocket Connection**: Test real-time features

### 4.3 Payment Flow Testing

1. **Navigate to Payment**: `https://www.onedollaragent.ai/payment`
2. **Initiate Checkout**: Click payment button
3. **Complete Payment**: Use test card (4242 4242 4242 4242)
4. **Verify Success**: Should redirect to success page
5. **Check Session**: Verify agent session activation

### 4.4 Full Integration Test

```javascript
// Test script (run in browser console on custom domain)
async function testIntegration() {
  // Test API connectivity
  const health = await fetch('/health');
  console.log('Health:', await health.json());
  
  // Test CSRF token
  const csrf = await fetch('/api/csrf-token');
  console.log('CSRF:', await csrf.json());
  
  // Test WebSocket
  const ws = new WebSocket(`wss://${window.location.host}/ws`);
  ws.onopen = () => console.log('WebSocket: Connected');
  ws.onerror = (e) => console.log('WebSocket Error:', e);
  
  console.log('Integration test complete');
}

testIntegration();
```

## 🔄 Phase 5: Traffic Switching

### 5.1 Gradual Migration Strategy

1. **Dual Domain Support** (Week 1):
   - Keep both domains active
   - Monitor traffic and errors
   - Test payment flows on both domains

2. **Primary Domain Switch** (Week 2):
   - Update marketing materials to use custom domain
   - Set up redirects from old domain (if desired)
   - Monitor performance and errors

3. **Full Migration** (Week 3):
   - Custom domain as primary
   - Legacy domain for fallback only

### 5.2 Monitoring Setup

```bash
# Health monitoring
curl https://www.onedollaragent.ai/health
curl https://www.onedollaragent.ai/health/ready

# Performance monitoring
curl -w "@curl-format.txt" -o /dev/null -s https://www.onedollaragent.ai/

# Error monitoring (check logs in Replit console)
```

## 🔙 Rollback Procedures

### 5.1 Emergency Rollback

If critical issues occur:

1. **Immediate DNS Rollback**:
   ```dns
   # Point back to original Replit URL
   www.onedollaragent.ai    CNAME    [original-replit-url].replit.app
   ```

2. **Revert Environment Variables**:
   ```env
   FRONTEND_URL=https://[original-replit-url].replit.app
   ALLOWED_ORIGINS=https://[original-replit-url].replit.app
   ```

3. **Update Stripe Webhook**:
   - Revert webhook URL to original domain in Stripe dashboard

### 5.2 Partial Rollback

For specific feature issues:

1. **Keep Custom Domain**: Continue serving on custom domain
2. **Fix Environment Variables**: Adjust only problematic configurations
3. **Selective Testing**: Test specific components in isolation

## 📊 Post-Migration Checklist

### Functionality Verification
- [ ] **Website Loading**: `https://www.onedollaragent.ai` loads correctly
- [ ] **SSL Certificate**: Green lock icon visible
- [ ] **Payment Flow**: End-to-end payment testing successful
- [ ] **WebSocket Connection**: Real-time features working
- [ ] **API Endpoints**: All API calls successful
- [ ] **Database Connection**: Data persistence working
- [ ] **Session Management**: User sessions maintained correctly

### Performance Verification
- [ ] **Page Load Speed**: Comparable to previous domain
- [ ] **API Response Time**: No degradation in API performance
- [ ] **WebSocket Latency**: Real-time features responsive
- [ ] **Database Queries**: No performance regression

### Security Verification
- [ ] **HTTPS Enforcement**: HTTP redirects to HTTPS
- [ ] **CORS Configuration**: No unauthorized origin access
- [ ] **CSP Headers**: Content Security Policy active
- [ ] **Security Headers**: All security headers present
- [ ] **Session Security**: Secure session handling

## 🔧 Maintenance & Monitoring

### 5.1 Regular Health Checks

```bash
# Daily health verification
curl https://www.onedollaragent.ai/health
curl https://www.onedollaragent.ai/health/ready

# Weekly payment testing
# Test checkout flow with test payments
```

### 5.2 SSL Certificate Monitoring

```bash
# Check SSL expiration
openssl s_client -connect www.onedollaragent.ai:443 2>/dev/null | openssl x509 -noout -dates

# Monthly SSL verification
curl -I https://www.onedollaragent.ai
```

### 5.3 Performance Monitoring

- **Monitor response times** for key endpoints
- **Track error rates** and performance degradation
- **Monitor payment success rates** with Stripe analytics

## ⚠️ Common Issues & Solutions

### 1. DNS Propagation Delays
**Symptom**: Custom domain not resolving
**Solution**: Wait 24-48 hours, verify DNS records, use DNS checkers

### 2. SSL Certificate Issues
**Symptom**: "Not Secure" warnings
**Solution**: Verify domain verification in Replit, wait for SSL provisioning

### 3. CORS Errors
**Symptom**: API calls failing from frontend
**Solution**: Verify `ALLOWED_ORIGINS` includes custom domain, restart deployment

### 4. Payment Failures
**Symptom**: Stripe checkout errors
**Solution**: Update webhook URL in Stripe dashboard, test endpoint connectivity

### 5. WebSocket Connection Issues
**Symptom**: Real-time features not working
**Solution**: Check WebSocket URL construction, verify WSS protocol on HTTPS

## 📞 Support & Resources

### Documentation
- [Custom Domain DNS Setup Guide](./CUSTOM_DOMAIN_DNS_SETUP.md)
- [Replit Custom Domains](https://docs.replit.com/hosting/custom-domains)
- [Stripe Webhook Setup](https://stripe.com/docs/webhooks)

### Testing Tools
- [DNS Checker](https://dnschecker.org)
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html)
- [WebSocket Test](https://websocketking.com/)

### Emergency Contacts
- **Domain Registrar Support**: For DNS configuration issues
- **Replit Support**: For hosting and SSL certificate issues
- **Stripe Support**: For payment processing issues

---

## ✅ Migration Completion

Once all phases are complete and verification passes:

1. **Document New URLs**: Update all documentation with custom domain
2. **Update Marketing**: Switch all promotional materials to custom domain
3. **Monitor Performance**: Establish baseline metrics for ongoing monitoring
4. **Celebrate Success**: Custom domain migration complete! 🎉

---

*Last Updated: September 2025*
*Migration Target: www.onedollaragent.ai*
*Application: Agent HQ - AI Browser Automation Platform*