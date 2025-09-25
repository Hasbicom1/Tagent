#!/usr/bin/env node

// Generate production secrets for Agent For All
import crypto from 'crypto';

console.log('🔐 Agent For All - Production Secrets Generator\n');

const secrets = {
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  CSRF_SECRET: crypto.randomBytes(32).toString('hex'),
  WEBHOOK_SECRET: 'whsec_' + crypto.randomBytes(24).toString('hex'),
};

console.log('Add these to your .env.production file:\n');
console.log(`SESSION_SECRET=${secrets.SESSION_SECRET}`);
console.log(`CSRF_SECRET=${secrets.CSRF_SECRET}`);
console.log(`# Use actual Stripe webhook secret from dashboard instead:`);
console.log(`# STRIPE_WEBHOOK_SECRET=${secrets.WEBHOOK_SECRET}\n`);

console.log('🔒 Keep these secrets secure and never commit them to version control!');
console.log('📝 Update your .env.production with actual Stripe webhook secret from Stripe dashboard.');