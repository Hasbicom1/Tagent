import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { wsManager } from "./websocket";
import { initializeQueue, closeQueue } from "./queue";
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

const app = express();

// Configure trust proxy first - BEFORE any middleware that needs it
app.set('trust proxy', 1);

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

  // Content Security Policy
  contentSecurityPolicy: {
    directives: securityConfig.contentSecurityPolicy.directives,
    reportOnly: securityConfig.contentSecurityPolicy.reportOnly
  },

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

// Secure session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || generateSecureSessionToken(),
  name: 'sessionId', // Don't use default session name
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
  // Use environment-specific session store
  store: undefined // Will be configured based on environment
};

// Configure session store based on environment
if (process.env.NODE_ENV === 'production') {
  // In production, warn about missing session store
  console.warn('⚠️  SECURITY: Using memory store for sessions in production - consider Redis or database store');
} else {
  // Development can use memory store
  console.log('🔄 SECURITY: Using memory store for sessions in development');
}

app.use(session(sessionConfig));

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

    // Set up Express routes and get HTTP server instance
    const server = await registerRoutes(app);

    // Initialize WebSocket server with the HTTP server
    log('🔌 Initializing WebSocket server...');
    await wsManager.initialize(server);
    log('✅ WebSocket server initialized');

    // SECURITY FIX: Validate WebSocket configuration is working
    validateWebSocketConfiguration();

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

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
