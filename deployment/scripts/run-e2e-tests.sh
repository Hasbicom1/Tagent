#!/bin/bash

# 🧪 E2E Test Runner Script
# 
# This script runs the complete end-to-end test suite
# with proper environment setup and cleanup.

set -e  # Exit on any error

echo "🚀 Starting E2E Test Suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Check if Playwright is installed
if ! npm list @playwright/test &> /dev/null; then
    print_warning "Playwright not found. Installing..."
    npm install @playwright/test
fi

# Install Playwright browsers
print_status "Installing Playwright browsers..."
npx playwright install

# Check environment variables
print_status "Checking environment variables..."

required_vars=(
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "OPENAI_API_KEY"
    "REDIS_URL"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    print_warning "Missing environment variables: ${missing_vars[*]}"
    print_warning "Tests may fail without proper configuration."
    print_warning "Please set these variables before running tests."
fi

# Check if Redis is running
print_status "Checking Redis connection..."
if ! redis-cli ping &> /dev/null; then
    print_warning "Redis server not running. Please start Redis first."
    print_warning "Tests may fail without Redis."
fi

# Check if database is accessible
print_status "Checking database connection..."
if ! npm run db:push &> /dev/null; then
    print_warning "Database connection failed. Please check your database setup."
    print_warning "Tests may fail without database access."
fi

# Set test environment
export NODE_ENV=test
export TEST_BASE_URL=${TEST_BASE_URL:-"http://localhost:3000"}

print_status "Test environment configured:"
print_status "  NODE_ENV: $NODE_ENV"
print_status "  TEST_BASE_URL: $TEST_BASE_URL"

# Run the tests
print_status "Starting E2E tests..."

# Parse command line arguments
TEST_ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --ui)
            TEST_ARGS="$TEST_ARGS --ui"
            shift
            ;;
        --headed)
            TEST_ARGS="$TEST_ARGS --headed"
            shift
            ;;
        --debug)
            TEST_ARGS="$TEST_ARGS --debug"
            shift
            ;;
        --report)
            TEST_ARGS="$TEST_ARGS --reporter=html"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --ui       Run tests with interactive UI"
            echo "  --headed   Run tests in headed mode (visible browser)"
            echo "  --debug    Run tests in debug mode"
            echo "  --report   Generate HTML report"
            echo "  --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all tests"
            echo "  $0 --ui               # Run with interactive UI"
            echo "  $0 --headed           # Run with visible browser"
            echo "  $0 --debug            # Run in debug mode"
            echo "  $0 --report           # Generate HTML report"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run the tests
if npx playwright test $TEST_ARGS; then
    print_success "All E2E tests passed! 🎉"
    
    # Show report if requested
    if [[ "$TEST_ARGS" == *"--reporter=html"* ]]; then
        print_status "Opening test report..."
        npx playwright show-report
    fi
    
    exit 0
else
    print_error "E2E tests failed! ❌"
    print_status "Check the test results above for details."
    print_status "You can run 'npx playwright show-report' to view detailed results."
    exit 1
fi

