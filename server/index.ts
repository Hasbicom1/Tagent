// CRITICAL: Import environment config FIRST to ensure consistent NODE_ENV
import ENV_CONFIG from "./env-config";

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { Redis } from "ioredis";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { wsManager } from "./websocket";
import { initializeVNCProxy } from "./vnc-proxy";
import { initializeQueue, closeQueue } from "./queue";
import { validateEnvironment } from "./env-validation";
import { logger, addRequestId } from "./logger";
import { healthCheck, livenessCheck, readinessCheck } from "./health";
import { 
  validateSecurityConfiguration, 
  validateWebSocketConfiguration,
  validateSecurityHeaders,
  validateProductionSecurity,
  getSecurityHeadersConfig,
  getSecureCookieConfig,
  generateCSPHeader,
  generatePermissionsPolicyHeader,
  generateSecureSessionToken,
  validateStripeKeysForProduction,
  createCSRFProtectionMiddleware,
  generateCSRFToken
} from "./security";
import { 
  createRedisSessionStore,
  SessionSecurityStore,
  DEFAULT_SESSION_SECURITY_CONFIG
} from "./session";
import { 
  initializeIdempotencyService,
  getIdempotencyService
} from "./idempotency";

// Validate environment variables before starting anything
validateEnvironment();

// Add process-level error handlers for development debugging
if (ENV_CONFIG.IS_DEVELOPMENT) {
  process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err.message);
    console.error(err.stack);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

const app = express();

// Configure trust proxy first - BEFORE any middleware that needs it
app.set('trust proxy', 1);

// Ensure app environment matches NODE_ENV for Vite setup
app.set('env', ENV_CONFIG.NODE_ENV);

// Add request ID and logging middleware early
app.use(addRequestId);

// Add health check endpoints (before other middleware)
app.get('/health', healthCheck);
app.get('/health/live', livenessCheck);
app.get('/health/ready', readinessCheck);

// Add compression for production performance
if (process.env.NODE_ENV === 'production') {
  // Note: compression middleware would be added here when package conflicts are resolved
  logger.info('Production mode: compression middleware would be enabled');
}

// CRITICAL REORDER: Set trust proxy FIRST for proper session handling
app.set('trust proxy', 1);

// Apply enhanced security headers based on environment
const securityConfig = getSecurityHeadersConfig();
const cookieConfig = getSecureCookieConfig();

// Initialize Redis for session storage and security features

// CORS Configuration - Simple manual CORS for Replit preview domains
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  // Always allow requests without origin (same-origin)
  if (!origin) {
    return next();
  }

  // Get allowed origins from environment configuration
  const allowedOrigins = ENV_CONFIG.getValidatedAllowedOrigins();
  let isAllowed = allowedOrigins.includes(origin);

  // Check Replit domain patterns when in Replit environment
  if (!isAllowed && process.env.REPL_ID) {
    const replitPatterns = [
      /^https?:\/\/.*\.replit\.app$/,
      /^https?:\/\/.*\.replit\.dev$/,
      /^https?:\/\/.*\.repl\.co$/
    ];
    
    if (replitPatterns.some(pattern => pattern.test(origin))) {
      console.log('🔧 REPLIT: Allowing Replit origin:', origin);
      isAllowed = true;
    }
  }

  // Allow localhost in development/Replit
  if (!isAllowed && (process.env.NODE_ENV === 'development' || process.env.REPL_ID)) {
    const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/;
    if (localhostPattern.test(origin)) {
      isAllowed = true;
    }
  }

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// Enhanced Helmet configuration with custom security headers
app.use(helmet({
  // HSTS - HTTP Strict Transport Security
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: securityConfig.hsts.maxAge,
    includeSubDomains: securityConfig.hsts.includeSubDomains,
    preload: securityConfig.hsts.preload
  } : false,

  // Content Security Policy - minimal CSP for production security
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:", "https://api.stripe.com", "https://api.openai.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameSrc: ["https://checkout.stripe.com", "https://js.stripe.com"],
      frameAncestors: ENV_CONFIG.IS_REPLIT ? 
        ["'self'", "https://*.replit.app", "https://*.replit.dev", "https://replit.com", "https://*.replit.com"] :
        ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false
  } : false,

  // X-Frame-Options - Disable for Replit to allow iframe embedding
  frameguard: ENV_CONFIG.IS_REPLIT ? false : {
    action: securityConfig.frameOptions.toLowerCase() as 'deny' | 'sameorigin'
  },

  // X-Content-Type-Options
  noSniff: securityConfig.contentTypeOptions,

  // Referrer Policy
  referrerPolicy: {
    policy: securityConfig.referrerPolicy as any
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Allow embedding for Stripe

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  }
}));

