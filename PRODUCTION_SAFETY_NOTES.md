# 🛡️ PRODUCTION SAFETY GUIDELINES

## **CRITICAL SECURITY WARNINGS**

### **🚨 PORT EXPOSURE - SECURITY CRITICAL**
- **NEVER expose port 3001 externally** - Worker health endpoint is localhost-only
- **Firewall Configuration**: Block port 3001 from external access
- **Load Balancer**: Only expose ports 80, 443, and 5000

### **⚠️ CONFIGURATION RESTRICTIONS**
- **Vite Configuration**: FORBIDDEN to modify `vite.config.ts` or `server/vite.ts` 
- **Package.json**: FORBIDDEN to edit without explicit approval
- **Database Schema**: Use `npm run db:push` for schema changes, never manual SQL

### **🔧 SAFE OPTIMIZATION PRACTICES**

#### **Middleware Order**
When adding production middleware, maintain this order in `server/index.ts`:
1. Trust proxy configuration
2. Security headers (Helmet)
3. Custom security headers
4. **NEW: Compression middleware (production only)**
5. Session middleware
6. CSRF protection
7. Route handlers

#### **Environment-Specific Features**
```typescript
// Safe pattern for production-only features
if (process.env.NODE_ENV === 'production') {
  // Add production optimizations here
  app.use(compressionMiddleware);
}
```

#### **Database Index Safety**
- Use `CREATE INDEX CONCURRENTLY` for zero-downtime index creation
- Test indexes on development data first
- Monitor query performance after index deployment

### **🔍 CORS AND ORIGIN VALIDATION**

The application handles origin validation at multiple layers:
- **WebSocket**: Origin validation in `server/websocket.ts`
- **Same-Origin Policy**: Enforced by browser for API requests
- **Nginx/Proxy**: Configure CORS headers at reverse proxy level

### **📊 MONITORING REQUIREMENTS**

#### **Critical Alerts**
- Port 3001 external access attempts (security breach)
- High memory usage (> 80% for 5+ minutes)
- API response times > 1000ms (performance degradation)
- Failed health checks (service outage)

#### **Log Monitoring**
```bash
# Security monitoring
grep "port 3001" /var/log/nginx/access.log  # Should be empty!
grep "Worker health" /var/log/application.log

# Performance monitoring  
grep "response_time" /var/log/application.log | tail -100
```

### **🚀 DEPLOYMENT VERIFICATION**

#### **Pre-Deployment Checklist**
- [ ] Port 3001 blocked by firewall
- [ ] Health endpoints responding correctly
- [ ] SSL certificates valid and renewed
- [ ] Environment variables properly redacted in logs
- [ ] No forbidden configuration changes applied

#### **Post-Deployment Validation**
```bash
# Verify port 3001 is NOT accessible externally
curl -m 5 https://yourdomain.com:3001/health  # Should FAIL

# Verify correct health endpoint works
curl https://yourdomain.com/api/health  # Should succeed

# Verify security headers
curl -I https://yourdomain.com | grep -E "(Security|HSTS|CSP)"
```

### **🛠️ TROUBLESHOOTING SAFETY**

#### **Safe Commands Only**
```bash
# SAFE: Read-only operations
curl https://yourdomain.com/api/health
curl http://localhost:3001/health  # Only from server itself
pm2 logs --lines 50
systemctl status agent-hq

# SAFE: Graceful restarts
pm2 restart agent-hq --wait-ready
systemctl reload nginx

# AVOID: Hard kills or forceful operations in production
# pm2 kill  ❌
# killall -9 node  ❌
```

#### **Emergency Procedures**
1. **High Load**: Scale horizontally before vertical
2. **Memory Leaks**: Restart workers gracefully with `pm2 restart`
3. **Security Incident**: Block suspicious IPs at firewall level first
4. **Database Issues**: Check connection pool before restarting services

### **✅ COMPLIANCE CHECKLIST**

#### **Security Compliance**
- [ ] No internal ports exposed externally
- [ ] All secrets properly redacted in logs
- [ ] HTTPS enforced for all external traffic
- [ ] Rate limiting active and monitored
- [ ] Security events logged and alerting

#### **Performance Compliance**
- [ ] Response times within SLA (< 500ms 95th percentile)
- [ ] Memory usage within limits (< 80%)
- [ ] Database queries optimized with proper indexes
- [ ] Static assets properly cached and compressed

#### **Monitoring Compliance**
- [ ] Health checks responding
- [ ] Logs properly rotated and archived
- [ ] Metrics collected and dashboards updated
- [ ] Alerts configured for critical thresholds
- [ ] Backup verification automated

---

**🎯 Remember: Safety first, performance second, features third.**
**When in doubt, prioritize security and stability over optimization.**