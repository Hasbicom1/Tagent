# 🧪 E2E Test Runner Script (PowerShell)
# 
# This script runs the complete end-to-end test suite
# with proper environment setup and cleanup.

param(
    [switch]$UI,
    [switch]$Headed,
    [switch]$Debug,
    [switch]$Report,
    [switch]$Help
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$NC = "`e[0m" # No Color

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "${Blue}[INFO]${NC} $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "${Green}[SUCCESS]${NC} $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "${Yellow}[WARNING]${NC} $Message"
}

function Write-Error {
    param([string]$Message)
    Write-Host "${Red}[ERROR]${NC} $Message"
}

# Show help if requested
if ($Help) {
    Write-Host "Usage: .\scripts\run-e2e-tests.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -UI       Run tests with interactive UI"
    Write-Host "  -Headed   Run tests in headed mode (visible browser)"
    Write-Host "  -Debug    Run tests in debug mode"
    Write-Host "  -Report   Generate HTML report"
    Write-Host "  -Help     Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\run-e2e-tests.ps1                    # Run all tests"
    Write-Host "  .\scripts\run-e2e-tests.ps1 -UI               # Run with interactive UI"
    Write-Host "  .\scripts\run-e2e-tests.ps1 -Headed           # Run with visible browser"
    Write-Host "  .\scripts\run-e2e-tests.ps1 -Debug            # Run in debug mode"
    Write-Host "  .\scripts\run-e2e-tests.ps1 -Report           # Generate HTML report"
    exit 0
}

Write-Status "🚀 Starting E2E Test Suite..."

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found. Please run this script from the project root."
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Status "npm version: $npmVersion"
} catch {
    Write-Error "npm is not installed. Please install npm first."
    exit 1
}

# Check if Playwright is installed
try {
    npm list @playwright/test | Out-Null
    Write-Status "Playwright is installed"
} catch {
    Write-Warning "Playwright not found. Installing..."
    npm install @playwright/test
}

# Install Playwright browsers
Write-Status "Installing Playwright browsers..."
npx playwright install

# Check environment variables
Write-Status "Checking environment variables..."

$requiredVars = @(
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "OPENAI_API_KEY",
    "REDIS_URL"
)

$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Warning "Missing environment variables: $($missingVars -join ', ')"
    Write-Warning "Tests may fail without proper configuration."
    Write-Warning "Please set these variables before running tests."
}

# Check if Redis is running (if available)
Write-Status "Checking Redis connection..."
try {
    redis-cli ping | Out-Null
    Write-Status "Redis server is running"
} catch {
    Write-Warning "Redis server not running. Please start Redis first."
    Write-Warning "Tests may fail without Redis."
}

# Check if database is accessible
Write-Status "Checking database connection..."
try {
    npm run db:push | Out-Null
    Write-Status "Database connection successful"
} catch {
    Write-Warning "Database connection failed. Please check your database setup."
    Write-Warning "Tests may fail without database access."
}

# Set test environment
$env:NODE_ENV = "test"
if (-not $env:TEST_BASE_URL) {
    $env:TEST_BASE_URL = "http://localhost:3000"
}

Write-Status "Test environment configured:"
Write-Status "  NODE_ENV: $env:NODE_ENV"
Write-Status "  TEST_BASE_URL: $env:TEST_BASE_URL"

# Build test arguments
$testArgs = @()

if ($UI) {
    $testArgs += "--ui"
}

if ($Headed) {
    $testArgs += "--headed"
}

if ($Debug) {
    $testArgs += "--debug"
}

if ($Report) {
    $testArgs += "--reporter=html"
}

# Run the tests
Write-Status "Starting E2E tests..."

try {
    if ($testArgs.Count -gt 0) {
        npx playwright test $testArgs
    } else {
        npx playwright test
    }
    
    Write-Success "All E2E tests passed! 🎉"
    
    # Show report if requested
    if ($Report) {
        Write-Status "Opening test report..."
        npx playwright show-report
    }
    
    exit 0
} catch {
    Write-Error "E2E tests failed! ❌"
    Write-Status "Check the test results above for details."
    Write-Status "You can run 'npx playwright show-report' to view detailed results."
    exit 1
}