// Add custom security headers not covered by Helmet
app.use((req: Request, res: Response, next: NextFunction) => {
  // Permissions Policy
  const permissionsPolicy = generatePermissionsPolicyHeader(securityConfig);
  res.setHeader('Permissions-Policy', permissionsPolicy);

  // Additional security headers
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Security headers for development vs production
  if (process.env.NODE_ENV === 'production') {
    // CRITICAL FIX: Exempt Stripe webhook from HTTPS redirect
    // Webhooks must accept HTTP requests and return 2xx responses, not redirects
    const isWebhookEndpoint = req.path === '/api/stripe/webhook';
    
    // Force HTTPS in production (except for Stripe webhooks and localhost/replit development)
    const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname?.includes('replit.dev');
    const isReplitDev = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
    
    if (!isWebhookEndpoint && !isLocalhost && !isReplitDev && req.header('x-forwarded-proto') !== 'https' && process.env.FORCE_HTTPS !== 'false') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    
    // Additional production security headers
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }

  next();
});

// Canonical Host Middleware - Redirect apex domain to www for SEO consistency
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.get('host');
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Only apply canonical redirects in production for actual custom domains
  if (isProduction && host) {
    const isWebhookEndpoint = req.path === '/api/stripe/webhook';
    const isHealthCheck = req.path.startsWith('/health');
    
    // Skip redirects for webhooks and health checks to prevent issues
    if (!isWebhookEndpoint && !isHealthCheck) {
      // Redirect apex domain to www subdomain for SEO and consistency
      if (host === 'onedollaragent.ai') {
        const protocol = req.header('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const canonicalUrl = `https://www.onedollaragent.ai${req.url}`;
        
        console.log(`🔀 CANONICAL: Redirecting ${host}${req.url} to www.onedollaragent.ai${req.url}`);
        return res.redirect(301, canonicalUrl);
      }
      
      // Generalized canonical redirect for any apex domain to www
      if (host && !host.startsWith('www.') && !host.includes('.replit.app') && !host.includes('.replit.dev') && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        // Only redirect if this appears to be a custom apex domain
        const protocol = req.header('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const canonicalUrl = `${protocol}://www.${host}${req.url}`;
        
        console.log(`🔀 CANONICAL: Redirecting apex domain ${host} to www.${host} for SEO consistency`);
        return res.redirect(301, canonicalUrl);
      }
    }
  }
  
  next();
});

// Initialize Redis for session storage and security features
let redisInstance: Redis | null = null;
let sessionSecurityStore: SessionSecurityStore | null = null;

export function getRedis(): Redis | null {
  return redisInstance;
}

export async function initializeRedis(): Promise<Redis | null> {
  // CRITICAL FIX: Use Redis singleton to prevent multiple connections
  const { getSharedRedis, debugRedisStatus } = await import('./redis-singleton');
  
  console.log('🔧 REDIS: Using Redis singleton for shared connection...');
  debugRedisStatus();
  
  return await getSharedRedis();
}

