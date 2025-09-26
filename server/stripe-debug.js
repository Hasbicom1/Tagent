/**
 * STRIPE DEBUG MODULE - Production Server
 * 
 * Debugging and validation for Stripe payment gateway.
 * This module helps identify Stripe configuration issues.
 */

import Stripe from 'stripe';

/**
 * Debug Stripe configuration and connectivity
 */
export async function debugStripeConfiguration() {
  console.log('🔍 STRIPE DEBUG: Starting Stripe configuration check...');
  
  // Check environment variables
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePublishableKey = process.env.VITE_STRIPE_PUBLIC_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  console.log('🔍 STRIPE DEBUG: Environment variables check:');
  console.log(`   STRIPE_SECRET_KEY: ${stripeSecretKey ? 'SET' : 'NOT SET'}`);
  console.log(`   VITE_STRIPE_PUBLIC_KEY: ${stripePublishableKey ? 'SET' : 'NOT SET'}`);
  console.log(`   STRIPE_WEBHOOK_SECRET: ${stripeWebhookSecret ? 'SET' : 'NOT SET'}`);
  
  if (!stripeSecretKey) {
    console.error('❌ STRIPE DEBUG: STRIPE_SECRET_KEY is missing');
    return {
      status: 'error',
      message: 'STRIPE_SECRET_KEY is required',
      details: 'Missing Stripe secret key in environment variables'
    };
  }
  
  if (!stripePublishableKey) {
    console.warn('⚠️ STRIPE DEBUG: VITE_STRIPE_PUBLIC_KEY is missing');
  }
  
  if (!stripeWebhookSecret) {
    console.warn('⚠️ STRIPE DEBUG: STRIPE_WEBHOOK_SECRET is missing');
  }
  
  // Validate key format
  if (!stripeSecretKey.startsWith('sk_')) {
    console.error('❌ STRIPE DEBUG: Invalid Stripe secret key format');
    return {
      status: 'error',
      message: 'Invalid Stripe secret key format',
      details: 'Stripe secret key must start with "sk_"'
    };
  }
  
  if (stripePublishableKey && !stripePublishableKey.startsWith('pk_')) {
    console.error('❌ STRIPE DEBUG: Invalid Stripe publishable key format');
    return {
      status: 'error',
      message: 'Invalid Stripe publishable key format',
      details: 'Stripe publishable key must start with "pk_"'
    };
  }
  
  // Check if keys are for test vs live mode
  const isTestMode = stripeSecretKey.startsWith('sk_test_');
  const isLiveMode = stripeSecretKey.startsWith('sk_live_');
  
  console.log('🔍 STRIPE DEBUG: Key mode detection:');
  console.log(`   Test Mode: ${isTestMode}`);
  console.log(`   Live Mode: ${isLiveMode}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  
  if (process.env.NODE_ENV === 'production' && isTestMode) {
    console.warn('⚠️ STRIPE DEBUG: Using test keys in production environment');
  }
  
  if (process.env.NODE_ENV === 'development' && isLiveMode) {
    console.warn('⚠️ STRIPE DEBUG: Using live keys in development environment');
  }
  
  // Test Stripe API connectivity
  try {
    console.log('🔍 STRIPE DEBUG: Testing Stripe API connectivity...');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      timeout: 10000
    });
    
    // Test API connectivity with a simple request
    const account = await stripe.accounts.retrieve();
    
    console.log('✅ STRIPE DEBUG: Stripe API connectivity successful');
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Country: ${account.country}`);
    console.log(`   Charges Enabled: ${account.charges_enabled}`);
    console.log(`   Payouts Enabled: ${account.payouts_enabled}`);
    console.log(`   Details Submitted: ${account.details_submitted}`);
    
    return {
      status: 'success',
      message: 'Stripe configuration is valid',
      details: {
        accountId: account.id,
        country: account.country,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        isTestMode,
        isLiveMode
      }
    };
    
  } catch (error) {
    console.error('❌ STRIPE DEBUG: Stripe API connectivity failed:', error.message);
    
    if (error.type === 'StripeAuthenticationError') {
      return {
        status: 'error',
        message: 'Stripe authentication failed',
        details: 'Invalid or expired Stripe secret key'
      };
    }
    
    if (error.type === 'StripeConnectionError') {
      return {
        status: 'error',
        message: 'Stripe connection failed',
        details: 'Network connectivity issue with Stripe API'
      };
    }
    
    return {
      status: 'error',
      message: 'Stripe API test failed',
      details: error.message
    };
  }
}

