# Agent HQ Production Deployment Guide

## System Requirements

Agent HQ is a production-ready AI browser automation platform requiring:
- Node.js 20+ with TypeScript
- PostgreSQL database (Neon recommended)
- Redis for queue management and sessions
- SSL/TLS certificate for HTTPS

## Environment Configuration

### Required Production Environment Variables

```bash
# Core Application
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis Configuration (REQUIRED for production)
REDIS_URL=redis://username:password@host:6379

# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret-64-chars-minimum
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SESSION_SECRET=your-super-secure-session-secret-64-chars-minimum

# OpenAI Integration (REQUIRED for full AI functionality)
OPENAI_API_KEY=sk-your-openai-api-key

# Stripe Payment Processing (REQUIRED for $1 sessions)
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-endpoint-secret
VITE_STRIPE_PUBLIC_KEY=pk_live_your-stripe-public-key

# Application URLs
FRONTEND_URL=https://yourdomain.com
WEBHOOK_URL=https://yourdomain.com/api/stripe/webhook

# Browser Automation Configuration
HEADLESS=false  # Set to true for server deployment
BROWSER_TYPE=chromium
MAX_CONCURRENT_TASKS=3
TASK_TIMEOUT=300000

# Worker Configuration
WORKER_ID=production-worker-1
MAX_CONCURRENT_TASKS=5
GRACEFUL_SHUTDOWN_TIMEOUT=30000
HEALTH_CHECK_PORT=3001
```

## Deployment Steps

### 1. Server Setup

```bash
# Clone and install dependencies
git clone <repository>
cd agent-hq
npm install

# Build application
npm run build

# Push database schema
npm run db:push
```

### 2. Redis Setup

```bash
# Option 1: Redis Cloud (recommended)
# Sign up at redis.com and get connection URL

# Option 2: Self-hosted Redis
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### 3. Stripe Configuration

1. **Create Stripe Account**: https://dashboard.stripe.com
2. **Get API Keys**: Dashboard → Developers → API keys
3. **Create Webhook Endpoint**: 
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### 4. SSL/TLS Setup

```nginx
# /etc/nginx/sites-available/agent-hq
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 5. Process Management

```bash
# Using PM2 (recommended)
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'agent-hq-server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'agent-hq-worker',
      script: 'worker/worker.ts',
      interpreter: 'tsx',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Start services
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Security Checklist

- ✅ HTTPS enforced with valid SSL certificate
- ✅ Strong JWT and session secrets (64+ characters)
- ✅ Redis password protection enabled
- ✅ Database connection over SSL
- ✅ CORS properly configured with allowed origins
- ✅ Rate limiting enabled (requires Redis)
- ✅ Webhook signature verification enabled
- ✅ Security headers configured via Nginx
- ✅ Environment variables secured (not in code)

## Monitoring & Maintenance

### Health Checks
```bash
# Application health
curl https://yourdomain.com/api/health

# Worker health
curl http://localhost:3001/health

# Database connection
curl https://yourdomain.com/api/csrf-token
```

### Log Monitoring
```bash
# PM2 logs
pm2 logs

# Application-specific logs
tail -f /var/log/nginx/agent-hq.log
journalctl -u postgresql -f
```

### Backup Strategy
```bash
# Database backup (daily cron)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Redis backup (if persistent)
redis-cli BGSAVE
```

## Troubleshooting

### Common Issues

**Agent Shows OFFLINE**
- Check `OPENAI_API_KEY` is valid
- Verify API key has sufficient credits
- Check network connectivity to OpenAI

**Payment Processing Fails**
- Verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- Check webhook endpoint is reachable
- Confirm webhook events are configured

**WebSocket Connection Errors**
- Verify `ALLOWED_ORIGINS` includes your domain
- Check Nginx WebSocket proxy configuration
- Ensure Redis is running for WebSocket coordination

**Queue Processing Stuck**
- Verify Redis connection and credentials
- Check worker processes are running
- Monitor Redis memory usage

### Performance Tuning

**Scale Workers**
```bash
# Increase worker instances
pm2 scale agent-hq-worker +2

# Monitor performance
pm2 monit
```

**Database Optimization**
```sql
-- Create indexes for common queries
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

## Production Validation

### Pre-Launch Checklist

1. **Environment**: All production environment variables set ✅
2. **Database**: Schema deployed and accessible ✅
3. **Redis**: Connected and responsive ✅
4. **SSL**: Certificate valid and HTTPS enforced ✅
5. **Payments**: Stripe webhook verified end-to-end ✅
6. **AI**: OpenAI API key valid and working ✅
7. **Workers**: Browser automation workers running ✅
8. **Monitoring**: Health checks and logging configured ✅

### Launch Testing

```bash
# Complete user journey test
curl -X POST https://yourdomain.com/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"csrfToken":"YOUR_CSRF_TOKEN"}'

# Agent activation test
curl -X POST https://yourdomain.com/api/session/PHOENIX-7742/message \
  -H "Content-Type: application/json" \
  -d '{"content":"Navigate to google.com"}'

# Browser automation execution test
curl -X POST https://yourdomain.com/api/session/PHOENIX-7742/execute \
  -H "Content-Type: application/json" \
  -d '{"taskDescription":"Take a screenshot","csrfToken":"YOUR_CSRF_TOKEN"}'
```

## Support & Scaling

- **Horizontal Scaling**: Add more worker instances via PM2
- **Database Scaling**: Use read replicas for session queries
- **CDN Integration**: Serve static assets via CloudFlare
- **Monitoring**: Set up alerts for API errors and payment failures

---

**Agent HQ Production Deployment Complete**

Your $1 AI browser automation platform is now production-ready with enterprise-grade security, scalability, and monitoring.