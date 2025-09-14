#!/usr/bin/env node

/**
 * 🚀 Railway Environment Variables Generator
 * This script safely extracts your Replit API keys and creates
 * the complete configuration for Railway deployment.
 */

console.log('🔐 PREPARING RAILWAY ENVIRONMENT VARIABLES');
console.log('==========================================');
console.log('');

// Get API keys from environment
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const VITE_STRIPE_PUBLIC_KEY = process.env.VITE_STRIPE_PUBLIC_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Check if all keys are available
const missingKeys = [];
if (!STRIPE_SECRET_KEY) missingKeys.push('STRIPE_SECRET_KEY');
if (!VITE_STRIPE_PUBLIC_KEY) missingKeys.push('VITE_STRIPE_PUBLIC_KEY');
if (!OPENAI_API_KEY) missingKeys.push('OPENAI_API_KEY');

if (missingKeys.length > 0) {
    console.log('❌ Missing API keys:', missingKeys.join(', '));
    console.log('');
    console.log('📝 Please add these to your Replit Secrets tab:');
    missingKeys.forEach(key => console.log(`   - ${key}`));
    process.exit(1);
}

console.log('✅ All API keys found!');
console.log('');

// Domain placeholder
const domainPlaceholder = 'YOUR-DOMAIN.com';

console.log('🎯 COPY THESE VALUES TO RAILWAY VARIABLES:');
console.log('==========================================');
console.log('');

console.log('📋 BASIC APPLICATION SETTINGS:');
console.log('NODE_ENV=production');
console.log('PORT=5000');
console.log('HOST=0.0.0.0');
console.log('FORCE_HTTPS=true');
console.log('');

console.log('🔐 SECURITY SECRETS:');
console.log('SESSION_SECRET=a1e6d64dadc3e52cf7903e965bfc53cf2392cbcfae0c99d9d7bcaa83e4d9d3c8');
console.log('CSRF_SECRET=74f23ad8eeb4579c3375b1ba097605b30c614d7c6a442aa69223a413fb0065a2');
console.log('');

console.log('💾 DATABASE CONNECTIONS (Railway auto-generates these):');
console.log('DATABASE_URL=${{Postgres.DATABASE_URL}}');
console.log('REDIS_URL=${{Redis.REDIS_URL}}');
console.log('');

console.log('🌐 DOMAIN CONFIGURATION (replace with your actual domain):');
console.log(`DOMAIN=${domainPlaceholder}`);
console.log(`CORS_ORIGINS=https://${domainPlaceholder},https://www.${domainPlaceholder}`);
console.log('');

console.log('🔑 YOUR API KEYS (copy exactly as shown):');
console.log(`STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}`);
console.log(`VITE_STRIPE_PUBLIC_KEY=${VITE_STRIPE_PUBLIC_KEY}`);
console.log(`OPENAI_API_KEY=${OPENAI_API_KEY}`);
console.log('');

console.log('==========================================');
console.log('🎯 RAILWAY SETUP STEPS:');
console.log('==========================================');
console.log('1. Go to Railway dashboard → Your project');
console.log('2. Click your main service (not databases)');
console.log('3. Click "Variables" tab');
console.log('4. Copy each line above as separate variables');
console.log('5. Replace YOUR-DOMAIN.com with your actual domain');
console.log('');

console.log('✅ Ready for Railway deployment!');
console.log('');

// Also save to file for easy reference
const fs = require('fs');
const envContent = `# Railway Environment Variables - Generated ${new Date().toISOString()}

# Basic Application Settings
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
FORCE_HTTPS=true

# Security Secrets
SESSION_SECRET=a1e6d64dadc3e52cf7903e965bfc53cf2392cbcfae0c99d9d7bcaa83e4d9d3c8
CSRF_SECRET=74f23ad8eeb4579c3375b1ba097605b30c614d7c6a442aa69223a413fb0065a2

# Database Connections (Railway auto-generates)
DATABASE_URL=\${{Postgres.DATABASE_URL}}
REDIS_URL=\${{Redis.REDIS_URL}}

# Domain Configuration (REPLACE with your domain)
DOMAIN=${domainPlaceholder}
CORS_ORIGINS=https://${domainPlaceholder},https://www.${domainPlaceholder}

# Your API Keys from Replit
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
VITE_STRIPE_PUBLIC_KEY=${VITE_STRIPE_PUBLIC_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
`;

fs.writeFileSync('railway-env-complete.txt', envContent);
console.log('📄 Complete configuration saved to: railway-env-complete.txt');
console.log('   You can also reference this file during setup!');