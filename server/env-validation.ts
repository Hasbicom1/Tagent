import { logger } from './logger';

interface RequiredEnvVars {
  development: string[];
  production: string[];
}

const REQUIRED_ENV_VARS: RequiredEnvVars = {
  development: [
    'DATABASE_URL',
    'REDIS_URL'
  ],
  production: [
    'DATABASE_URL',
    'SESSION_SECRET',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_STRIPE_PUBLIC_KEY',
    'OPENAI_API_KEY',
    'REDIS_URL'
  ]
};

export function validateEnvironment(): void {
  const env = process.env.NODE_ENV || 'development';
  const required = REQUIRED_ENV_VARS[env as keyof RequiredEnvVars] || [];
  
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logger.error({
      missing,
      environment: env
    }, 'Missing required environment variables');
    
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => {
      console.error(`  - ${envVar}`);
    });
    
    console.error('\n🚑 PRODUCTION REQUIREMENT: This application requires Redis for:');
    console.error('   • Session management (no memory fallback)');
    console.error('   • Rate limiting coordination');
    console.error('   • Webhook idempotency protection');
    console.error('   • Queue system operations');
    console.error('   • WebSocket coordination');
    console.error('\n❌ DEPLOYMENT BLOCKED: Application cannot start without required variables');
    process.exit(1);
  }
  
  // Validate secret lengths in production
  if (env === 'production') {
    const secrets = ['SESSION_SECRET', 'JWT_SECRET'];
    secrets.forEach(secret => {
      const value = process.env[secret];
      if (value && value.length < 32) {
        logger.error({ secret }, 'Secret too short for production use');
        console.error(`❌ ${secret} must be at least 32 characters long for production`);
        process.exit(1);
      }
    });

    // PRODUCTION STRIPE KEY VALIDATION: Ensure live keys are used in production
    validateStripeKeysForProduction();
  }
  
  logger.info({ environment: env }, 'Environment validation passed');
}

/**
 * PRODUCTION STRIPE VALIDATION: Ensure live Stripe keys are used in production
 * This prevents accidental use of test keys in production environment
 */
function validateStripeKeysForProduction(): void {
  console.log('🔐 Validating Stripe keys for production deployment...');
  
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Validate Stripe Secret Key (must be live key in production)
  if (stripeSecretKey) {
    if (!stripeSecretKey.startsWith('sk_live_')) {
      console.error('❌ PRODUCTION ERROR: STRIPE_SECRET_KEY must be a live key (starts with sk_live_) in production');
      console.error('   Current key starts with:', stripeSecretKey.substring(0, 8) + '***');
      console.error('   Expected: sk_live_***');
      console.error('');
      console.error('🔧 FIX: Update STRIPE_SECRET_KEY in Railway environment variables');
      console.error('   1. Go to Railway Dashboard > Variables');
      console.error('   2. Update STRIPE_SECRET_KEY with your live secret key from Stripe Dashboard');
      console.error('   3. Live keys are available at: https://dashboard.stripe.com/apikeys');
      process.exit(1);
    }
    console.log('✅ STRIPE: Live secret key configured for production');
  }

  // Validate Stripe Public Key (must be live key in production)
  if (stripePublicKey) {
    if (!stripePublicKey.startsWith('pk_live_')) {
      console.error('❌ PRODUCTION ERROR: VITE_STRIPE_PUBLIC_KEY must be a live key (starts with pk_live_) in production');
      console.error('   Current key starts with:', stripePublicKey.substring(0, 8) + '***');
      console.error('   Expected: pk_live_***');
      console.error('');
      console.error('🔧 FIX: Update VITE_STRIPE_PUBLIC_KEY in Railway environment variables');
      console.error('   1. Go to Railway Dashboard > Variables');
      console.error('   2. Update VITE_STRIPE_PUBLIC_KEY with your live publishable key from Stripe Dashboard');
      console.error('   3. Live keys are available at: https://dashboard.stripe.com/apikeys');
      process.exit(1);
    }
    console.log('✅ STRIPE: Live publishable key configured for production');
  }

  // Validate Webhook Secret (must be webhook endpoint secret)
  if (webhookSecret) {
    if (!webhookSecret.startsWith('whsec_')) {
      console.error('❌ PRODUCTION WARNING: STRIPE_WEBHOOK_SECRET should start with whsec_ for production webhooks');
      console.error('   Current value starts with:', webhookSecret.substring(0, 8) + '***');
      console.error('   Expected: whsec_***');
      console.error('');
      console.error('🔧 FIX: Update STRIPE_WEBHOOK_SECRET in Railway environment variables');
      console.error('   1. Go to Stripe Dashboard > Webhooks');
      console.error('   2. Configure production webhook endpoint: https://www.onedollaragent.ai/api/stripe/webhook');
      console.error('   3. Copy the webhook secret (starts with whsec_) to Railway environment variables');
    } else {
      console.log('✅ STRIPE: Production webhook secret configured');
    }
  }

  // Log production webhook endpoint information
  console.log('🔗 STRIPE: Production webhook endpoint should be configured as:');
  console.log('   URL: https://www.onedollaragent.ai/api/stripe/webhook');
  console.log('   Events: payment_intent.succeeded, checkout.session.completed');
  console.log('   Configure at: https://dashboard.stripe.com/webhooks');
  console.log('');
}