#!/bin/bash

# 🚀 RAILWAY DEPLOYMENT FIX SCRIPT
# This script helps you set the missing environment variables

echo "🔧 FIXING RAILWAY DEPLOYMENT - MISSING ENVIRONMENT VARIABLES"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Get Stripe keys from user
echo "🔑 STRIPE CONFIGURATION:"
echo "Please provide your Stripe publishable key:"
echo "   Get it from: https://dashboard.stripe.com/apikeys"
echo "   Should start with: pk_test_ or pk_live_"
read -p "VITE_STRIPE_PUBLIC_KEY: " STRIPE_PUBLIC_KEY

echo ""
echo "🌐 FRONTEND URL CONFIGURATION:"
echo "Enter your production frontend URL:"
echo "   Railway domain: https://your-app-name.railway.app"
echo "   Custom domain: https://www.onedollaragent.ai"
read -p "FRONTEND_URL: " FRONTEND_URL

echo ""
echo "🚀 SETTING ENVIRONMENT VARIABLES..."

# Set the variables
railway variables set VITE_STRIPE_PUBLIC_KEY="$STRIPE_PUBLIC_KEY"
railway variables set FRONTEND_URL="$FRONTEND_URL"

echo ""
echo "✅ ENVIRONMENT VARIABLES SET SUCCESSFULLY!"
echo ""
echo "🔄 TRIGGERING NEW DEPLOYMENT..."

# Trigger redeploy
railway redeploy

echo ""
echo "🎉 DEPLOYMENT FIXED!"
echo "   Check your Railway dashboard for deployment status"
echo "   Your app should be accessible at: $FRONTEND_URL"
