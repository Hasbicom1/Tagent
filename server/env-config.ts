/**
 * Environment Configuration Module
 * CRITICAL: This must be imported FIRST before any other modules
 * to ensure consistent NODE_ENV across all application components
 */

// AUTO-DETECT PRODUCTION ENVIRONMENT for public deployments
function detectProductionEnvironment(): string {
  // PRIORITY 1: If NODE_ENV is explicitly set to development, honor it (for debugging)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 OVERRIDE: Development mode explicitly requested via NODE_ENV');
    console.log(`   REPL_ID: ${process.env.REPL_ID ? 'YES' : 'NO'}`);
    console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || 'NOT_SET'}`);
    return 'development';
  }

  // Force auto-detection for Replit deployments
  const isReplitDeployment = !!(process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID);
  const frontendUrl = process.env.FRONTEND_URL || '';
  
  // Check for production domains
  const productionDomains = [
    'onedollaragent.ai',
    'www.onedollaragent.ai', // Primary custom domain
    'onedollara.replit.app',
    'replit.app', // Any .replit.app domain should be production
    'railway.app', // Railway domains
    'up.railway.app' // Railway deployment URLs
  ];
  
  const isProductionDomain = productionDomains.some(domain => 
    frontendUrl.includes(domain)
  );

  // Check for Railway environment variables
  const isRailwayDeployment = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PUBLIC_DOMAIN);
  
  // PRODUCTION READY: Removed FORCE_DEVELOPMENT_MODE override for Railway deployment

  // Auto-detect production for Railway deployments
  if (isRailwayDeployment) {
    console.log('🚀 AUTO-DETECTED: Production environment for Railway deployment');
    console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'NOT_SET'}`);
    console.log(`   RAILWAY_PUBLIC_DOMAIN: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'NOT_SET'}`);
    console.log(`   FRONTEND_URL: ${frontendUrl || 'NOT_SET'}`);
    return 'production';
  }

  // Auto-detect production ONLY for actual Replit deployments (not development)
  if (process.env.REPLIT_DEPLOYMENT_ID) {
    console.log('🚀 AUTO-DETECTED: Production environment for Replit deployment');
    console.log(`   REPLIT_DEPLOYMENT_ID: ${process.env.REPLIT_DEPLOYMENT_ID ? 'YES' : 'NO'}`);
    console.log(`   REPL_ID: ${process.env.REPL_ID ? 'YES' : 'NO'}`);
    console.log(`   FRONTEND_URL: ${frontendUrl || 'NOT_SET'}`);
    return 'production';
  }

  // Check for production domain in FRONTEND_URL (only when not in explicit development)
  if (isProductionDomain && process.env.NODE_ENV !== 'development') {
    console.log('🚀 AUTO-DETECTED: Production environment for production domain');
    console.log(`   FRONTEND_URL: ${frontendUrl}`);
    return 'production';
  }

  // If NODE_ENV is explicitly set, use it
  if (process.env.NODE_ENV) {
    console.log(`🎯 Environment explicitly set: ${process.env.NODE_ENV}`);
    return process.env.NODE_ENV;
  }

  console.log('🔧 AUTO-DETECTED: Development environment');
  return 'development';
}

// CRITICAL: Set environment before any other initialization
const detectedEnv = detectProductionEnvironment();
process.env.NODE_ENV = detectedEnv;

