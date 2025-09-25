#!/bin/bash

# Production Deployment Script for Agent For All
# Deploy the $1 AI agent platform to production

set -e

echo "🚀 Agent For All - Production Deployment"
echo "========================================"

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <domain.com>"
    echo "Example: $0 agenthq.ai"
    exit 1
fi

DOMAIN=$1
PROJECT_DIR="/opt/agent-for-all"

echo "🌐 Deploying Agent For All to domain: $DOMAIN"

# Create project directory
echo "📁 Creating project directory..."
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# Copy project files (assumes you've already uploaded the code)
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please upload your project files first."
    exit 1
fi

echo "📋 Copying project files..."
cp -r . $PROJECT_DIR/

# Navigate to project directory
cd $PROJECT_DIR

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production not found!"
    echo "📝 Please create .env.production with:"
    echo "   - DOMAIN=$DOMAIN"
    echo "   - DATABASE_URL (from Neon database)"
    echo "   - STRIPE_SECRET_KEY (live key)"
    echo "   - STRIPE_WEBHOOK_SECRET (from Stripe dashboard)"
    echo "   - OPENAI_API_KEY"
    echo "   - REDIS_PASSWORD"
    echo "   - SESSION_SECRET (run: node scripts/generate-secrets.js)"
    echo "   - CSRF_SECRET (run: node scripts/generate-secrets.js)"
    exit 1
fi

# Load environment variables
export DOMAIN=$DOMAIN
source .env.production

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "⚠️  Please log out and back in for Docker permissions to take effect"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Setup SSL certificates
echo "🔐 Setting up SSL certificates..."
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh $DOMAIN

# Build and start services
echo "🔨 Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Test health endpoint
echo "🧪 Testing application health..."
if curl -f https://$DOMAIN/api/health > /dev/null 2>&1; then
    echo "✅ Application is healthy!"
else
    echo "❌ Health check failed. Checking logs..."
    docker-compose logs app
    exit 1
fi

# Setup log rotation
echo "📊 Setting up log rotation..."
sudo tee /etc/logrotate.d/agent-for-all > /dev/null <<EOF
/opt/agent-for-all/logs/*.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    create 0644 www-data www-data
    postrotate
        docker-compose restart app > /dev/null 2>&1 || true
    endscript
}
EOF

# Setup monitoring
echo "📈 Setting up basic monitoring..."
sudo tee /etc/systemd/system/agent-health-check.service > /dev/null <<EOF
[Unit]
Description=Agent For All Health Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -f https://$DOMAIN/api/health
User=www-data

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/agent-health-check.timer > /dev/null <<EOF
[Unit]
Description=Run Agent Health Check every 5 minutes
Requires=agent-health-check.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable agent-health-check.timer
sudo systemctl start agent-health-check.timer

echo ""
echo "🎉 Deployment Complete!"
echo "========================"
echo "🌐 Your Agent For All platform is live at: https://$DOMAIN"
echo "🔒 SSL certificate auto-renewal is configured"
echo "📊 Health monitoring is active"
echo "💳 Ready to accept $1/24-hour payments"
echo ""
echo "📋 Next Steps:"
echo "   1. Test the payment flow with a real payment"
echo "   2. Monitor logs: docker-compose logs -f"
echo "   3. Check health: curl https://$DOMAIN/api/health"
echo "   4. Update DNS A record to point $DOMAIN to this server IP"
echo ""
echo "🛡️  Security: All services are running behind Nginx reverse proxy"
echo "🔐 Redis, database, and app are not exposed to the internet"