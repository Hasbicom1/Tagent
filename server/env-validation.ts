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
  }
  
  logger.info({ environment: env }, 'Environment validation passed');
}