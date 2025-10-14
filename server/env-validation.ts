import { logger } from './logger';

interface RequiredEnvVars {
  development: string[];
  production: string[];
}

// PRODUCTION LOCKDOWN: Comprehensive environment variable requirements
const REQUIRED_ENV_VARS: RequiredEnvVars = {
  development: [
    'DATABASE_URL'
    // REDIS_URL removed - will be detected flexibly
  ],
  production: [
    // Database and Storage (CRITICAL - NO FALLBACKS)
    'DATABASE_URL',
    // REDIS_URL removed - will be detected flexibly
    
    // Security Secrets (CRITICAL - NO DEFAULTS)
    'SESSION_SECRET',
    'JWT_SECRET',
    
    // Stripe Payment Security (LIVE KEYS ONLY)
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_STRIPE_PUBLIC_KEY',
    
    // AI Operations
    'OPENAI_API_KEY',
    
    // Production Domain Configuration
    'FRONTEND_URL',
    'PORT'
  ]
};

// PRODUCTION SECURITY: Environment variable security requirements
interface SecurityRequirement {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  required: boolean;
  description: string;
  productionOnly?: boolean;
}

const ENV_SECURITY_REQUIREMENTS: Record<string, SecurityRequirement> = {
  'DATABASE_URL': {
    pattern: /^postgres(ql)?:\/\/.+/,
    required: true,
    description: 'PostgreSQL connection string (postgres://...)'
  },
  'REDIS_URL': {
    pattern: /^rediss?:\/\/.+/,
    required: true,
    description: 'Redis connection string (redis://... or rediss://...)'
  },
  'SESSION_SECRET': {
    minLength: 32,
    maxLength: 512,
    required: true,
    description: 'Cryptographically secure session secret (min 32 chars)',
    productionOnly: true
  },
  'JWT_SECRET': {
    minLength: 32,
    maxLength: 512,
    required: true,
    description: 'Cryptographically secure JWT secret (min 32 chars)',
    productionOnly: true
  },
  'STRIPE_SECRET_KEY': {
    pattern: /^sk_(test_|live_)[a-zA-Z0-9]{98,}$/,
    required: true,
    description: 'Stripe secret key (sk_test_... or sk_live_...)'
  },
  'STRIPE_WEBHOOK_SECRET': {
    pattern: /^whsec_[a-zA-Z0-9]{32,}$/,
    required: true,
    description: 'Stripe webhook secret (whsec_...)'
  },
  'VITE_STRIPE_PUBLIC_KEY': {
    pattern: /^pk_(test_|live_)[a-zA-Z0-9]{98,}$/,
    required: true,
    description: 'Stripe publishable key (pk_test_... or pk_live_...)'
  },
  'OPENAI_API_KEY': {
    pattern: /^sk-[a-zA-Z0-9\-_]{20,}$/,
    required: true,
    description: 'OpenAI API key (sk-...)'
  },
  'FRONTEND_URL': {
    pattern: /^https:\/\/.+/,
    required: true,
    description: 'Production frontend URL (https://... only)',
    productionOnly: true
  },
  'PORT': {
    pattern: /^[0-9]{1,5}$/,
    required: true,
    description: 'Application port number'
  }
};

