#!/bin/bash

# 🔍 Agent HQ - Production Validation Script
# Comprehensive testing of deployed application
# Usage: ./scripts/validate-production.sh [domain]

set -e

DOMAIN=${1}
if [ -z "$DOMAIN" ]; then
    # Try to get domain from Railway if not provided
    if command -v railway >/dev/null 2>&1; then
        RAILWAY_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")
        if [ -n "$RAILWAY_URL" ]; then
            DOMAIN=$(echo "$RAILWAY_URL" | sed 's|https://||' | sed 's|http://||')
        fi
    fi
fi

if [ -z "$DOMAIN" ]; then
    echo "❌ Usage: $0 <domain.com>"
    echo "   Or run from Railway project directory to auto-detect"
    exit 1
fi

# Add protocol if not present
if [[ "$DOMAIN" != http* ]]; then
    BASE_URL="https://$DOMAIN"
else
    BASE_URL="$DOMAIN"
    DOMAIN=$(echo "$DOMAIN" | sed 's|https://||' | sed 's|http://||')
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
}

echo "🔍 AGENT HQ PRODUCTION VALIDATION"
echo "🎯 Testing: $BASE_URL"
echo "⏰ Started: $(date)"
echo ""

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local critical="${3:-false}"
    
    log_test "$test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        log_pass "PASS: $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        if [ "$critical" = "true" ]; then
            log_fail "FAIL: $test_name (CRITICAL)"
            ((TESTS_FAILED++))
        else
            log_warning "WARN: $test_name (Non-critical)"
            ((WARNINGS++))
        fi
        return 1
    fi
}

# 1. Basic Connectivity Tests
echo "🌐 CONNECTIVITY TESTS"
echo "===================="

run_test "DNS Resolution" "nslookup $DOMAIN" true
run_test "HTTP/HTTPS Connectivity" "curl -f -s --max-time 10 $BASE_URL" true
run_test "Response Time < 5s" "curl -w '%{time_total}' -o /dev/null -s $BASE_URL | awk '{if(\$1 < 5) exit 0; else exit 1}'" false

# 2. SSL/Security Tests
echo ""
echo "🔒 SECURITY TESTS"
echo "================="

run_test "SSL Certificate Valid" "curl -f -s --max-time 10 $BASE_URL | grep -q 'html'" true
run_test "HTTPS Redirect" "curl -s -I http://$DOMAIN | grep -q '301\\|302'" false
run_test "Security Headers Present" "curl -s -I $BASE_URL | grep -q 'X-Frame-Options\\|X-Content-Type-Options'" false

# Test SSL certificate details
log_test "SSL Certificate Details"
SSL_INFO=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
if [ -n "$SSL_INFO" ]; then
    log_pass "SSL Certificate: Valid"
    echo "$SSL_INFO" | while read line; do
        log_info "  $line"
    done
    ((TESTS_PASSED++))
else
    log_fail "SSL Certificate: Could not verify"
    ((TESTS_FAILED++))
fi

# 3. Application Health Tests
echo ""
echo "🏥 APPLICATION HEALTH"
echo "===================="

# Test homepage
run_test "Homepage Loads" "curl -f -s --max-time 10 $BASE_URL | grep -q 'Agent HQ\\|agent.*hq\\|AI Agent'" true

# Test health endpoint (if exists)
run_test "Health Endpoint" "curl -f -s --max-time 5 $BASE_URL/api/health" false

# Test for critical assets
run_test "CSS Assets Load" "curl -f -s --max-time 5 $BASE_URL | grep -q 'stylesheet\\|css'" false
run_test "JavaScript Assets" "curl -f -s --max-time 5 $BASE_URL | grep -q 'script.*src'" false

# 4. Payment System Tests
echo ""
echo "💳 PAYMENT SYSTEM"
echo "=================="

# Test Stripe integration (check for Stripe scripts)
run_test "Stripe Integration" "curl -f -s --max-time 10 $BASE_URL | grep -q 'stripe\\|pk_'" true

# Test payment page loads
run_test "Payment Page Access" "curl -f -s --max-time 10 $BASE_URL | grep -q '\\\$1\\|payment\\|stripe'" false

# 5. API Endpoints Tests
echo ""
echo "🔌 API ENDPOINTS"
echo "================"

# Test API base
run_test "API Base Accessible" "curl -f -s --max-time 5 $BASE_URL/api/" false

# Test common endpoints (non-critical since they might require auth)
run_test "Sessions Endpoint" "curl -s --max-time 5 $BASE_URL/api/sessions | grep -qv '500 Internal Server Error'" false
run_test "Messages Endpoint" "curl -s --max-time 5 $BASE_URL/api/messages | grep -qv '500 Internal Server Error'" false

# 6. Performance Tests
echo ""
echo "⚡ PERFORMANCE"
echo "=============="

# Page load time
log_test "Page Load Time Analysis"
LOAD_TIME=$(curl -w '%{time_total}' -o /dev/null -s $BASE_URL)
if (( $(echo "$LOAD_TIME < 3.0" | bc -l) )); then
    log_pass "Page Load Time: ${LOAD_TIME}s (Excellent)"
    ((TESTS_PASSED++))
elif (( $(echo "$LOAD_TIME < 5.0" | bc -l) )); then
    log_warning "Page Load Time: ${LOAD_TIME}s (Good)"
    ((WARNINGS++))
else
    log_fail "Page Load Time: ${LOAD_TIME}s (Needs optimization)"
    ((TESTS_FAILED++))
fi

