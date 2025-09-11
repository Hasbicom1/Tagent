#!/bin/bash
# Agent HQ - Production Deployment Script

echo "🚀 Deploying Agent HQ to production..."

# Check required environment variables
if [ ! -f .env.production ]; then
    echo "❌ Missing .env.production file. Copy .env.production.example and configure your values."
    exit 1
fi

# Load production environment
export $(cat .env.production | grep -v '#' | xargs)

# Verify critical environment variables
REQUIRED_VARS=("DATABASE_URL" "STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET" "OPENAI_API_KEY" "DB_PASSWORD")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Build and deploy
echo "📦 Building production containers..."
docker-compose -f docker-compose.yml build

echo "🗃️ Running database migrations..."
docker-compose -f docker-compose.yml run --rm app npm run db:push

echo "🚀 Starting production services..."
docker-compose -f docker-compose.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 30

echo "🏥 Checking health status..."
curl -f http://localhost:5000/api/health || echo "⚠️  Health check failed"

echo "✅ Agent HQ deployed successfully!"
echo "🌐 Access your app at: https://$DOMAIN"
echo "📊 Monitor with: docker-compose logs -f"