import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
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
if (process.env.NODE_ENV === 'development') {
  process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err.message);
    console.error(err.stack);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

// Define Replit environment detection
const isReplit = !!(process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID);

const app = express();

// Configure trust proxy first - BEFORE any middleware that needs it
app.set('trust proxy', 1);

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

// Apply enhanced security headers based on environment
const securityConfig = getSecurityHeadersConfig();
const cookieConfig = getSecureCookieConfig();

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
  if (!redisUrl) return null;
  
  redisInstance = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 5000,
    enableAutoPipelining: true
  });
  
  // Add error listener to prevent crashes
  redisInstance.on('error', (e) => {
    console.warn('⚠️  REDIS error:', e.message);
  });
  
  await redisInstance.ping();
  return redisInstance;
}

async function initializeRedisSession(): Promise<any> {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Initialize Redis using the new configuration
    const redis = await initializeRedis();
    
    if (redis) {
      console.log('✅ SECURITY: Redis connection established for session storage');
      
      // Initialize session security store
      sessionSecurityStore = new SessionSecurityStore(redis, DEFAULT_SESSION_SECURITY_CONFIG);
      console.log('✅ SECURITY: Session security store initialized');
      
      // Create Redis session store for production
      const redisStore = createRedisSessionStore(redis);
      
      // Add error listener to RedisStore to prevent crashes
      redisStore.on('error', (e) => {
        console.warn('⚠️  SESSION store error:', e.message);
      });
      
      console.log('✅ SECURITY: Redis session store created');
      return redisStore;
    } else {
      // Fallback to memory store for development or when Redis is unavailable
      if (isDevelopment) {
        console.log('🔄 SECURITY: Using memory store for session storage in development');
        return null;
      } else {
        console.warn('⚠️  SECURITY: Redis not available, using memory store (not recommended for production)');
        return null;
      }
    }
  } catch (error) {
    console.error('❌ SECURITY: Redis session initialization failed:', error);
    console.warn('⚠️  SECURITY: Falling back to memory store');
    return null;
  }
}

// Initialize Redis session store (will be set up in startup function)
let redisStore: any = null;

// Secure session configuration with Redis store for production
const getSessionConfig = (store: any) => ({
  secret: process.env.SESSION_SECRET || generateSecureSessionToken(),
  name: 'agentSessionId', // Use unique session name for security
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    httpOnly: cookieConfig.httpOnly,
    secure: cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    maxAge: cookieConfig.maxAge * 1000, // Convert to milliseconds
    domain: cookieConfig.domain
  },
  // Use Redis store in production, memory store in development
  store: store || undefined
});

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
    app.use(session(sessionConfig));
    
    return true;
  } catch (error) {
    console.error('❌ SECURITY: Session initialization failed:', error);
    throw error;
  }
}

// Enhanced body parsing with security limits
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

    // STARTUP FIX: Start server first, then initialize Redis components to avoid blocking port 5000
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

    // Initialize session management with Redis (non-blocking)
    log('🔐 Initializing session management (non-blocking)...');
    initializeSession().then(() => {
      log('✅ Session management initialized');
    }).catch((error) => {
      log('⚠️  Session management initialization failed, continuing with memory store:', error.message);
    });


    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
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
