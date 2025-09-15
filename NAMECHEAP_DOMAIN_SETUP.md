# Namecheap Domain Connection Guide for Railway

## Overview
Complete guide for connecting your Namecheap domain (onedollaragent.ai) to Railway deployment with SSL certificate setup.

---

## Step 1: Add Custom Domain in Railway

### 1.1 Navigate to Railway Dashboard
1. Login to [railway.app](https://railway.app)
2. Select your OneDollarAgent project
3. Go to **Settings** → **Domains**

### 1.2 Add Custom Domain
1. Click **"Add Custom Domain"**
2. Enter: `www.onedollaragent.ai`
3. Click **"Add Domain"**

### 1.3 Note Railway Values
Railway will display configuration values like:
```
Domain: www.onedollaragent.ai
CNAME Target: your-app-name.up.railway.app
Status: Pending DNS Configuration
```

**Keep this tab open - you'll need these values for Namecheap setup.**

---

## Step 2: Configure DNS in Namecheap

### 2.1 Access Namecheap DNS Management
1. Login to [namecheap.com](https://namecheap.com)
2. Go to **Domain List**
3. Find `onedollaragent.ai` and click **"Manage"**
4. Navigate to **"Advanced DNS"** tab

### 2.2 Clear Existing DNS Records
Remove any existing A, AAAA, or CNAME records that might conflict:
- Remove default parking page records
- Remove any existing www or @ records
- Keep only essential records (MX, TXT for email if needed)

### 2.3 Add New DNS Records

#### Primary Domain Records
Add these DNS records exactly as shown:

| Type  | Host | Value                          | TTL  |
|-------|------|--------------------------------|------|
| CNAME | www  | `your-app-name.up.railway.app` | 300  |
| A     | @    | `162.158.100.100`             | 300  |

**Replace `your-app-name.up.railway.app` with actual value from Railway**

#### Why These Records?
- **CNAME www**: Points www subdomain to Railway
- **A @**: Points apex domain to Railway's proxy IP
- **TTL 300**: Fast DNS updates (5 minutes)

### 2.4 Optional: Add Redirect Record
If you want `onedollaragent.ai` to redirect to `www.onedollaragent.ai`:

| Type       | Host | Value                          | TTL  |
|------------|------|--------------------------------|------|
| URL Redirect | @  | `https://www.onedollaragent.ai`| 300  |

---

## Step 3: Verify DNS Configuration

### 3.1 Check DNS Propagation
DNS changes can take up to 48 hours to propagate globally. Check status:

#### Online Tools
- [DNSChecker.org](https://dnschecker.org)
- [WhatsMyDNS.net](https://whatsmydns.net)
- [DNS Lookup Tool](https://mxtoolbox.com/DNSLookup.aspx)

#### Command Line Tools
```bash
# Check CNAME record
nslookup www.onedollaragent.ai

# Check A record  
nslookup onedollaragent.ai

# Detailed DNS info
dig www.onedollaragent.ai
dig onedollaragent.ai
```

### 3.2 Expected Results
When DNS is properly configured:

```bash
# www.onedollaragent.ai should resolve to Railway
$ nslookup www.onedollaragent.ai
Name: www.onedollaragent.ai
Address: [Railway IP addresses]

# onedollaragent.ai should resolve to redirect IP
$ nslookup onedollaragent.ai  
Name: onedollaragent.ai
Address: 162.158.100.100
```

---

## Step 4: SSL Certificate Setup

### 4.1 Automatic SSL Provisioning
Railway automatically provisions SSL certificates once DNS is configured:

1. **Detection**: Railway detects proper DNS configuration
2. **Request**: Let's Encrypt certificate requested automatically
3. **Validation**: Domain ownership validated via DNS
4. **Installation**: Certificate installed and activated
5. **Auto-renewal**: Certificate renews automatically every 90 days

### 4.2 Monitor SSL Status
Check SSL certificate status in Railway dashboard:
1. Go to **Settings** → **Domains**
2. Check certificate status next to your domain
3. Wait for "Active" status (usually 5-15 minutes after DNS propagation)

### 4.3 Verify SSL Certificate
```bash
# Check SSL certificate details
openssl s_client -connect www.onedollaragent.ai:443 -servername www.onedollaragent.ai

# Online SSL checker
# Visit: https://www.ssllabs.com/ssltest/
```

---

## Step 5: Test Domain Connection

### 5.1 Basic Connectivity Test
```bash
# Test HTTP redirect to HTTPS
curl -I http://www.onedollaragent.ai

# Test HTTPS connection
curl -I https://www.onedollaragent.ai

# Expected response: 200 OK with security headers
```

### 5.2 Application-Specific Tests
1. **Health Check**: `https://www.onedollaragent.ai/health`
2. **Home Page**: `https://www.onedollaragent.ai`
3. **API Endpoints**: Test critical functionality
4. **WebSocket**: Verify real-time features work

---

## Troubleshooting

### Common Issues & Solutions

#### Issue 1: Domain Shows "Not Secure" or Certificate Error

**Symptoms:**
- Browser shows "Not Secure" warning
- SSL certificate errors
- Mixed content warnings

**Solutions:**
1. **Wait for SSL Provisioning**: Allow 15-30 minutes after DNS configuration
2. **Check DNS**: Ensure CNAME points to correct Railway domain
3. **Clear Browser Cache**: Hard refresh or incognito mode
4. **Verify Domain**: Ensure domain added correctly in Railway

#### Issue 2: Domain Not Resolving

**Symptoms:**
- "This site can't be reached"
- DNS_PROBE_FINISHED_NXDOMAIN
- Connection timeout

**Solutions:**
1. **Check DNS Records**: Verify CNAME and A records in Namecheap
2. **Wait for Propagation**: DNS changes take up to 48 hours
3. **Check Railway Status**: Ensure deployment is running
4. **Verify Domain Spelling**: Double-check domain name accuracy

#### Issue 3: Railway Shows "Pending DNS Configuration"

**Symptoms:**
- Railway domain status shows "Pending"
- SSL certificate not provisioning
- Domain not accessible

**Solutions:**
1. **Verify CNAME**: Must point to exact Railway domain
2. **Remove Conflicts**: Clear conflicting DNS records
3. **Lower TTL**: Use 300 seconds for faster updates
4. **Check Propagation**: Use DNS checker tools

#### Issue 4: Apex Domain Not Working

**Symptoms:**
- `onedollaragent.ai` doesn't work
- Only `www.onedollaragent.ai` works
- Redirect not functioning

**Solutions:**
1. **Add A Record**: Point @ to Railway's proxy IP
2. **Use URL Redirect**: In Namecheap, add URL redirect
3. **Alternative**: Use ALIAS record if supported
4. **Railway Config**: Ensure both domains configured

### Emergency Rollback
If domain configuration breaks your site:

1. **Revert DNS**: Change DNS back to previous working configuration
2. **Use Railway Domain**: Access via `your-app.up.railway.app` temporarily
3. **Check Logs**: Review Railway logs for errors
4. **Contact Support**: Railway support for complex issues

---

## Advanced Configuration

### Multiple Subdomains
Add additional subdomains:

| Type  | Host | Value                          | TTL  |
|-------|------|--------------------------------|------|
| CNAME | api  | `your-app-name.up.railway.app` | 300  |
| CNAME | app  | `your-app-name.up.railway.app` | 300  |

### Email Configuration (Optional)
If using email with domain:

| Type | Host | Value              | Priority | TTL |
|------|----- |--------------------|----------|-----|
| MX   | @    | `mail.provider.com`| 10       | 300 |
| TXT  | @    | `v=spf1 ...`       | -        | 300 |

### CDN Integration
For static assets via CDN:

| Type  | Host | Value           | TTL  |
|-------|------|-----------------|------|
| CNAME | cdn  | `cdn.provider.com` | 3600 |

---

## Domain Management Best Practices

### 1. DNS Security
- Use minimum necessary TTL values
- Regularly audit DNS records
- Enable domain lock in Namecheap
- Use two-factor authentication

### 2. Certificate Management
- Monitor SSL expiration (Railway auto-renews)
- Test certificate chain validity
- Ensure HTTPS redirect is working
- Check mixed content issues

### 3. Performance Optimization
- Use appropriate TTL values
- Monitor DNS response times
- Consider using Railway's CDN
- Optimize for Core Web Vitals

### 4. Monitoring & Alerts
- Set up domain monitoring
- Monitor SSL certificate status
- Track DNS resolution times
- Alert on domain connectivity issues

---

## Final Verification Checklist

Before considering domain setup complete:

### DNS Configuration
- [ ] CNAME record for www subdomain
- [ ] A record for apex domain (if needed)
- [ ] DNS propagation verified globally
- [ ] No conflicting DNS records

### SSL Certificate
- [ ] Certificate provisioned automatically
- [ ] HTTPS accessible without warnings
- [ ] HTTP redirects to HTTPS
- [ ] Certificate chain valid

### Application Testing
- [ ] Home page loads correctly
- [ ] All application features work
- [ ] API endpoints respond correctly
- [ ] WebSocket connections establish
- [ ] Payment processing works (if applicable)

### Performance & Security
- [ ] Page load speed acceptable
- [ ] Security headers present
- [ ] Mixed content resolved
- [ ] CDN integration (if applicable)

---

This completes the Namecheap domain connection to Railway with SSL certificate setup for production deployment of www.onedollaragent.ai.