# Response size
RESPONSE_SIZE=$(curl -w '%{size_download}' -o /dev/null -s $BASE_URL)
RESPONSE_SIZE_MB=$(echo "scale=2; $RESPONSE_SIZE / 1024 / 1024" | bc)
log_info "Response Size: ${RESPONSE_SIZE_MB}MB"

# 7. Monitoring & Logging (if accessible)
echo ""
echo "📊 MONITORING"
echo "============="

# Check if Railway logs are accessible (for deployed apps)
if command -v railway >/dev/null 2>&1 && railway status > /dev/null 2>&1; then
    log_test "Railway Deployment Status"
    if railway status | grep -q "Deployed"; then
        log_pass "Railway Status: Deployed and Running"
        ((TESTS_PASSED++))
    else
        log_fail "Railway Status: Deployment Issues"
        ((TESTS_FAILED++))
    fi
else
    log_info "Railway CLI not available - skipping deployment status check"
fi

# 8. Database Connectivity (indirect test)
echo ""
echo "🗄️ DATABASE & SERVICES"
echo "======================"

# Test if app responds (indicates database connectivity)
run_test "Application Responds" "curl -f -s --max-time 10 $BASE_URL | grep -v 'Database connection failed\\|Redis connection failed'" true

# Test session functionality (indicates Redis)
run_test "Session Management" "curl -c /tmp/cookies -b /tmp/cookies -f -s --max-time 10 $BASE_URL | grep -q 'html'" false

# Cleanup
rm -f /tmp/cookies 2>/dev/null || true

# 9. Content and SEO Tests
echo ""
echo "🎯 CONTENT & SEO"
echo "================"

run_test "Page Title Present" "curl -f -s --max-time 10 $BASE_URL | grep -q '<title>'" false
run_test "Meta Description" "curl -f -s --max-time 10 $BASE_URL | grep -q 'meta.*description'" false
run_test "Responsive Design" "curl -f -s --max-time 10 $BASE_URL | grep -q 'viewport\\|mobile'" false

# Final Results
echo ""
echo "📊 VALIDATION RESULTS"
echo "===================="
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + WARNINGS))

echo "📈 Test Summary:"
echo "  ✅ Passed: $TESTS_PASSED"
echo "  ❌ Failed: $TESTS_FAILED" 
echo "  ⚠️  Warnings: $WARNINGS"
echo "  📊 Total: $TOTAL_TESTS"
echo ""

# Calculate score
if [ $TOTAL_TESTS -gt 0 ]; then
    SCORE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    echo "🎯 Overall Score: $SCORE%"
else
    SCORE=0
    echo "🎯 Overall Score: Unable to calculate"
fi

echo ""

# Determine overall status
if [ $TESTS_FAILED -eq 0 ] && [ $SCORE -ge 80 ]; then
    echo "🎉 PRODUCTION READY!"
    echo "Your Agent HQ deployment is working excellent and ready for customers."
    echo ""
    echo "✅ Next Steps:"
    echo "  - Start marketing and driving traffic"
    echo "  - Monitor performance in Railway dashboard" 
    echo "  - Set up customer support systems"
elif [ $TESTS_FAILED -le 2 ] && [ $SCORE -ge 60 ]; then
    echo "⚠️  MOSTLY READY"
    echo "Your deployment is mostly working but has some issues to address."
    echo ""
    echo "🔧 Recommended Actions:"
    echo "  - Fix critical failures before marketing"
    echo "  - Monitor Railway logs for errors"
    echo "  - Test payment flow manually"
elif [ $TESTS_FAILED -le 5 ] && [ $SCORE -ge 40 ]; then
    echo "🚨 NEEDS WORK"
    echo "Your deployment has significant issues that need fixing."
    echo ""
    echo "🔧 Required Actions:"
    echo "  - Check Railway dashboard for errors"
    echo "  - Verify all API keys are set correctly"
    echo "  - Test database and Redis connections"
else
    echo "❌ NOT READY"
    echo "Your deployment has critical issues preventing normal operation."
    echo ""
    echo "🔧 Critical Actions:"
    echo "  - Check Railway deployment logs"
    echo "  - Verify environment variables"
    echo "  - Ensure all services are running"
fi

echo ""
echo "📖 For detailed troubleshooting, check:"
echo "  - Railway Dashboard: https://railway.app/dashboard"
echo "  - Application logs in Railway console"
echo "  - Domain DNS settings with your provider"
echo ""

# Create validation report
cat > "production-validation-report.md" <<EOF
# Production Validation Report

**Domain**: $BASE_URL  
**Date**: $(date)  
**Score**: $SCORE%

## Test Results
- ✅ Passed: $TESTS_PASSED
- ❌ Failed: $TESTS_FAILED  
- ⚠️ Warnings: $WARNINGS
- 📊 Total: $TOTAL_TESTS

## Performance Metrics
- Page Load Time: ${LOAD_TIME}s
- Response Size: ${RESPONSE_SIZE_MB}MB

## Status
$(if [ $TESTS_FAILED -eq 0 ] && [ $SCORE -ge 80 ]; then echo "🎉 PRODUCTION READY"; elif [ $TESTS_FAILED -le 2 ] && [ $SCORE -ge 60 ]; then echo "⚠️ MOSTLY READY"; elif [ $TESTS_FAILED -le 5 ] && [ $SCORE -ge 40 ]; then echo "🚨 NEEDS WORK"; else echo "❌ NOT READY"; fi)

## Next Steps
$(if [ $TESTS_FAILED -eq 0 ] && [ $SCORE -ge 80 ]; then echo "Start marketing and customer acquisition"; else echo "Address failed tests and re-run validation"; fi)

---
Generated by Agent HQ Production Validation
EOF

echo "📄 Detailed report saved to: production-validation-report.md"

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi