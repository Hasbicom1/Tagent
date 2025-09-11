# 🚀 AGENT HQ - PRODUCTION DEPLOYMENT CHECKLIST

## **PRE-DEPLOYMENT CHECKLIST**

### ✅ **Environment Configuration**
- [ ] Copy `.env.production.complete` to `.env.production`  
- [ ] Set all CRITICAL variables (DATABASE_URL, REDIS_URL, JWT_SECRET, etc.)
- [ ] Verify API keys are valid (OPENAI_API_KEY, DEEPSEEK_API_KEY, STRIPE keys)
- [ ] Configure ALLOWED_ORIGINS for your domain
- [ ] Set strong JWT_SECRET (64+ characters)
- [ ] Set secure SESSION_SECRET (32+ characters)

### ✅ **Infrastructure Setup**
- [ ] PostgreSQL database provisioned and accessible
- [ ] Redis instance running and accessible  
- [ ] SSL certificates installed and configured
- [ ] Domain DNS pointing to server
- [ ] Nginx or load balancer configured
- [ ] Firewall rules configured (ports 80, 443, 5000 only - **NEVER expose port 3001**)

### ✅ **Security Validation**
- [ ] HTTPS redirect working (`curl -I http://yourdomain.com`)
- [ ] Security headers present (`curl -I https://yourdomain.com`)
- [ ] CSRF protection enabled and tested
- [ ] Rate limiting configured
- [ ] Webhook signatures verified (Stripe)

### ✅ **Application Health**
- [ ] Health check responds: `curl https://yourdomain.com/api/health`
- [ ] Worker health check: `curl http://localhost:3001/health`
- [ ] Database connectivity verified
- [ ] Redis connectivity verified
- [ ] Queue system operational

---

## **DEPLOYMENT COMMANDS**

### **1. Build & Deploy**
```bash
# Run production deployment
./deploy.sh

# Or manual deployment:
npm run build
NODE_ENV=production npm start
```

### **2. Health Verification**
```bash
# Application health
curl https://yourdomain.com/api/health

# Worker health (localhost only - NEVER expose externally)
curl http://localhost:3001/health

# Database test
curl https://yourdomain.com/api/csrf-token

# Queue stats
curl https://yourdomain.com/api/queue/stats
```

### **3. Security Testing**
```bash
# HTTPS redirect
curl -I http://yourdomain.com

# Security headers
curl -I https://yourdomain.com

# Rate limiting
for i in {1..10}; do curl https://yourdomain.com/api/health; done
```

---

## **POST-DEPLOYMENT MONITORING**

### **📊 Key Metrics to Monitor**

1. **Application Health**
   - Response time < 500ms
   - Error rate < 1%
   - Uptime > 99.9%

2. **Resource Usage**  
   - CPU usage < 80%
   - Memory usage < 80%
   - Disk space > 20% free

3. **Security Events**
   - Rate limit violations
   - Failed authentication attempts  
   - Suspicious API usage

4. **Business Metrics**
   - Payment success rate > 98%
   - Session creation rate
   - Active agent sessions
   - Browser automation success rate

### **🔍 Monitoring Commands**
```bash
# Resource usage
top -p $(pgrep node)
free -h
df -h

# Application logs
pm2 logs agent-hq
tail -f /var/log/nginx/agent-hq.log

# Database performance  
SELECT count(*) FROM sessions WHERE is_active = true;
SELECT count(*) FROM messages WHERE timestamp > NOW() - INTERVAL '1 hour';

# Redis monitoring
redis-cli INFO memory
redis-cli INFO stats
```

---

## **PERFORMANCE BENCHMARKS**

### **Target Performance Goals**
- **Page Load Time**: < 3 seconds
- **API Response Time**: < 500ms (95th percentile)
- **WebSocket Connection**: < 100ms
- **Browser Automation**: < 30 seconds per task
- **Payment Processing**: < 5 seconds

### **Load Testing Commands**
```bash
# API load test
ab -n 100 -c 10 https://yourdomain.com/api/health

# WebSocket connections
wscat -c wss://yourdomain.com/ws

# Payment flow test
curl -X POST https://yourdomain.com/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"csrfToken":"test-token-1234567890123456"}'
```

---

## **TROUBLESHOOTING GUIDE**

### **🚨 Common Issues & Solutions**

#### **Health Check Failing**
```bash
# Check if service is running
systemctl status agent-hq
pm2 list

# Check logs for errors
pm2 logs agent-hq --lines 50
journalctl -u agent-hq -n 50
```

#### **Database Connection Issues**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

#### **Redis Connection Issues**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli INFO memory
```

#### **SSL Certificate Problems**
```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.pem -text -noout | grep -A 2 "Validity"

# Test SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

#### **High Resource Usage**
```bash
# Find resource-heavy processes
top -o %CPU
top -o %MEM

# Check disk usage
du -sh /var/log/*
find /tmp -size +100M
```

---

## **EMERGENCY PROCEDURES**

### **🔥 Critical Incident Response**

#### **Service Down**
1. Check health endpoints
2. Restart services: `pm2 restart agent-hq`
3. Check logs for errors
4. Verify infrastructure (DB, Redis)
5. Escalate if needed

#### **High Error Rate**
1. Check error logs immediately
2. Verify external service status (Stripe, APIs)
3. Check resource usage
4. Consider rolling back if recent deployment

#### **Security Incident**
1. Check security event logs
2. Block suspicious IPs if needed
3. Verify payment system integrity
4. Review access logs
5. Document incident

#### **Payment Issues**
1. Verify Stripe webhook connectivity
2. Check payment processing logs
3. Verify SSL certificate validity
4. Test payment flow manually
5. Contact Stripe support if needed

---

## **MAINTENANCE SCHEDULE**

### **Daily**
- [ ] Check health endpoints
- [ ] Review error logs  
- [ ] Monitor resource usage
- [ ] Verify backup completion

### **Weekly**
- [ ] Update security patches
- [ ] Review performance metrics
- [ ] Check SSL certificate expiration
- [ ] Clean up old logs

### **Monthly**
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review security events
- [ ] Update dependencies
- [ ] Capacity planning review

---

## **🎯 SUCCESS CRITERIA**

**Your Agent HQ deployment is successful when:**
- ✅ All health checks return "healthy"
- ✅ Payment flow works end-to-end
- ✅ Browser automation executes successfully  
- ✅ WebSocket connections are stable
- ✅ Security monitoring is active
- ✅ Performance meets target benchmarks
- ✅ Monitoring alerts are configured

**🚀 Your production system is now ready to serve users!**