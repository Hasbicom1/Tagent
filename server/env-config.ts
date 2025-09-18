/**
 * Environment Configuration Module
 * CRITICAL: This must be imported FIRST before any other modules
 * to ensure consistent NODE_ENV across all application components
 */

// AUTO-DETECT PRODUCTION ENVIRONMENT for public deployments
function detectProductionEnvironment(): string {
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

  // Auto-detect production for Replit deployments
  if (isReplitDeployment) {
    console.log('🚀 AUTO-DETECTED: Production environment for Replit deployment');
    console.log(`   REPLIT_DEPLOYMENT_ID: ${process.env.REPLIT_DEPLOYMENT_ID ? 'YES' : 'NO'}`);
    console.log(`   REPL_ID: ${process.env.REPL_ID ? 'YES' : 'NO'}`);
    console.log(`   FRONTEND_URL: ${frontendUrl || 'NOT_SET'}`);
    return 'production';
  }

  // Check for production domain in FRONTEND_URL
  if (isProductionDomain) {
    console.log('🚀 AUTO-DETECTED: Production environment for production domain');
    console.log(`   FRONTEND_URL: ${frontendUrl}`);
    return 'production';
  }

  // If NODE_ENV is explicitly set and not auto-detected as production, use it
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
    const frontendUrl = this.getValidatedFrontendUrl();
    const origins: string[] = [];
    
    if (frontendUrl) {
      // Extract base domain from FRONTEND_URL
      try {
        const url = new URL(frontendUrl);
        const hostname = url.hostname;
        
        // For www subdomain, return both apex and www
        if (hostname.startsWith('www.')) {
          const apexDomain = hostname.substring(4);
          origins.push(
            `https://${apexDomain}`,
            `https://${hostname}`
          );
        } else {
          // For apex domain, return both apex and www
          origins.push(
            `https://${hostname}`,
            `https://www.${hostname}`
          );
        }
      } catch (error) {
        console.warn('⚠️  SECURITY: Failed to parse FRONTEND_URL for CORS origins:', error);
      }
    }
    
    // REPLIT PREVIEW: Add current Replit domain when in Replit environment
    if (process.env.REPL_ID) {
      const replitHost = process.env.REPLIT_URL || process.env.REPL_URL;
      if (replitHost) {
        origins.push(replitHost);
        console.log('🔧 REPLIT: Added current Replit domain to CORS origins:', replitHost);
      }
      
      // Add generic Replit domain patterns for broader compatibility
      // Note: Actual pattern validation happens in validateWebSocketOrigin function
      console.log('🔧 REPLIT: Replit domain pattern validation enabled');
    }
    
    return origins.length > 0 ? origins : [];
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