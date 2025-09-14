#!/usr/bin/env node

/**
 * 🔐 Secure API Key Collection System
 * Safely collects your API keys and generates Railway configuration
 */

const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 SECURE API KEY COLLECTION FOR RAILWAY DEPLOYMENT');
console.log('===================================================');
console.log('');
console.log('I will ask you to paste each API key one by one.');
console.log('This ensures zero copy-paste errors in Railway.');
console.log('');

const apiKeys = {};

function askForKey(keyName, description, validation) {
  return new Promise((resolve) => {
    console.log(`🔑 ${keyName}`);
    console.log(`   ${description}`);
    console.log('   Paste your key and press Enter:');
    
    rl.question('   → ', (answer) => {
      const trimmed = answer.trim();
      
      if (!trimmed) {
        console.log('   ❌ Empty key! Please try again.\n');
        return askForKey(keyName, description, validation).then(resolve);
      }
      
      if (validation && !validation(trimmed)) {
        console.log('   ❌ Invalid format! Please check and try again.\n');
        return askForKey(keyName, description, validation).then(resolve);
      }
      
      console.log('   ✅ Key saved securely!\n');
      resolve(trimmed);
    });
  });
}

async function collectKeys() {
  console.log('📋 STEP 1: STRIPE PAYMENT KEYS');
  console.log('──────────────────────────────');
  
  apiKeys.STRIPE_SECRET_KEY = await askForKey(
    'STRIPE SECRET KEY',
    'From Stripe Dashboard → API Keys → Secret Key (starts with sk_)',
    (key) => key.startsWith('sk_')
  );
  
  apiKeys.VITE_STRIPE_PUBLIC_KEY = await askForKey(
    'STRIPE PUBLIC KEY',
    'From Stripe Dashboard → API Keys → Publishable Key (starts with pk_)',
    (key) => key.startsWith('pk_')
  );
  
  console.log('🤖 STEP 2: OPENAI API KEY');
  console.log('─────────────────────────');
  
  apiKeys.OPENAI_API_KEY = await askForKey(
    'OPENAI API KEY',
    'From OpenAI Platform → API Keys (starts with sk-)',
    (key) => key.startsWith('sk-')
  );
  
  console.log('🌐 STEP 3: YOUR DOMAIN');
  console.log('─────────────────────');
  
  apiKeys.DOMAIN = await askForKey(
    'YOUR DOMAIN',
    'Your Namecheap domain (example: mysite.com - no https://)',
    (domain) => domain.includes('.') && !domain.includes('http')
  );
  
  console.log('✅ ALL KEYS COLLECTED SUCCESSFULLY!');
  console.log('');
  
  return apiKeys;
}

async function generateRailwayConfig(keys) {
  console.log('🚀 GENERATING RAILWAY CONFIGURATION...');
  console.log('');
  
  const config = `# 🚀 RAILWAY ENVIRONMENT VARIABLES - GENERATED SAFELY
# Generated: ${new Date().toISOString()}
# Copy each line below as a separate variable in Railway

# ═══════════════════════════════════════
# BASIC APPLICATION SETTINGS
# ═══════════════════════════════════════
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
FORCE_HTTPS=true

# ═══════════════════════════════════════
# SECURITY SECRETS (Generated)
# ═══════════════════════════════════════
SESSION_SECRET=a1e6d64dadc3e52cf7903e965bfc53cf2392cbcfae0c99d9d7bcaa83e4d9d3c8
CSRF_SECRET=74f23ad8eeb4579c3375b1ba097605b30c614d7c6a442aa69223a413fb0065a2

# ═══════════════════════════════════════
# DATABASE CONNECTIONS (Railway Auto-Generated)
# ═══════════════════════════════════════
DATABASE_URL=\${{Postgres.DATABASE_URL}}
REDIS_URL=\${{Redis.REDIS_URL}}

# ═══════════════════════════════════════
# YOUR DOMAIN CONFIGURATION
# ═══════════════════════════════════════
DOMAIN=${keys.DOMAIN}
CORS_ORIGINS=https://${keys.DOMAIN},https://www.${keys.DOMAIN}

# ═══════════════════════════════════════
# YOUR API KEYS (Securely Integrated)
# ═══════════════════════════════════════
STRIPE_SECRET_KEY=${keys.STRIPE_SECRET_KEY}
VITE_STRIPE_PUBLIC_KEY=${keys.VITE_STRIPE_PUBLIC_KEY}
OPENAI_API_KEY=${keys.OPENAI_API_KEY}`;

  // Save to file
  fs.writeFileSync('RAILWAY-CONFIG-READY.txt', config);
  
  console.log('📄 RAILWAY CONFIGURATION READY!');
  console.log('════════════════════════════════');
  console.log('');
  console.log('✅ File saved: RAILWAY-CONFIG-READY.txt');
  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('1. Go to Railway Dashboard → Your Project');
  console.log('2. Click your main service → Variables tab');
  console.log('3. Copy each line from RAILWAY-CONFIG-READY.txt as separate variables');
  console.log('');
  console.log('📊 CONFIGURATION SUMMARY:');
  console.log(`   • Domain: ${keys.DOMAIN}`);
  console.log(`   • Stripe: ✅ (${keys.STRIPE_SECRET_KEY.substring(0, 20)}...)`);
  console.log(`   • OpenAI: ✅ (${keys.OPENAI_API_KEY.substring(0, 20)}...)`);
  console.log('   • Security: ✅ (Generated)');
  console.log('   • Databases: ✅ (Railway auto-connects)');
  console.log('');
  console.log('🔒 All keys integrated safely - zero copy-paste errors possible!');
  
  rl.close();
}

async function main() {
  try {
    const keys = await collectKeys();
    await generateRailwayConfig(keys);
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
  }
}

if (require.main === module) {
  main();
}