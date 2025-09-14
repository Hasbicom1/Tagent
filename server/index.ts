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
let redis: Redis | null = null;
let sessionSecurityStore: SessionSecurityStore | null = null;

async function initializeRedisSession(): Promise<any> {
  try {
    const redisUrl = process.env.REDIS_URL;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (redisUrl) {
      // Test Redis connection before creating the main connection
      try {
        const testRedis = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 3000,
        });
        
        await testRedis.ping();
        testRedis.disconnect();
        console.log('✅ SECURITY: Redis connection test successful');
        
        // Create the actual connection for session storage
        redis = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });
        
        // Test the actual connection
        await redis.ping();
        console.log('✅ SECURITY: Redis connection established for session storage');
        
        // Initialize session security store
        sessionSecurityStore = new SessionSecurityStore(redis, DEFAULT_SESSION_SECURITY_CONFIG);
        console.log('✅ SECURITY: Session security store initialized');
        
        // Create Redis session store for production
        const redisStore = createRedisSessionStore(redis);
        console.log('✅ SECURITY: Redis session store created');
        
        return redisStore;
      } catch (connectionError) {
        console.error('❌ SECURITY: Redis connection failed:', connectionError instanceof Error ? connectionError.message : connectionError);
        if (isDevelopment) {
          console.log('🔄 SECURITY: Falling back to memory store in development');
          return null;
        }
        throw connectionError;
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('REDIS_URL required for production session storage and security features');
    } else {
      console.log('🔄 SECURITY: Redis not configured - using memory store for development');
      return null;
    }
  } catch (error) {
    console.error('❌ SECURITY: Redis session initialization failed:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    console.warn('⚠️  SECURITY: Falling back to memory store in development');
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

    // Initialize the task queue system first
    log('🚀 Initializing task queue system...');
    await initializeQueue();
    log('✅ Task queue system initialized');

    // Initialize session management with Redis
    log('🔐 Initializing session management...');
    await initializeSession();
    log('✅ Session management initialized');

    // Set up Express routes and get HTTP server instance
    const server = await registerRoutes(app);

    // Initialize WebSocket server with the HTTP server
    log('🔌 Initializing WebSocket server...');
    await wsManager.initialize(server);
    log('✅ WebSocket server initialized');

    // Initialize VNC proxy server for real browser automation streaming with Redis integration
    log('🔌 Initializing VNC WebSocket proxy...');
    initializeVNCProxy(server, {
      vncHost: process.env.VNC_HOST || '127.0.0.1',
      vncPort: parseInt(process.env.VNC_PORT || '5901', 10),
      maxConnections: parseInt(process.env.VNC_MAX_CONNECTIONS || '10', 10)
    }, redis || undefined); // Pass Redis connection for session validation
    log('✅ VNC proxy server initialized');

    // SECURITY FIX: Validate WebSocket configuration is working
    validateWebSocketConfiguration();

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

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`🌐 Server running on port ${port}`);
      log(`🔗 WebSocket available at ws://localhost:${port}/ws`);
      log(`📊 Queue stats: ${JSON.stringify(wsManager.getStats())}`);
    });

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