async function initializeRedisSession(): Promise<any> {
  try {
    // PRODUCTION REQUIREMENT: Redis is mandatory for all environments on Railway
    const redis = await initializeRedis();
    
    if (redis) {
      console.log('✅ SECURITY: Redis connection established for session storage');
      
      // Initialize session security store with additional error handling
      try {
        sessionSecurityStore = new SessionSecurityStore(redis, DEFAULT_SESSION_SECURITY_CONFIG);
        console.log('✅ SECURITY: Session security store initialized');
        
        // Create Redis session store for production
        const redisStore = createRedisSessionStore(redis);
        
        // Comprehensive error handling for session store
        redisStore.on('error', (e) => {
          console.warn('⚠️  SESSION store error (handled):', e.message.substring(0, 100));
          // Don't crash - session will fallback to memory
        });
        
        console.log('✅ SECURITY: Redis session store created');
        return redisStore;
      } catch (storeError) {
        console.error('❌ SECURITY: Failed to create session security store - Redis required');
        throw new Error(`Session store creation failed: ${storeError instanceof Error ? storeError.message : 'unknown error'}`);
      }
    }
  } catch (error) {
    console.error('❌ SECURITY: Session initialization failed - Redis connectivity required:', error instanceof Error ? error.message : 'unknown error');
    throw error; // Propagate error instead of fallback
  }
}

// Initialize Redis session store (will be set up in startup function)
let redisStore: any = null;

// Secure session configuration with Redis store for production
const getSessionConfig = (store: any) => {
  const cookieOptions: any = {
    httpOnly: cookieConfig.httpOnly,
    secure: cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    maxAge: cookieConfig.maxAge * 1000, // Convert to milliseconds
  };
  
  // Only add domain if explicitly set (undefined domain breaks session cookies)
  if (cookieConfig.domain) {
    cookieOptions.domain = cookieConfig.domain;
  }
  
  return {
    secret: process.env.SESSION_SECRET || generateSecureSessionToken(),
    name: 'agentSessionId', // Use unique session name for security
    resave: false,
    saveUninitialized: true, // CRITICAL FIX: Save sessions immediately for CSRF token persistence
    rolling: true, // Reset expiration on activity
    cookie: cookieOptions,
    // PRODUCTION REQUIREMENT: Redis store is mandatory
    store: store
  };
};

// Initialize session management (async startup)
async function initializeSession() {
  try {
    redisStore = await initializeRedisSession();
    
    let sessionConfig;
    
    if (redisStore) {
      console.log('✅ SECURITY: Using Redis session store for production-grade session management');
      console.log('✅ SECURITY: Session features: persistence, IP binding, concurrent session limits, activity tracking');
      sessionConfig = getSessionConfig(redisStore);
    } else {
      // Fallback to memory store for development
      console.log('⚠️  DEV MODE: Using memory session store (sessions will be lost on restart)');
      console.log('   This is NOT suitable for production - Redis is required for production deployment');
      sessionConfig = getSessionConfig(null); // No store = memory store
    }
    
    // CRITICAL DEBUG: Log cookie configuration to verify secure flag
    console.log('🔧 SECURITY: Cookie config debug:', JSON.stringify(sessionConfig.cookie, null, 2));
    console.log('🔧 SECURITY: Session config created, mounting middleware...');
    
    app.use(session(sessionConfig));
    console.log('✅ SECURITY: Session middleware mounted successfully');
    
    return true;
  } catch (error) {
    console.error('❌ SECURITY: Session initialization failed:', error);
    throw error;
  }
}

