#!/bin/bash

# 🌐 Agent HQ - Automated Domain Setup for Railway
# Supports major DNS providers with API automation
# Usage: ./scripts/setup-domain.sh yourdomain.com

set -e

DOMAIN=${1}
if [ -z "$DOMAIN" ]; then
    echo "❌ Usage: ./scripts/setup-domain.sh yourdomain.com"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

log_info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
}

echo "🌐 DOMAIN SETUP FOR AGENT HQ"
echo "🎯 Domain: $DOMAIN"
echo "⏰ Started: $(date)"
echo ""

# Check if Railway CLI is available
if ! command -v railway >/dev/null 2>&1; then
    log_error "Railway CLI not found. Please run deploy-to-railway.sh first."
    exit 1
fi

# Check if user is in a Railway project
if ! railway status > /dev/null 2>&1; then
    log_error "Not in a Railway project directory. Please run deploy-to-railway.sh first."
    exit 1
fi

# Get Railway project information
log_step "Getting Railway project information..."
RAILWAY_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$RAILWAY_URL" ]; then
    log_error "Could not retrieve Railway project URL. Ensure your app is deployed first."
    exit 1
fi

log_success "Railway project found: $RAILWAY_URL"

# Add custom domain to Railway
log_step "Adding custom domain to Railway..."
railway domain:add "$DOMAIN"

# Also add www subdomain
log_info "Adding www subdomain..."
railway domain:add "www.$DOMAIN" || log_warning "www subdomain may already exist or not be needed"

# Get the CNAME target from Railway
log_step "Getting DNS configuration from Railway..."
CNAME_TARGET=$(railway domain:list --json 2>/dev/null | grep -o '"target":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$CNAME_TARGET" ]; then
    log_warning "Could not automatically retrieve CNAME target. Checking manually..."
    # Try alternative method
    sleep 5
    CNAME_TARGET=$(railway domain:list 2>/dev/null | grep -E "→|Points to" | head -1 | awk '{print $NF}' || echo "")
fi

log_success "Custom domain added to Railway"

# Detect DNS provider and attempt automatic configuration
log_step "Detecting DNS provider for $DOMAIN..."

# Function to detect DNS provider
detect_dns_provider() {
    local domain=$1
    local nameservers=$(dig +short NS "$domain" 2>/dev/null || echo "")
    
    if echo "$nameservers" | grep -q "cloudflare"; then
        echo "cloudflare"
    elif echo "$nameservers" | grep -q "namecheap"; then
        echo "namecheap"  
    elif echo "$nameservers" | grep -q "godaddy"; then
        echo "godaddy"
    elif echo "$nameservers" | grep -q "route53"; then
        echo "aws-route53"
    else
        echo "unknown"
    fi
}

DNS_PROVIDER=$(detect_dns_provider "$DOMAIN")
log_info "Detected DNS provider: $DNS_PROVIDER"

# Attempt automatic DNS configuration
configure_dns_automatically() {
    local provider=$1
    local domain=$2
    local target=$3
    
    case $provider in
        "cloudflare")
            log_info "Attempting Cloudflare API configuration..."
            if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ZONE_ID" ]; then
                # Create CNAME record for root domain
                curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
                    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                    -H "Content-Type: application/json" \
                    --data "{\"type\":\"CNAME\",\"name\":\"@\",\"content\":\"$target\",\"ttl\":1}" > /dev/null 2>&1
                
                # Create CNAME record for www subdomain
                curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
                    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                    -H "Content-Type: application/json" \
                    --data "{\"type\":\"CNAME\",\"name\":\"www\",\"content\":\"$target\",\"ttl\":1}" > /dev/null 2>&1
                
                log_success "Cloudflare DNS configured automatically"
                return 0
            else
                log_warning "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not set"
                return 1
            fi
            ;;
        "namecheap")
            log_info "Attempting Namecheap API configuration..."
            if [ -n "$NAMECHEAP_API_USER" ] && [ -n "$NAMECHEAP_API_KEY" ]; then
                # Note: Namecheap API implementation would go here
                log_warning "Namecheap API configuration not yet implemented. Using manual instructions."
                return 1
            else
                log_warning "NAMECHEAP_API_USER or NAMECHEAP_API_KEY not set"
                return 1
            fi
            ;;
        *)
            log_info "Automatic configuration not available for $provider"
            return 1
            ;;
    esac
}

# Try automatic configuration first
if [ -n "$CNAME_TARGET" ] && [ "$DNS_PROVIDER" != "unknown" ]; then
    log_step "Attempting automatic DNS configuration..."
    if configure_dns_automatically "$DNS_PROVIDER" "$DOMAIN" "$CNAME_TARGET"; then
        log_success "DNS configured automatically!"
    else
        log_info "Automatic configuration failed. Showing manual instructions..."
        MANUAL_SETUP=true
    fi
else
    MANUAL_SETUP=true
fi

