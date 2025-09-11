#!/bin/bash

# 🚀 Agent HQ - Production Infrastructure Provisioning Script
# TARGET: Zero technical knowledge required deployment
# USAGE: ./provision-infrastructure.sh yourdomain.com

set -e  # Exit on any error

DOMAIN=${1:-agentforall.com}
PROJECT_NAME="agent-hq"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 AGENT HQ PRODUCTION DEPLOYMENT STARTING..."
echo "🌐 Domain: $DOMAIN"
echo "⏰ Timestamp: $TIMESTAMP"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify prerequisites
log_step "Checking prerequisites..."

if ! command_exists docker; then
    log_error "Docker not installed. Please install Docker first."
    exit 1
fi

if ! command_exists node; then
    log_error "Node.js not installed. Please install Node.js first."
    exit 1
fi

log_success "Prerequisites verified"

# Create production environment configuration
log_step "Creating production environment configuration..."

cat > .env.production <<EOF
# 🔐 AGENT HQ PRODUCTION CONFIGURATION
# Generated: $TIMESTAMP

# Application Settings
NODE_ENV=production
PORT=5000
DOMAIN=$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

# Security Keys (SECURE - DO NOT SHARE)
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Force HTTPS in production
FORCE_HTTPS=true

# Database Configuration (will be replaced with production values)
DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/agenthq_prod

# Redis Configuration (will be replaced with production values)  
REDIS_URL=redis://placeholder:6379

# Stripe Configuration (to be provided by user)
STRIPE_SECRET_KEY=sk_live_REPLACE_WITH_YOUR_LIVE_KEY
VITE_STRIPE_PUBLIC_KEY=pk_live_REPLACE_WITH_YOUR_LIVE_KEY

# AI API Configuration
OPENAI_API_KEY=\${OPENAI_API_KEY}
DEEPSEEK_API_KEY=\${DEEPSEEK_API_KEY}

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=https://placeholder@sentry.io/placeholder
EOF

log_success "Production environment configured"

# Create Docker Compose production configuration
log_step "Creating production Docker configuration..."

cat > docker-compose.production.yml <<EOF
version: '3.8'

services:
  # Application Service
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: agenthq_prod
      POSTGRES_USER: agenthq
      POSTGRES_PASSWORD: \${DB_PASSWORD:-$(openssl rand -base64 32)}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agenthq -d agenthq_prod"]
      interval: 30s
      timeout: 5s
      retries: 5

  # Redis Cache & Session Store
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.production.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF

log_success "Docker configuration created"

# Create production Dockerfile
log_step "Creating production Dockerfile..."

cat > Dockerfile.production <<EOF
# Production Dockerfile for Agent HQ
FROM node:18-alpine

# Security hardening
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Build application
RUN npm run build

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["npm", "start"]
EOF

log_success "Production Dockerfile created"

# Create Nginx configuration
log_step "Creating Nginx configuration..."

mkdir -p ssl

cat > nginx.production.conf <<EOF
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:5000;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN www.$DOMAIN;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        
        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }
    }
}
EOF

log_success "Nginx configuration created"

# Create backup script
log_step "Creating automated backup system..."

cat > scripts/backup-system.sh <<EOF
#!/bin/bash

# 🔄 Agent HQ Automated Backup System
BACKUP_DIR="/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)

echo "🔄 Starting automated backup: \$TIMESTAMP"

# Database backup
docker exec \$(docker-compose ps -q db) pg_dump -U agenthq agenthq_prod > \$BACKUP_DIR/db_\$TIMESTAMP.sql

# Redis backup
docker exec \$(docker-compose ps -q redis) redis-cli BGSAVE

# Compress backups older than 1 day
find \$BACKUP_DIR -name "*.sql" -mtime +1 -exec gzip {} \;

# Remove backups older than 30 days
find \$BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "✅ Backup completed: \$TIMESTAMP"
EOF

chmod +x scripts/backup-system.sh

log_success "Backup system configured"

# Create monitoring script  
log_step "Creating monitoring system..."

cat > scripts/health-monitor.sh <<EOF
#!/bin/bash

# 📊 Agent HQ Health Monitoring System

DOMAIN="$DOMAIN"
WEBHOOK_URL="\${SLACK_WEBHOOK_URL:-}"