export function validateEnvironment(): void {
  const env = process.env.NODE_ENV || 'development';
  const required = REQUIRED_ENV_VARS[env as keyof RequiredEnvVars] || [];
  
  console.log('🔒 SECURITY: Starting comprehensive environment validation...');
  console.log(`   Environment: ${env}`);
  console.log(`   Required variables: ${required.length}`);
  
  // RAILWAY FIX: Flexible Redis URL validation
  validateRedisUrlFlexibly();
  
  // Check for missing variables
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logger.error({
      missing,
      environment: env
    }, 'Missing required environment variables');
    
    console.error('❌ DEPLOYMENT BLOCKED: Missing required environment variables:');
    missing.forEach(envVar => {
      const requirement = ENV_SECURITY_REQUIREMENTS[envVar];
      console.error(`  - ${envVar}: ${requirement?.description || 'Required environment variable'}`);
    });
    
    console.error('\n❌ PRODUCTION SECURITY: Application cannot start without all required variables');
    process.exit(1);
  }
  
  // Validate environment variable security requirements
  const validationErrors: string[] = [];
  
  for (const [envVar, value] of Object.entries(process.env)) {
    const requirement = ENV_SECURITY_REQUIREMENTS[envVar];
    if (!requirement || !value) continue;
    
    // Skip production-only requirements in development
    if (requirement.productionOnly && env !== 'production') {
      continue;
    }
    
    // Validate pattern
    if (requirement.pattern && !requirement.pattern.test(value)) {
      validationErrors.push(`${envVar}: ${requirement.description}`);
    }
    
    // Validate length
    if (requirement.minLength && value.length < requirement.minLength) {
      validationErrors.push(`${envVar}: Must be at least ${requirement.minLength} characters long`);
    }
    
    if (requirement.maxLength && value.length > requirement.maxLength) {
      validationErrors.push(`${envVar}: Must be no more than ${requirement.maxLength} characters long`);
    }
  }
  
  if (validationErrors.length > 0) {
    logger.error({ validationErrors }, 'Environment variable security validation failed');
    
    console.error('❌ SECURITY VALIDATION FAILED:');
    validationErrors.forEach(error => {
      console.error(`  - ${error}`);
    });
    console.error('\n🔒 SECURITY: All environment variables must meet security requirements');
    process.exit(1);
  }
  
  // Production-specific validations
  if (env === 'production') {
    validateProductionSecurity();
  }
  
  console.log('✅ SECURITY: Environment validation passed');
  logger.info({ 
    environment: env, 
    variablesValidated: required.length,
    securityChecks: Object.keys(ENV_SECURITY_REQUIREMENTS).length
  }, 'Environment validation completed successfully');
}

/**
 * PRODUCTION SECURITY: Comprehensive production environment validation
 */
function validateProductionSecurity(): void {
  console.log('🔒 PRODUCTION: Validating production security requirements...');
  
  // Validate Stripe keys for production
  validateStripeKeysForProduction();
  
  // Validate HTTPS enforcement
  validateHTTPSEnforcement();
  
  // Validate Redis connection requirements
  validateRedisRequirements();
  
  // Validate security secrets
  validateSecuritySecrets();
  
  console.log('✅ PRODUCTION: All security requirements validated');
}

/**
 * PRODUCTION SECURITY: Validate HTTPS enforcement
 */
function validateHTTPSEnforcement(): void {
  const frontendUrl = process.env.FRONTEND_URL;
  
  if (frontendUrl && !frontendUrl.startsWith('https://')) {
    console.error('❌ SECURITY: FRONTEND_URL must use HTTPS in production');
    console.error(`   Current: ${frontendUrl}`);
    console.error(`   Required: https://...`);
    process.exit(1);
  }
  
  // Validate domain configuration
  if (frontendUrl && !frontendUrl.includes('onedollaragent.ai')) {
    console.error('❌ SECURITY: FRONTEND_URL must use production domain');
    console.error(`   Current: ${frontendUrl}`);
    console.error(`   Expected: https://www.onedollaragent.ai`);
    process.exit(1);
  }
  
  console.log('✅ HTTPS: Production HTTPS enforcement validated');
}

/**
 * RAILWAY 2025: Modern Redis URL validation
 * Checks for multiple possible Redis URL environment variables with 2025 patterns
 */