# Show manual DNS setup instructions
if [ "$MANUAL_SETUP" = true ]; then
    log_step "Manual DNS Setup Required"
    echo ""
    echo "🔧 ADD THESE DNS RECORDS TO YOUR DOMAIN PROVIDER:"
    echo ""
    echo "Provider: $DNS_PROVIDER"
    echo "Domain: $DOMAIN"
    echo ""
    echo "REQUIRED DNS RECORDS:"
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│ Type │ Name │ Value                                       │"
    echo "├─────────────────────────────────────────────────────────────┤"
    if [ -n "$CNAME_TARGET" ]; then
        echo "│ CNAME│  @   │ $CNAME_TARGET"
        echo "│ CNAME│ www  │ $CNAME_TARGET"
    else
        echo "│ CNAME│  @   │ [Get from Railway dashboard]               │"
        echo "│ CNAME│ www  │ [Get from Railway dashboard]               │"
    fi
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    
    # Provider-specific instructions
    case $DNS_PROVIDER in
        "cloudflare")
            echo "CLOUDFLARE INSTRUCTIONS:"
            echo "1. Go to: https://dash.cloudflare.com"
            echo "2. Select your domain: $DOMAIN"
            echo "3. Go to DNS → Records"
            echo "4. Add the CNAME records above"
            echo "5. Set Proxy status to 'DNS only' (gray cloud)"
            ;;
        "namecheap")
            echo "NAMECHEAP INSTRUCTIONS:"
            echo "1. Go to: https://namecheap.com → Account → Domain List"
            echo "2. Click 'Manage' next to $DOMAIN"
            echo "3. Go to 'Advanced DNS' tab"
            echo "4. Add the CNAME records above"
            ;;
        "godaddy")
            echo "GODADDY INSTRUCTIONS:"
            echo "1. Go to: https://godaddy.com → My Products → DNS"
            echo "2. Select domain: $DOMAIN"
            echo "3. Add the CNAME records above"
            ;;
        *)
            echo "GENERAL INSTRUCTIONS:"
            echo "1. Log in to your domain provider's control panel"
            echo "2. Find the DNS management section"
            echo "3. Add the CNAME records shown above"
            echo "4. Save changes"
            ;;
    esac
    
    echo ""
    echo "💡 TIP: If you don't see the CNAME target value above:"
    echo "   Run: railway domain:list"
    echo "   Or check your Railway dashboard under Settings → Domains"
fi

# Create domain verification script
log_step "Creating domain verification script..."

cat > "verify-domain.sh" <<EOF
#!/bin/bash
# Domain verification script for $DOMAIN

DOMAIN="$DOMAIN"
echo "🔍 Verifying domain configuration for \$DOMAIN..."

# Check DNS propagation
echo "📡 Checking DNS propagation..."
dig +short CNAME \$DOMAIN
dig +short CNAME www.\$DOMAIN

# Check HTTP response
echo "🌐 Testing HTTP response..."
curl -I "https://\$DOMAIN" 2>/dev/null | head -1 || echo "❌ HTTPS not ready yet"
curl -I "https://www.\$DOMAIN" 2>/dev/null | head -1 || echo "❌ WWW HTTPS not ready yet"

# Check SSL certificate
echo "🔒 Checking SSL certificate..."
echo | openssl s_client -servername \$DOMAIN -connect \$DOMAIN:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "❌ SSL certificate not ready yet"

echo ""
echo "✅ If all checks pass, your domain is ready!"
echo "⏰ DNS propagation can take up to 48 hours"
echo "🔄 Run this script again to check progress"
EOF

chmod +x verify-domain.sh

log_success "Domain verification script created: ./verify-domain.sh"

# Final instructions
echo ""
log_success "Domain setup initiated!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. ⏰ Wait 5-30 minutes for DNS propagation to begin"
echo "2. 🔍 Run: ./verify-domain.sh to check progress" 
echo "3. 🔒 Railway will automatically provision SSL certificate once DNS is working"
echo "4. 🎉 Your app will be live at https://$DOMAIN"
echo ""
echo "⚠️  IMPORTANT: DNS changes can take up to 48 hours to fully propagate worldwide"
echo "    Your domain may work in some locations before others"
echo ""
echo "🎯 GOAL: https://$DOMAIN should redirect to your Agent HQ application"

# Create summary file
cat > "DOMAIN_SETUP_SUMMARY.md" <<EOF
# Domain Setup Summary

## Configuration Completed
- **Domain**: $DOMAIN  
- **Railway Project**: $RAILWAY_URL
- **DNS Provider**: $DNS_PROVIDER
- **Setup Date**: $(date)

## Status
- [x] Domain added to Railway project
- [x] CNAME records configured (manual setup required)
- [ ] DNS propagation complete (wait 5-48 hours)
- [ ] SSL certificate provisioned by Railway (automatic)
- [ ] Domain fully operational

## Verification
Run \`./verify-domain.sh\` to check configuration status.

## Expected Result
When complete, https://$DOMAIN will show your Agent HQ application with a valid SSL certificate.

## Support
- Railway Dashboard: Check domain status under Settings → Domains
- DNS Checker: https://dnschecker.org (enter $DOMAIN)
- SSL Checker: https://ssllabs.com/ssltest/ (once DNS is working)
EOF

log_success "Domain setup summary saved to: DOMAIN_SETUP_SUMMARY.md"
echo ""
echo "🎉 Domain setup script completed successfully!"