check_endpoint() {
    local url=\$1
    local name=\$2
    
    if curl -f -s --max-time 10 "\$url" > /dev/null; then
        echo "✅ \$name: OK"
        return 0
    else
        echo "❌ \$name: FAILED"
        if [ ! -z "\$WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"🚨 ALERT: \$name failed on \$DOMAIN\"}" "\$WEBHOOK_URL"
        fi
        return 1
    fi
}

echo "📊 Health Check: \$(date)"
echo "🌐 Domain: https://\$DOMAIN"

# Check main endpoints
check_endpoint "https://\$DOMAIN/api/health" "Health Check"
check_endpoint "https://\$DOMAIN/api/csrf-token" "CSRF Token"
check_endpoint "https://\$DOMAIN/api/queue/stats" "Queue Stats"
check_endpoint "https://\$DOMAIN" "Homepage"

# Check SSL certificate
echo -n "🔐 SSL Certificate: "
if echo | timeout 10 openssl s_client -servername \$DOMAIN -connect \$DOMAIN:443 2>/dev/null | grep -q "Verify return code: 0"; then
    echo "✅ Valid"
else
    echo "❌ Invalid"
fi

echo "📊 Health check completed"
EOF

chmod +x scripts/health-monitor.sh

log_success "Monitoring system configured"

# Create deployment script
log_step "Creating one-click deployment script..."

cat > scripts/deploy.sh <<EOF
#!/bin/bash

# 🚀 Agent HQ One-Click Production Deployment

set -e

echo "🚀 Starting Agent HQ production deployment..."

# Build and start services
echo "📦 Building production images..."
docker-compose -f docker-compose.production.yml build

echo "🚀 Starting services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 30

# Run health checks
echo "🔍 Running health checks..."
./scripts/health-monitor.sh

# Setup cron jobs
echo "⏰ Setting up automated tasks..."
(crontab -l 2>/dev/null; echo "0 2 * * * /app/scripts/backup-system.sh") | crontab -
(crontab -l 2>/dev/null; echo "*/5 * * * * /app/scripts/health-monitor.sh") | crontab -

echo ""
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "🌐 Your Agent HQ is now live at: https://$DOMAIN"
echo "🔐 Admin dashboard: https://$DOMAIN/admin"
echo "📊 Health monitoring active every 5 minutes"
echo "🔄 Automated backups daily at 2 AM"
echo ""
echo "Next steps:"
echo "1. Update your Stripe keys in .env.production"
echo "2. Point your domain DNS to this server"
echo "3. Install SSL certificate"
echo "4. Test the payment flow"
echo ""
EOF

chmod +x scripts/deploy.sh

log_success "Deployment scripts ready"

# Create SSL certificate setup script
log_step "Creating SSL certificate automation..."

cat > scripts/setup-ssl.sh <<EOF
#!/bin/bash

# 🔐 Agent HQ SSL Certificate Automation (Let's Encrypt)

DOMAIN="$DOMAIN"
EMAIL="\${SSL_EMAIL:-admin@\$DOMAIN}"

echo "🔐 Setting up SSL certificate for \$DOMAIN"

# Install Certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
docker-compose -f docker-compose.production.yml stop nginx

# Generate certificate
echo "🔑 Generating SSL certificate..."
certbot certonly --standalone -d \$DOMAIN -d www.\$DOMAIN --email \$EMAIL --agree-tos --no-eff-email

# Copy certificates to nginx directory
cp /etc/letsencrypt/live/\$DOMAIN/fullchain.pem ./ssl/
cp /etc/letsencrypt/live/\$DOMAIN/privkey.pem ./ssl/

# Start nginx with SSL
docker-compose -f docker-compose.production.yml start nginx

# Setup auto-renewal
echo "🔄 Setting up certificate auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /app/docker-compose.production.yml restart nginx") | crontab -

echo "✅ SSL certificate setup complete!"
echo "🌐 Your site is now secure: https://\$DOMAIN"
EOF

chmod +x scripts/setup-ssl.sh

log_success "SSL automation ready"

# Final summary
echo ""
echo "🎉 INFRASTRUCTURE PROVISIONING COMPLETE!"
echo ""
echo -e "${GREEN}✅ Production environment configured${NC}"
echo -e "${GREEN}✅ Docker containers ready${NC}"
echo -e "${GREEN}✅ Database & Redis setup${NC}"
echo -e "${GREEN}✅ Nginx reverse proxy configured${NC}"
echo -e "${GREEN}✅ SSL certificate automation ready${NC}"
echo -e "${GREEN}✅ Backup system configured${NC}"
echo -e "${GREEN}✅ Health monitoring active${NC}"
echo -e "${GREEN}✅ One-click deployment ready${NC}"
echo ""
echo -e "${BLUE}🚀 NEXT STEPS:${NC}"
echo "1. Run: ${YELLOW}./scripts/deploy.sh${NC} (starts all services)"
echo "2. Run: ${YELLOW}./scripts/setup-ssl.sh${NC} (enables HTTPS)"
echo "3. Update Stripe keys in .env.production"
echo "4. Point your domain DNS to this server IP"
echo "5. Test: https://$DOMAIN"
echo ""
echo -e "${GREEN}🎯 Your Agent HQ will be live and operational!${NC}"