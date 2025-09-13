import { logger } from './logger';

interface RequiredEnvVars {
  development: string[];
  production: string[];
}

const REQUIRED_ENV_VARS: RequiredEnvVars = {
  development: [
    'DATABASE_URL',
  ],
  production: [
    'DATABASE_URL',
    'REDIS_URL',
    'SESSION_SECRET',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_STRIPE_PUBLIC_KEY',
    'OPENAI_API_KEY'
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
    
    if (env === 'production') {
      console.error('\n💡 For Railway deployment, set these variables in your Railway dashboard:');
      console.error('   Project → Variables → Add Variables');
      process.exit(1);
    } else {
      console.warn('\n⚠️  Some features may not work without these variables');
    }
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