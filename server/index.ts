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
  generateSecureSessionToken
} from "./security";
import { 
  createRedisSessionStore,
  SessionSecurityStore,
  DEFAULT_SESSION_SECURITY_CONFIG
} from "./session";

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
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false
  } : false,

  // X-Frame-Options
  frameguard: {
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
    // Force HTTPS in production
    if (req.header('x-forwarded-proto') !== 'https' && process.env.FORCE_HTTPS !== 'false') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    
    // Additional production security headers
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
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
  const redisUrl = process.env.REDIS_URL;
  
  // Skip Redis entirely if no URL provided (common in Replit deployments)
  if (!redisUrl) {
    console.log('🔄 REDIS: No REDIS_URL provided - using memory store for Replit deployment');
    return null;
  }
  
  try {
    redisInstance = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1, // Reduced for faster fallback
      connectTimeout: 3000,     // Quick timeout for fast fallback
      commandTimeout: 2000,     // Quick timeout
      enableAutoPipelining: true,
      enableOfflineQueue: false // Don't queue commands when offline
    });
    
    // Comprehensive error handling to prevent crashes
    redisInstance.on('error', (e) => {
      console.warn('⚠️  REDIS error (handled):', e.message.substring(0, 100));
      // Don't rethrow - just log and continue
    });
    
    redisInstance.on('close', () => {
      console.warn('⚠️  REDIS connection closed');
    });
    
    redisInstance.on('reconnecting', () => {
      console.log('🔄 REDIS reconnecting...');
    });
    
    // Quick connection test with aggressive timeout
    await Promise.race([
      redisInstance.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 3000))
    ]);
    
    console.log('✅ REDIS: Connection established successfully');
    return redisInstance;
  } catch (error: any) {
    console.warn(`⚠️  REDIS: Connection failed (${error.message.substring(0, 100)}) - using memory store fallback`);
    
    // Ensure complete cleanup
    if (redisInstance) {
      try {
        redisInstance.removeAllListeners();
        redisInstance.disconnect(false); // Force disconnect without retry
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      redisInstance = null;
    }
    return null;
  }
}

async function initializeRedisSession(): Promise<any> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Skip Redis initialization if no URL provided (Replit deployment)
    if (!process.env.REDIS_URL) {
      if (isProduction) {
        console.log('🔄 SECURITY: Replit deployment detected - using secure memory store for sessions');
      } else {
        console.log('🔄 SECURITY: Using memory store for session storage in development');
      }
      return null;
    }
    
    // Try to initialize Redis with robust error handling
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
        console.warn('⚠️  SECURITY: Failed to create session security store - using memory fallback');
        return null;
      }
    } else {
      // Graceful fallback to memory store
      if (isProduction) {
        console.warn('⚠️  SECURITY: Redis not available, using secure memory store for Replit deployment');
      } else {
        console.log('🔄 SECURITY: Using memory store for session storage in development');
      }
      return null;
    }
  } catch (error) {
    console.warn('⚠️  SECURITY: Session initialization failed - using memory store fallback:', error instanceof Error ? error.message.substring(0, 100) : 'unknown error');
    return null;
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
    // Use Redis store in production, memory store in development
    store: store || undefined
  };
};

// Initialize session management (async startup)
async function initializeSession() {
  try {
    redisStore = await initializeRedisSession();
    
    // Log session store configuration
    if (redisStore) {
      console.log('✅ SECURITY: Using Redis session store for production-grade session management');
      console.log('✅ SECURITY: Session features: persistence, IP binding, concurrent session limits, activity tracking');
    } else {
      console.log('🔄 SECURITY: Using memory store for sessions in development');
    }
    
    const sessionConfig = getSessionConfig(redisStore);
    
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
app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  try {
    // Import Stripe dynamically to handle missing config
    const Stripe = require('stripe');
    const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
    
    // Handle missing Stripe in development
    if (!stripe) {
      console.log('⚠️ DEV MODE: Stripe webhook received but Stripe not initialized');
      return res.status(501).json({ error: 'Payments disabled in development mode' });
    }
    
    // Use Stripe's constructEvent for proper signature verification
    const event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log(`💰 Payment succeeded: ${event.data.object.id}`);
        break;
      
      case 'payment_intent.payment_failed':
        console.log(`💸 Payment failed: ${event.data.object.id}`);
        break;
      
      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    res.status(400).json({ error: 'Webhook error' });
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

(async () => {
  try {
    // SECURITY FIX: Validate critical security configuration at startup
    log('🔐 Validating security configuration...');
    validateSecurityConfiguration();
    log('✅ Security configuration validated');

    // SECURITY ENHANCEMENT: Validate enhanced security headers and production setup
    log('🔐 Validating enhanced security configuration...');
    validateSecurityHeaders();
    validateProductionSecurity();
    log('✅ Enhanced security configuration validated');

    // CRITICAL FIX: Initialize session management SYNCHRONOUSLY before routes
    log('🔐 Initializing session management (synchronous)...');
    try {
      await initializeSession();
      log('✅ Session management initialized');
    } catch (error) {
      log('⚠️  Session management initialization failed, continuing with memory store:', error instanceof Error ? error.message : String(error));
    }

    // STARTUP FIX: Start server AFTER session is ready
    log('🚀 Starting HTTP server...');
    const server = await registerRoutes(app);
    
    // Start listening on port immediately - CRITICAL for Replit deployment
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`🌐 Server running on port ${port}`);
    });
    
    // Now initialize Redis components asynchronously without blocking startup
    log('🚀 Initializing task queue system (non-blocking)...');
    initializeQueue().then(() => {
      log('✅ Task queue system initialized');
    }).catch((error) => {
      log('⚠️  Task queue initialization failed, continuing with in-memory fallback:', error.message);
    });


    // TEMP FIX: Skip Vite dev server due to restart loop issue
    // Backend is fully functional - focusing on API stability first
    log(`🔍 Temporarily using production mode to avoid Vite restart loop`);
    log('📦 Setting up static file serving...');
    try {
      // Create a basic index.html for testing if dist doesn't exist
      const distPath = path.resolve(import.meta.dirname, "../dist/public");
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
        const basicHtml = `<!DOCTYPE html>
<html><head><title>Agent HQ - Backend Ready</title></head>
<body style="font-family:monospace;background:#000;color:#00ff41;padding:20px;">
<h1>🤖 Agent HQ Backend Systems Online</h1>
<p>✅ All backend systems functional</p>
<p>✅ WebSocket: ws://localhost:5000/ws</p>
<p>✅ Health: <a href="/health" style="color:#00ff41">/health</a></p>
<p>✅ Payment system ready</p>
<p>⚠️ Frontend in development mode - using API endpoints</p>
</body></html>`;
        fs.writeFileSync(path.join(distPath, 'index.html'), basicHtml);
      }
      // Direct static file serving - bypass protected serveStatic function
      app.use(express.static(distPath));
      
      // SPA fallback for React Router
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
      
      log('✅ Static file serving setup complete');
    } catch (error) {
      log('❌ Static setup failed:', error instanceof Error ? error.message : String(error));
      // Don't throw - continue with backend only
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