/**
 * Check domain configuration for Stripe
 */
export function debugDomainConfiguration() {
  console.log('🔍 STRIPE DEBUG: Checking domain configuration...');
  
  const domain = process.env.DOMAIN || 'www.onedollaragent.ai';
  const frontendUrl = process.env.FRONTEND_URL;
  const corsOrigins = process.env.CORS_ORIGINS;
  
  console.log('🔍 STRIPE DEBUG: Domain configuration:');
  console.log(`   DOMAIN: ${domain}`);
  console.log(`   FRONTEND_URL: ${frontendUrl}`);
  console.log(`   CORS_ORIGINS: ${corsOrigins}`);
  
  // Check if domain is properly configured
  const expectedDomains = [
    'www.onedollaragent.ai',
    'onedollaragent.ai',
    'https://www.onedollaragent.ai',
    'https://onedollaragent.ai'
  ];
  
  const isDomainConfigured = expectedDomains.some(expectedDomain => 
    frontendUrl?.includes(expectedDomain) || 
    corsOrigins?.includes(expectedDomain)
  );
  
  if (!isDomainConfigured) {
    console.warn('⚠️ STRIPE DEBUG: Domain may not be properly configured');
    console.warn('   Expected domains: www.onedollaragent.ai, onedollaragent.ai');
    console.warn('   Make sure to add these domains to Stripe dashboard');
  }
  
  return {
    status: isDomainConfigured ? 'success' : 'warning',
    message: isDomainConfigured ? 'Domain configuration looks good' : 'Domain configuration needs attention',
    details: {
      domain,
      frontendUrl,
      corsOrigins,
      isDomainConfigured
    }
  };
}

/**
 * Check webhook configuration
 */
export function debugWebhookConfiguration() {
  console.log('🔍 STRIPE DEBUG: Checking webhook configuration...');
  
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const domain = process.env.DOMAIN || 'www.onedollaragent.ai';
  const expectedWebhookUrl = `https://${domain}/api/stripe/webhook`;
  
  console.log('🔍 STRIPE DEBUG: Webhook configuration:');
  console.log(`   Webhook Secret: ${webhookSecret ? 'SET' : 'NOT SET'}`);
  console.log(`   Expected Webhook URL: ${expectedWebhookUrl}`);
  
  if (!webhookSecret) {
    console.warn('⚠️ STRIPE DEBUG: STRIPE_WEBHOOK_SECRET is missing');
    console.warn('   Configure webhook in Stripe dashboard:');
    console.warn(`   URL: ${expectedWebhookUrl}`);
    console.warn('   Events: payment_intent.succeeded, checkout.session.completed');
  }
  
  return {
    status: webhookSecret ? 'success' : 'warning',
    message: webhookSecret ? 'Webhook configuration looks good' : 'Webhook configuration needs attention',
    details: {
      webhookSecret: webhookSecret ? 'SET' : 'NOT SET',
      expectedWebhookUrl,
      needsConfiguration: !webhookSecret
    }
  };
}

/**
 * Comprehensive Stripe debugging
 */
export async function debugStripeComprehensive() {
  console.log('🔍 STRIPE DEBUG: Starting comprehensive Stripe debugging...');
  
  const results = {
    configuration: await debugStripeConfiguration(),
    domain: debugDomainConfiguration(),
    webhook: debugWebhookConfiguration()
  };
  
  console.log('🔍 STRIPE DEBUG: Comprehensive debugging results:');
  console.log(JSON.stringify(results, null, 2));
  
  return results;
}