// Export environment information
export const ENV_CONFIG = {
  NODE_ENV: detectedEnv,
  IS_PRODUCTION: detectedEnv === 'production',
  IS_DEVELOPMENT: detectedEnv === 'development',
  IS_REPLIT: !!(process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID),
  FRONTEND_URL: process.env.FRONTEND_URL,
  
  // Validate and normalize FRONTEND_URL
  getValidatedFrontendUrl(): string | null {
    let url = process.env.FRONTEND_URL;
    if (!url) return null;
    
    // Add HTTPS scheme if missing in production
    if (detectedEnv === 'production' && !url.startsWith('http')) {
      url = `https://${url}`;
    }
    
    // Remove trailing slash for consistency
    url = url.replace(/\/$/, '');
    
    // Validate HTTPS in production
    if (detectedEnv === 'production' && !url.startsWith('https://')) {
      console.warn('⚠️  SECURITY: FRONTEND_URL should use HTTPS in production');
      // Auto-fix common mistakes
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
        console.log(`🔒 SECURITY: Auto-corrected FRONTEND_URL to HTTPS: ${url}`);
      }
    }
    
    return url;
  },
  
  // Security-safe configuration logging
  getValidatedAllowedOrigins(): string[] {
    // In development mode, include development origins with Replit domains
    if (detectedEnv === 'development') {
      const devOrigins = [
        'http://localhost:5000', 
        'http://127.0.0.1:5000', 
        'https://localhost:5000', 
        'http://localhost:3000', 
        'https://localhost:3000',
        'https://onedollaragent.ai',
        'https://www.onedollaragent.ai'
      ];
      
      // Include Replit domains for development (both normal and www variants)
      if (ENV_CONFIG.IS_REPLIT && process.env.REPL_ID) {
        const baseReplitDomain = `https://${process.env.REPL_ID}-00-37l83xb173uim.kirk.replit.dev`;
        const wwwReplitDomain = `https://www.${process.env.REPL_ID}-00-37l83xb173uim.kirk.replit.dev`;
        devOrigins.push(baseReplitDomain, wwwReplitDomain);
      }
      
      // Include any additional environment origins
      if (process.env.ALLOWED_ORIGINS) {
        const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
        devOrigins.push(...envOrigins);
      }
      
      return devOrigins;
    }
    
    // Production mode: Extract base domain from FRONTEND_URL
    const frontendUrl = this.getValidatedFrontendUrl();
    if (!frontendUrl) {
      return [];
    }
    
    try {
      const url = new URL(frontendUrl);
      const hostname = url.hostname;
      
      // For www subdomain, return both apex and www
      if (hostname.startsWith('www.')) {
        const apexDomain = hostname.substring(4);
        return [
          `https://${apexDomain}`,
          `https://${hostname}`
        ];
      }
      
      // For apex domain, return both apex and www
      return [
        `https://${hostname}`,
        `https://www.${hostname}`
      ];
    } catch (error) {
      console.warn('⚠️  SECURITY: Failed to parse FRONTEND_URL for CORS origins:', error);
      return [];
    }
  },

  logConfiguration(): void {
    const isProduction = detectedEnv === 'production';
    
    console.log('🔧 Environment Configuration:');
    console.log(`   NODE_ENV: ${detectedEnv}`);
    console.log(`   IS_REPLIT: ${ENV_CONFIG.IS_REPLIT ? 'YES' : 'NO'}`);
    
    // SECURITY FIX: Never log sensitive values, only their presence
    const secrets = [
      'DATABASE_URL',
      'SESSION_SECRET', 
      'JWT_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'OPENAI_API_KEY',
      'REDIS_URL'
    ];
    
    secrets.forEach(secret => {
      const exists = !!process.env[secret];
      const value = process.env[secret];
      
      if (isProduction) {
        // PRODUCTION: Only show presence, never any value
        console.log(`   ${secret}: ${exists ? 'CONFIGURED' : 'NOT_SET'}`);
      } else {
        // DEVELOPMENT: Show partial value for debugging
        if (exists && value) {
          const masked = value.length > 10 
            ? `${value.substring(0, 8)}***` 
            : '***';
          console.log(`   ${secret}: ${masked} (length: ${value.length})`);
        } else {
          console.log(`   ${secret}: NOT_SET`);
        }
      }
    });
    
    // Log validated frontend URL
    const validatedUrl = ENV_CONFIG.getValidatedFrontendUrl();
    console.log(`   VALIDATED_FRONTEND_URL: ${validatedUrl || 'NOT_CONFIGURED'}`);
  }
};

// Initialize configuration logging
ENV_CONFIG.logConfiguration();

export default ENV_CONFIG;