function validateRedisUrlFlexibly(): void {
  console.log('🔍 RAILWAY 2025: Scanning for Redis URL with modern patterns...');
  
  // RAILWAY 2025: Priority order for Redis URL detection
  const redisUrlCandidates = [
    'REDIS_PRIVATE_URL',    // Railway Redis Service (Private) - HIGHEST PRIORITY
    'REDIS_URL',           // Standard Redis URL
    'REDIS_PUBLIC_URL',    // Railway Redis Service (Public)
    'REDIS_EXTERNAL_URL',  // Railway Redis Service (External)
    'REDIS_CONNECTION_STRING', // Alternative Redis URL
    'CACHE_URL',           // Cache URL (Redis)
    'DATABASE_URL',        // Database URL (if Redis)
    'REDIS_SERVICE_URL',   // Railway Service Discovery
    'REDIS_INTERNAL_URL'   // Railway Internal Service
  ];
  
  let foundRedisUrl = false;
  let redisSource = '';
  
  for (const candidate of redisUrlCandidates) {
    const url = process.env[candidate];
    if (url) {
      console.log(`✅ RAILWAY 2025: Found ${candidate}: ${url.substring(0, 30)}...`);
      
      // Validate Redis URL format with 2025 patterns
      if (isValidRailwayRedisUrl2025(url)) {
        foundRedisUrl = true;
        redisSource = candidate;
        console.log(`✅ RAILWAY 2025: Valid Redis URL found in ${candidate}`);
        break;
      } else {
        console.warn(`⚠️  RAILWAY 2025: Invalid Redis URL format in ${candidate}: ${url.substring(0, 30)}...`);
      }
    }
  }
  
  if (!foundRedisUrl) {
    console.error('❌ RAILWAY 2025: No valid Redis URL found in environment variables');
    console.error('   Checked variables:', redisUrlCandidates.join(', '));
    
    // Check if Redis is being skipped for testing
    if (process.env.SKIP_REDIS === 'true') {
      console.warn('⚠️  SKIP_REDIS=true detected - bypassing Redis requirement for testing');
      return;
    }
    
    console.error('\n🚨 RAILWAY 2025 REDIS REQUIREMENT: This application requires Redis for:');
    console.error('   • Session management (NO memory fallback in production)');
    console.error('   • Rate limiting coordination');
    console.error('   • Webhook idempotency protection');
    console.error('   • Queue system operations');
    console.error('   • WebSocket coordination');
    console.error('\n🔧 RAILWAY 2025 FIX: Ensure Redis service is attached to your project');
    console.error('   1. Go to Railway Dashboard > Project > Services');
    console.error('   2. Click "+ New" > Database > Redis');
    console.error('   3. Wait for deployment and verify REDIS_PRIVATE_URL appears in Variables');
    console.error('   4. Redeploy the application');
    process.exit(1);
  }
  
  console.log(`✅ RAILWAY 2025: Redis URL validated from ${redisSource}`);
}

/**
 * RAILWAY 2025: Validate Redis URL format with modern patterns
 */
function isValidRailwayRedisUrl2025(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Railway 2025 Redis URL patterns
  const railwayRedisPatterns = [
    // Standard Redis patterns
    /^redis:\/\/.+/,
    /^rediss:\/\/.+/,
    
    // Railway internal patterns
    /^redis:\/\/default:.+@redis\.railway\.internal:\d+/,
    /^rediss:\/\/default:.+@redis\.railway\.internal:\d+/,
    
    // Railway external patterns
    /^redis:\/\/default:.+@containers-.+\.railway\.app:\d+/,
    /^rediss:\/\/default:.+@containers-.+\.railway\.app:\d+/,
    
    // Railway 2025 service discovery patterns
    /^redis:\/\/default:.+@redis-service-\d+\.railway\.internal:\d+/,
    /^rediss:\/\/default:.+@redis-service-\d+\.railway\.internal:\d+/,
    
    // Railway 2025 regional patterns
    /^redis:\/\/default:.+@redis-\w+-\d+\.railway\.app:\d+/,
    /^rediss:\/\/default:.+@redis-\w+-\d+\.railway\.app:\d+/,
    
    // Railway 2025 internal networking
    /^redis:\/\/default:.+@redis\.railway\.internal:\d+/,
    /^rediss:\/\/default:.+@redis\.railway\.internal:\d+/
  ];
  
  return railwayRedisPatterns.some(pattern => pattern.test(url));
}

/**
 * Legacy Redis URL validation (for backward compatibility)
 */
function isValidRedisUrl(url: string): boolean {
  return isValidRailwayRedisUrl2025(url);
}

/**
 * PRODUCTION SECURITY: Validate Redis requirements
 */
function validateRedisRequirements(): void {
  // This function is now handled by validateRedisUrlFlexibly()
  console.log('✅ REDIS: Redis requirements validated via flexible detection');
}

/**
 * PRODUCTION SECURITY: Validate security secrets
 */
function validateSecuritySecrets(): void {
  const secrets = ['SESSION_SECRET', 'JWT_SECRET'];
  
  secrets.forEach(secret => {
    const value = process.env[secret];
    if (!value) {
      console.error(`❌ SECURITY: ${secret} is required for production`);
      process.exit(1);
    }
    
    if (value.length < 32) {
      console.error(`❌ SECURITY: ${secret} must be at least 32 characters long for production`);
      console.error(`   Current length: ${value.length}`);
      console.error(`   Required: 32+ characters`);
      process.exit(1);
    }
    
    // Check for weak patterns
    if (/^(test|dev|demo|example|password|secret|key|default)/i.test(value)) {
      console.error(`❌ SECURITY: ${secret} appears to use a weak or test value`);
      console.error(`   Use a cryptographically secure random string`);
      process.exit(1);
    }
  });
  
  console.log('✅ SECURITY: Production secrets validated');
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