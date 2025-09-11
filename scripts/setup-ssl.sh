#!/bin/bash

# SSL Certificate Setup Script for Agent For All
# Run this script on your production server to set up HTTPS

set -e

echo "🔐 Agent For All - SSL Certificate Setup"
echo "========================================"

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <domain.com>"
    echo "Example: $0 agenthq.ai"
    exit 1
fi

DOMAIN=$1

echo "🌐 Setting up SSL certificate for: $DOMAIN"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

# Stop nginx if running
if systemctl is-active --quiet nginx; then
    echo "⏹️  Stopping Nginx..."
    sudo systemctl stop nginx
fi

# Get SSL certificate
echo "🔒 Obtaining SSL certificate..."
sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN \
    --email admin@$DOMAIN \
    --agree-tos \
    --non-interactive \
    --expand

# Create nginx configuration with SSL
echo "⚙️  Configuring Nginx with SSL..."

# Replace domain variables in nginx config
sed "s/\${DOMAIN}/$DOMAIN/g" nginx.conf > /tmp/nginx-$DOMAIN.conf
sudo mv /tmp/nginx-$DOMAIN.conf /etc/nginx/nginx.conf

# Test nginx configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

# Start nginx
echo "🚀 Starting Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Setup auto-renewal
echo "🔄 Setting up SSL certificate auto-renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo "✅ SSL setup complete!"
echo "🌐 Your site should now be available at: https://$DOMAIN"
echo "🔒 SSL certificate will auto-renew every 60 days"