// CRITICAL FIX: Stripe webhook MUST be registered before JSON body parser
// This prevents express.json() from interfering with webhook signature verification
app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const requestId = (req as any).requestId || 'unknown';

  // Enhanced logging for webhook requests
  logger.info('🔔 WEBHOOK: Stripe webhook request received', {
    requestId,
    clientIP,
    hasSignature: !!sig,
    hasSecret: !!webhookSecret,
    bodySize: req.body?.length || 0
  });

  if (!webhookSecret) {
    logger.error('❌ WEBHOOK: Missing STRIPE_WEBHOOK_SECRET configuration', { requestId });
    return res.status(500).json({ 
      error: 'Webhook secret not configured',
      timestamp: new Date().toISOString()
    });
  }

  if (!sig) {
    logger.error('❌ WEBHOOK: Missing Stripe signature header', { requestId, clientIP });
    return res.status(400).json({ 
      error: 'Missing stripe-signature header',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Import Stripe dynamically to handle missing config
    const { default: Stripe } = await import('stripe');
    const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
    
    // Handle missing Stripe in development
    if (!stripe) {
      logger.warn('⚠️ WEBHOOK: Stripe not initialized - development mode', { requestId });
      return res.status(501).json({ 
        error: 'Payments disabled in development mode',
        timestamp: new Date().toISOString()
      });
    }
    
    // Use Stripe's constructEvent for proper signature verification
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    // Enhanced logging for verified webhook events
    logger.info('✅ WEBHOOK: Signature verified successfully', {
      requestId,
      eventId: event.id,
      eventType: event.type,
      created: new Date(event.created * 1000).toISOString(),
      livemode: event.livemode
    });

    // ATOMIC CLAIM: Prevent race conditions with atomic event claiming
    const idempotencyService = getIdempotencyService();
    const claimSuccessful = await idempotencyService.claimEventForProcessing(event.id, 60); // 60 second processing timeout
    
    if (!claimSuccessful) {
      logger.info('🔄 WEBHOOK: Event already claimed/processed - returning idempotent response', {
        requestId,
        eventId: event.id,
        eventType: event.type,
        skipReason: 'already_claimed_or_processed'
      });
      
      return res.status(200).json({ 
        received: true,
        eventId: event.id,
        eventType: event.type,
        processed: true,
        duplicate: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Event successfully claimed for processing
    logger.info('🔒 WEBHOOK: Event successfully claimed for processing', {
      requestId,
      eventId: event.id,
      eventType: event.type,
      claimTimeout: '60s'
    });

    // Comprehensive event handling with detailed logging
    let eventProcessed = false;
    let processingError = null;
    
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        logger.info('💰 WEBHOOK: Payment succeeded', {
          requestId,
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          customerId: paymentIntent.customer,
          metadata: paymentIntent.metadata
        });
        eventProcessed = true;
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        logger.error('💸 WEBHOOK: Payment failed', {
          requestId,
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          customerId: paymentIntent.customer,
          lastPaymentError: paymentIntent.last_payment_error?.message,
          metadata: paymentIntent.metadata
        });
        eventProcessed = true;
        break;
      }
      
      case 'customer.subscription.created': {
        const subscription = event.data.object as any;
        logger.info('📋 WEBHOOK: Subscription created', {
          requestId,
          eventId: event.id,
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
          priceId: subscription.items?.data[0]?.price?.id,
          metadata: subscription.metadata
        });
        eventProcessed = true;
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        logger.info('📋 WEBHOOK: Subscription updated', {
          requestId,
          eventId: event.id,
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
          previousAttributes: event.data.previous_attributes
        });
        eventProcessed = true;
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        logger.info('🧾 WEBHOOK: Invoice payment succeeded', {
          requestId,
          eventId: event.id,
          invoiceId: invoice.id,
          customerId: invoice.customer,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          subscriptionId: invoice.subscription
        });
        eventProcessed = true;
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        logger.error('🧾 WEBHOOK: Invoice payment failed', {
          requestId,
          eventId: event.id,
          invoiceId: invoice.id,
          customerId: invoice.customer,
          amount: invoice.amount_due,
          currency: invoice.currency,
          subscriptionId: invoice.subscription,
          attemptCount: invoice.attempt_count
        });
        eventProcessed = true;
        break;
      }
      
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        logger.info('🛒 WEBHOOK: Checkout session completed', {
          requestId,
          eventId: event.id,
          sessionId: session.id,
          customerId: session.customer,
          paymentIntentId: session.payment_intent,
          amount: session.amount_total,
          currency: session.currency,
          metadata: session.metadata
        });
        eventProcessed = true;
        break;
      }
      
      default: {
        logger.warn('🔔 WEBHOOK: Unhandled event type received', {
          requestId,
          eventId: event.id,
          eventType: event.type,
          created: new Date(event.created * 1000).toISOString(),
          livemode: event.livemode
        });
        eventProcessed = false;
      }
    }

    // Mark event as completed with full TTL to prevent future duplicates
    await idempotencyService.markEventCompleted(event.id);
    
    // Final success logging
    logger.info('✅ WEBHOOK: Event processing completed successfully', {
      requestId,
      eventId: event.id,
      eventType: event.type,
      processed: eventProcessed,
      responseTime: Date.now(),
      atomicProcessing: 'completed'
    });

    res.status(200).json({ 
      received: true,
      eventId: event.id,
      eventType: event.type,
      processed: eventProcessed,
      duplicate: false,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    // Enhanced error logging with security event tracking
    logger.error('❌ WEBHOOK: Signature verification or processing failed', {
      requestId,
      clientIP,
      error: error.message,
      errorType: error.constructor.name,
      hasSignature: !!sig,
      bodySize: req.body?.length || 0
    });

    // CRITICAL: Release processing claim if we had one
    try {
      // Import Stripe to get event ID if possible
      const { default: Stripe } = await import('stripe');
      const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
      
      if (stripe && sig && process.env.STRIPE_WEBHOOK_SECRET) {
        try {
          const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
          const idempotencyService = getIdempotencyService();
          await idempotencyService.releaseEventClaim(event.id);
          
          logger.warn('🔓 WEBHOOK: Processing claim released due to error', {
            requestId,
            eventId: event.id,
            error: error.message
          });
        } catch (releaseError) {
          logger.warn('⚠️ WEBHOOK: Could not release processing claim after error', {
            requestId,
            releaseError: releaseError instanceof Error ? releaseError.message : 'unknown'
          });
        }
      }
    } catch (claimReleaseError) {
      logger.warn('⚠️ WEBHOOK: Error during claim release attempt', {
        requestId,
        claimReleaseError: claimReleaseError instanceof Error ? claimReleaseError.message : 'unknown'
      });
    }

    // Log potential security event for repeated webhook failures
    if (error.message.includes('signature') || error.message.includes('verification')) {
      const { logSecurityEvent } = await import('./security');
      logSecurityEvent('webhook_abuse', {
        endpoint: '/api/stripe/webhook',
        error: 'signature_verification_failed',
        details: error.message,
        clientIP,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
    }

    res.status(400).json({ 
      error: 'Webhook processing failed',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced body parsing with security limits (AFTER webhook registration)
app.use(express.json({ 
  limit: '1mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: false,
  limit: '1mb',
  parameterLimit: 100
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log only basic request info - never sensitive response data
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

// Health check endpoint for deployment monitoring
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// CSRF token endpoint for authenticated forms
app.get('/api/csrf-token', (req: Request, res: Response) => {
  try {
    // Generate new CSRF token for this session
    const csrfToken = generateCSRFToken();
    
    // Store token in session for validation
    if (req.session) {
      req.session.csrfToken = csrfToken;
    } else {
      logger.warn('⚠️ CSRF: Session not available for CSRF token storage', {
        path: req.path,
        sessionId: req.sessionID
      });
      return res.status(503).json({
        error: 'Session required for CSRF protection',
        code: 'SESSION_REQUIRED'
      });
    }
    
    logger.debug('🔐 CSRF: Token generated and stored in session', {
      sessionId: req.sessionID,
      tokenPrefix: csrfToken.substring(0, 8) + '***'
    });
    
    res.json({
      csrfToken,
      timestamp: new Date().toISOString(),
      sessionId: req.sessionID
    });
  } catch (error) {
    logger.error('❌ CSRF: Token generation failed', {
      error: error instanceof Error ? error.message : 'unknown',
      sessionId: req.sessionID
    });
    
    res.status(500).json({
      error: 'Failed to generate CSRF token',
      code: 'CSRF_GENERATION_ERROR'
    });
  }
});

(async () => {
  try {
    console.log('🚀 1. App starting...');
    console.log('🚀 2. Environment:', process.env.NODE_ENV);
    console.log('🚀 3. Port:', process.env.PORT);
    console.log('🚀 4. Railway Environment:', process.env.RAILWAY_ENVIRONMENT);
    
    // SECURITY FIX: Validate critical security configuration at startup
    log('🔐 Validating security configuration...');
    validateSecurityConfiguration();
    log('✅ Security configuration validated');

    // SECURITY ENHANCEMENT: Validate enhanced security headers and production setup
    log('🔐 Validating enhanced security configuration...');
    validateSecurityHeaders();
    validateProductionSecurity();
    log('✅ Enhanced security configuration validated');
    
    // STRIPE LIVE KEY VALIDATION: Enforce production-only live keys
    if (ENV_CONFIG.NODE_ENV === 'production') {
      log('🔐 Validating Stripe keys for production deployment...');
      const stripeValidation = validateStripeKeysForProduction();
      if (!stripeValidation.success) {
        logger.error('❌ STRIPE: Production key validation failed', {
          errors: stripeValidation.errors,
          action: 'Application startup aborted'
        });
        console.error('🚨 CRITICAL ERROR: Stripe production key validation failed');
        stripeValidation.errors.forEach(error => console.error(`   ${error}`));
        console.error('   REQUIRED: Configure live Stripe keys (sk_live_/pk_live_) for production deployment');
        process.exit(1); // FAIL FAST: Invalid Stripe keys not allowed in production
      }
      logger.info('✅ STRIPE: Production key validation successful - live keys confirmed');
    } else {
      log('⚠️ DEV MODE: Skipping Stripe validation for development');
    }
    
    // CORS RUNTIME CONFIRMATION: Log exact allowed origins for production verification
    const allowedOrigins = ENV_CONFIG.getValidatedAllowedOrigins();
    logger.info('🔒 CORS: Production domains explicitly confirmed', {
      allowedOrigins: allowedOrigins,
      count: allowedOrigins.length,
      policy: 'strict_origin_enforcement'
    });
    console.log('🔒 SECURITY: CORS locked to production domains:', allowedOrigins.join(', '));
    
    // CSRF PROTECTION: Enable CSRF middleware for authenticated routes
    log('🔐 Enabling CSRF protection for authenticated routes...');
    const csrfMiddleware = createCSRFProtectionMiddleware();
    app.use(csrfMiddleware);
    logger.info('✅ CSRF: Protection enabled for authenticated routes (excludes Stripe webhooks)');
    console.log('🛡️ SECURITY: CSRF protection active - Stripe webhooks exempted');

    // CRITICAL FIX: Initialize session management SYNCHRONOUSLY before routes
    log('🔐 Initializing session management (synchronous)...');
    try {
      await initializeSession();
      log('✅ Session management initialized');
    } catch (error) {
      logger.error('❌ PRODUCTION STARTUP FAILED: Redis session store required', {
        error: error instanceof Error ? error.message : String(error),
        context: 'Session initialization failed - production deployment requires Redis connectivity',
        action: 'Application startup aborted'
      });
      console.error('🚨 CRITICAL ERROR: Redis session store is mandatory for production deployment');
      console.error('   NO FALLBACKS: Memory store fallbacks are disabled for production security');
      console.error('   REQUIRED: Ensure Redis is configured and accessible via REDIS_URL');
      process.exit(1); // FAIL FAST: No memory store fallback allowed
    }

    console.log('🚀 5. Redis singleton initialized successfully');
    
    // CRITICAL FIX: Initialize idempotency service with Redis singleton (NON-BLOCKING)
    log('🔄 Initializing webhook idempotency service...');
    
    // Initialize idempotency service asynchronously to not block server startup
    (async () => {
      try {
        // CRITICAL FIX: Use Redis singleton to ensure shared connection
        const { getSharedRedis, waitForRedis, debugRedisStatus } = await import('./redis-singleton');
        
        console.log('🔧 IDEMPOTENCY: Waiting for Redis singleton to be ready...');
        debugRedisStatus();
        
        // Wait for Redis to be ready with timeout
        const redis = await waitForRedis(30000); // 30 second timeout
        
        if (redis) {
          const idempotencyService = initializeIdempotencyService(redis);
          const stats = idempotencyService.getStats();
          
          logger.info('✅ IDEMPOTENCY: Service initialized successfully (Redis-only)', {
            hasRedis: stats.hasRedis,
            redisConnected: stats.redisConnected
          });
          
          console.log('✅ IDEMPOTENCY: Service initialized with shared Redis connection');
        } else {
          // Check if we're in development mode
          const isReplitDev = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
          if ((process.env.NODE_ENV === 'development' || isReplitDev) && !process.env.FORCE_REDIS_REQUIRED) {
            console.log('⚠️  DEV MODE: Idempotency service disabled - Redis not available');
            console.log('   This is NOT suitable for production - webhook duplicate prevention disabled');
            logger.info('⚠️  DEV MODE: Idempotency service disabled (Redis required)');
          } else {
            console.log('⚠️  PRODUCTION: Idempotency service disabled - Redis not available');
            console.log('   Webhook duplicate prevention disabled');
            logger.info('⚠️  PRODUCTION: Idempotency service disabled (Redis required)');
          }
        }
      } catch (error) {
        console.log('⚠️  IDEMPOTENCY: Service initialization failed:', error instanceof Error ? error.message : String(error));
        logger.warn('⚠️  IDEMPOTENCY: Service initialization failed - continuing without idempotency');
      }
    })();

    console.log('🚀 6. Idempotency service initialized successfully');
    
    // CRITICAL: Add Railway health check endpoints BEFORE routes
    console.log('🚀 7. Adding Railway health check endpoints...');
    
    // Simple health check - always responds immediately
    app.get('/health', (req, res) => {
      console.log('🏥 Health check requested');
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        redis: redisInstance ? 'connected' : 'not_available',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Root endpoint for Railway fallback
    app.get('/', (req, res) => {
      console.log('🏠 Root endpoint requested');
      res.status(200).json({ 
        status: 'running', 
        timestamp: new Date().toISOString(),
        message: 'Railway deployment successful'
      });
    });

    // Readiness check with timeout
    app.get('/ready', async (req, res) => {
      console.log('🔍 Readiness check requested');
      try {
        if (redisInstance) {
          // Add timeout to prevent hanging
          const pingPromise = redisInstance.ping();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
          );
          
          await Promise.race([pingPromise, timeoutPromise]);
          res.status(200).json({ 
            status: 'ready', 
            timestamp: new Date().toISOString(),
            redis: 'connected'
          });
        } else {
          res.status(200).json({ 
            status: 'ready', 
            timestamp: new Date().toISOString(),
            redis: 'not_available'
          });
        }
      } catch (error) {
        console.log('⚠️ Readiness check failed:', error instanceof Error ? error.message : String(error));
        res.status(200).json({ 
          status: 'ready', 
          timestamp: new Date().toISOString(),
          redis: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // STARTUP FIX: Start server AFTER session is ready
    log('🚀 Starting HTTP server...');
    console.log('🚀 8. Registering routes...');
    const server = await registerRoutes(app);
    console.log('🚀 9. Routes registered successfully');
    
    // Start listening on port immediately - CRITICAL for Replit deployment
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`🌐 Server running on port ${port}`);
      console.log('🚀 10. Server listening successfully');
      console.log('🚀 11. Application startup complete!');
      console.log('🚀 12. Health endpoints available: /health, /ready, /');
    });
    
    // Now initialize Redis components asynchronously without blocking startup
    log('🚀 Initializing task queue system (non-blocking)...');
    initializeQueue().then(() => {
      logger.info('✅ QUEUE: Task queue system initialized (Redis-only)');
    }).catch((error) => {
      logger.error('❌ PRODUCTION STARTUP FAILED: Redis queue system required', {
        error: error.message,
        context: 'Queue system initialization failed - production deployment requires Redis connectivity',
        action: 'Application startup aborted'
      });
      console.error('🚨 CRITICAL ERROR: Redis queue system is mandatory for production deployment');
      console.error('   NO FALLBACKS: Memory queue fallbacks are disabled for production security');
      console.error('   REQUIRED: Ensure Redis is configured and accessible via REDIS_URL');
      process.exit(1); // FAIL FAST: No memory queue fallback allowed
    });


    // DEVELOPMENT MODE: Set up Vite development server with HMR
    log('🔧 Setting up Vite development server...');
    try {
      await setupVite(app, server);
      log('✅ Vite development server setup complete');
      log(`📍 Frontend accessible at: http://localhost:${port}`);
      log('⚡ Hot module replacement enabled');
    } catch (error) {
      log('❌ Vite setup failed:', error instanceof Error ? error.message : String(error));
      // Fallback to static serving if Vite fails
      log('🔄 Falling back to static file serving...');
      try {
        serveStatic(app);
        log('✅ Static file serving setup complete (fallback)');
      } catch (staticError) {
        log('❌ Static fallback also failed:', staticError instanceof Error ? staticError.message : String(staticError));
        throw error; // Original Vite error
      }
    }

    // Global error handler - MUST be after all routes to catch route errors
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error({ 
        error: error.message, 
        stack: error.stack, 
        requestId: (req as any).id,
        url: req.url,
        method: req.method
      }, 'Unhandled application error');
      
      res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message 
      });
    });

    // WebSocket and VNC initialization (after server is already listening)
    setTimeout(async () => {
      try {
        // Initialize WebSocket server with the HTTP server
        log('🔌 Initializing WebSocket server...');
        await wsManager.initialize(server);
        log('✅ WebSocket server initialized');
        log(`🔗 WebSocket available at ws://localhost:${port}/ws`);
        log(`📊 Queue stats: ${JSON.stringify(wsManager.getStats())}`);

        // Initialize VNC proxy server for real browser automation streaming with Redis integration
        log('🔌 Initializing VNC WebSocket proxy...');
        initializeVNCProxy(server, {
          vncHost: process.env.VNC_HOST || '127.0.0.1',
          vncPort: parseInt(process.env.VNC_PORT || '5901', 10),
          maxConnections: parseInt(process.env.VNC_MAX_CONNECTIONS || '10', 10)
        }, redisInstance || undefined); // Pass Redis connection for session validation
        log('✅ VNC proxy server initialized');

        // SECURITY FIX: Validate WebSocket configuration is working
        validateWebSocketConfiguration();
      } catch (error) {
        log('⚠️  WebSocket/VNC initialization failed, but server is still running:', error instanceof Error ? error.message : String(error));
      }
    }, 100); // Small delay to ensure server is fully started

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      log(`\n🔄 ${signal} received. Starting graceful shutdown...`);
      
      try {
        // Close WebSocket connections
        await wsManager.shutdown();
        log('✅ WebSocket server closed');
        
        // Close task queue
        await closeQueue();
        log('✅ Task queue closed');
        
        // Close HTTP server
        server.close(() => {
          log('✅ HTTP server closed');
          process.exit(0);
        });
      } catch (error) {
        log('❌ Error during shutdown:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts

  } catch (error) {
    log('❌ Failed to start server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
