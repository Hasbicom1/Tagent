/**
 * PRODUCTION ENTRY POINT - Railway Deployment
 * 
 * This combines the working patterns from test-server.js with the actual application.
 * Follows the exact successful configuration that passed Railway health checks.
 */

import http from 'http';
// Socket.IO realtime automation (events only; not used for VNC streaming)
import { RealTimeAutomationSocket } from './websocket/real-time-automation.js';
import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedis, isRedisAvailable, waitForRedis } from './redis-simple.js';
import { debugStripeComprehensive } from './stripe-debug.js';
import { initStripe, isStripeReady } from './stripe-simple.js';
import { initializeDatabase, createTables, getDatabase } from './database.js';
import FreeAIService from '../services/FreeAIService.js';

// Import REAL implementations (no simulation)
// Note: Real implementations are available but not imported to avoid startup errors
// They can be enabled when needed for production deployment

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 PRODUCTION: Starting application with proven Railway patterns...');
console.log('🚀 PRODUCTION: Environment:', process.env.NODE_ENV);
console.log('🚀 PRODUCTION: Port:', process.env.PORT || '8080');
console.log('🚀 PRODUCTION: Railway Environment:', process.env.RAILWAY_ENVIRONMENT);

// AI provider configuration visibility (for debugging only)
console.log('=== AI Configuration ===');
console.log('Groq:', process.env.GROQ_API_KEY ? '✅ Configured' : '❌ Missing');
console.log('DeepSeek:', process.env.DEEPSEEK_API_KEY ? '✅ Configured' : '⚠️  Not set');
console.log('OpenAI:', process.env.OPENAI_API_KEY ? '✅ Configured' : '⚠️  Not set');
console.log('=======================');

// Initialize LocalAI (OpenAI-compatible) adapter
const ai = new FreeAIService();

// Get Ollama URL from environment variable
const ollamaUrl = process.env.OLLAMA_INTERNAL_URL || 'http://ollama-ai.railway.internal:11434';

console.log('=================================');
console.log('🤖 AI CONFIGURATION');
console.log('Using: Ollama (self-hosted)');
console.log('Endpoint:', ollamaUrl);
console.log('Model: tinyllama:latest');
console.log('=================================');

// Initialize optional Ollama client via Railway private networking
let ollamaClient = null;
try {
  const { Ollama } = require('ollama');
  ollamaClient = new Ollama({ host: ollamaUrl });
  (async () => {
    try {
      await ollamaClient.list();
      console.log(`✅ Ollama connected successfully (${ollamaUrl})`);
    } catch (e) {
      console.warn('⚠️  Ollama connection not available yet:', e?.message);
    }
  })();
} catch (e) {
  console.warn('⚠️  Ollama client not installed or not resolvable in this environment');
}

// FAIL-FAST: Mandatory production environment variables
if (process.env.NODE_ENV === 'production') {
  const REQUIRED_FOR_PRODUCTION = [
    'DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  const strict = process.env.STRICT_PRODUCTION_CHECKS === 'true';
  const missing = REQUIRED_FOR_PRODUCTION.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    const msg = `Missing required envs: ${missing.join(', ')}`;
    if (strict) {
      console.error(`FATAL: ${msg}`);
      process.exit(1);
    } else {
      console.warn(`⚠️ PRODUCTION: ${msg}. Continuing without fatal exit (STRICT_PRODUCTION_CHECKS!=true)`);
    }
  }
}

// STEP 1: Environment variable validation
const requiredEnvVars = ['NODE_ENV', 'PORT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️ PRODUCTION: Missing environment variables:', missingVars);
}

// STEP 2: Port configuration (using proven pattern)
const port = parseInt(process.env.PORT || '8080', 10);
const host = '0.0.0.0';

// STEP 3: Create Express app
const app = express();
// Trust proxy for correct HTTPS detection behind Railway/NGINX
app.set('trust proxy', 1);

// Rate limit metrics (basic counters for observability)
const rateLimitMetrics = {
  global429: 0,
  payment429: 0,
  session429: {
    message: 0,
    execute: 0,
    screenshot: 0,
  },
};

// Initialize session limiters with no-op to avoid temporal dead zone
const noopLimiter = (req, res, next) => next();
let messageLimiter = noopLimiter;
let executeLimiter = noopLimiter;
let screenshotLimiter = noopLimiter;

// STEP 4: CORS configuration (Railway-compatible)
app.use(cors({
  origin: [
    'https://onedollaragent.ai',
    'https://www.onedollaragent.ai',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  credentials: true
}));

// STEP 4.2: Security headers (Helmet) for production hardening
app.use(helmet({
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: false
  } : false,
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://js.stripe.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'wss:', 'https:', 'http:', 'https://api.stripe.com', 'https://api.openai.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameSrc: ['https://checkout.stripe.com', 'https://js.stripe.com'],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    }
  } : false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
}));

// STEP 4.3: Optional HTTPS enforcement behind proxy
if (process.env.FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      const hostHeader = req.headers['host'];
      const url = `https://${hostHeader}${req.url}`;
      return res.redirect(301, url);
    }
    next();
  });
}

// STEP 4.4: Global Redis-backed rate limiting (applies to all requests)
// Configurable via env: GLOBAL_RATE_LIMIT_WINDOW_MS, GLOBAL_RATE_LIMIT_MAX
const GLOBAL_RATE_LIMIT_WINDOW_MS = parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || '60000', 10);
const GLOBAL_RATE_LIMIT_MAX = parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '500', 10);

function createRedisGlobalLimiter(windowMs, max) {
  let redisClientPromise;
  const getClient = async () => {
    if (!redisClientPromise) {
      // Lazily initialize Redis client; fail-open if unavailable
      redisClientPromise = getRedis().catch(() => null);
    }
    return redisClientPromise;
  };

  return async (req, res, next) => {
    try {
      const redis = await getClient();
      if (!redis) return next();

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      const key = `rl:global:${ip}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttlSeconds = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      if (ttlSeconds && ttlSeconds > 0) {
        res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + ttlSeconds));
      }

        if (count > max) {
          if (ttlSeconds && ttlSeconds > 0) {
            res.setHeader('Retry-After', String(ttlSeconds));
          }
          rateLimitMetrics.global429++;
          return res.status(429).json({
            error: 'GLOBAL_RATE_LIMIT_EXCEEDED',
            limit: max,
            windowMs,
            retryAfterSeconds: ttlSeconds || Math.ceil(windowMs / 1000),
          });
        }

      return next();
    } catch (err) {
      // Fail-open on unexpected errors to avoid breaking production traffic
      return next();
    }
  };
}

const globalLimiter = createRedisGlobalLimiter(GLOBAL_RATE_LIMIT_WINDOW_MS, GLOBAL_RATE_LIMIT_MAX);
app.use(globalLimiter);

// STEP 4.5: Payment-specific Redis limiter for Stripe webhooks
const PAYMENT_RATE_LIMIT_WINDOW_MS = parseInt(process.env.PAYMENT_RATE_LIMIT_WINDOW_MS || '60000', 10);
const PAYMENT_RATE_LIMIT_MAX = parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || '100', 10);

function createRedisPaymentLimiter(windowMs, max) {
  let redisClientPromise;
  const getClient = async () => {
    if (!redisClientPromise) {
      redisClientPromise = getRedis().catch(() => null);
    }
    return redisClientPromise;
  };

  return async (req, res, next) => {
    try {
      const redis = await getClient();
      if (!redis) return next();

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      const key = `rl:payment:${ip}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttlSeconds = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      if (ttlSeconds && ttlSeconds > 0) {
        res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + ttlSeconds));
      }

      if (count > max) {
        if (ttlSeconds && ttlSeconds > 0) {
          res.setHeader('Retry-After', String(ttlSeconds));
        }
        rateLimitMetrics.payment429++;
        return res.status(429).json({
          error: 'PAYMENT_RATE_LIMIT_EXCEEDED',
          limit: max,
          windowMs,
          retryAfterSeconds: ttlSeconds || Math.ceil(windowMs / 1000),
        });
      }

      return next();
    } catch (err) {
      return next();
    }
  };
}

const paymentLimiter = createRedisPaymentLimiter(PAYMENT_RATE_LIMIT_WINDOW_MS, PAYMENT_RATE_LIMIT_MAX);

// TEST ROUTE - Add immediately after CORS
app.get('/api/test-route', (req, res) => {
  console.log('🧪 TEST: Route found and working');
  res.json({ message: 'Test route is working', timestamp: new Date().toISOString() });
});

// STEP 4.9: Stripe webhook endpoint BEFORE body parsers (raw body required)
// This ensures req.body is a Buffer for Stripe signature verification
// Apply payment limiter before raw body to avoid interfering with Stripe signature parsing
app.post('/api/stripe/webhook', paymentLimiter, express.raw({ type: '*/*' }), async (req, res) => {
  console.log('🔔 PRODUCTION: Stripe webhook received (raw body)');
  const sig = req.get('Stripe-Signature') || req.get('stripe-signature');
  const contentType = req.get('content-type');
  const isBuffer = Buffer.isBuffer(req.body);
  const bodyLength = isBuffer ? req.body.length : (typeof req.body === 'string' ? req.body.length : 0);
  console.log('🔎 PRODUCTION: Webhook diagnostics', {
    hasSignature: !!sig,
    contentType,
    bodyIsBuffer: isBuffer,
    bodyLength
  });
  try {
    const { handleWebhook } = await import('./stripe-simple.js');
    await handleWebhook(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ PRODUCTION: Stripe webhook handling failed:', message);
    return res.status(400).json({
      error: 'WEBHOOK_ERROR',
      message: 'Webhook verification failed',
      details: message,
      timestamp: new Date().toISOString()
    });
  }
});

// STEP 5: Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// STEP 5.5: Serve static files from dist/public
const staticPath = path.join(__dirname, '..', 'dist', 'public');
console.log('📁 PRODUCTION: Serving static files from:', staticPath);
app.use(express.static(staticPath));

// In-memory automation engine sessions
const activeAutomationEngines = new Map();

async function getAutomationEngine(sessionId) {
  if (activeAutomationEngines.has(sessionId)) {
    return activeAutomationEngines.get(sessionId);
  }
  const { RealBrowserEngine } = await import('./automation/real-browser-engine.js');
  const engine = new RealBrowserEngine();
  await engine.initialize();
  activeAutomationEngines.set(sessionId, engine);
  return engine;
}

async function shutdownAutomationEngine(sessionId) {
  const engine = activeAutomationEngines.get(sessionId);
  if (engine) {
    try {
      await engine.close();
    } catch (e) {
      console.warn('⚠️ PRODUCTION: Error closing engine for session', sessionId, e.message);
    }
    activeAutomationEngines.delete(sessionId);
    return true;
  }
  return false;
}

// STEP 6: Health endpoints setup (IMMEDIATE AVAILABILITY - proven pattern)
app.get('/health', async (req, res) => {
  console.log('🏥 PRODUCTION: Health check requested');
  
  try {
    // Check Redis connection
    let redisStatus = 'disconnected';
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.ping();
        redisStatus = 'connected';
      }
    } catch (error) {
      console.warn('⚠️ PRODUCTION: Redis ping failed:', error.message);
      redisStatus = 'disconnected';
    }
    
    // Check Stripe connection
    const stripeStatus = isStripeReady() ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: redisStatus,
      stripe: stripeStatus,
      environment: process.env.NODE_ENV || 'development',
      port: port,
      railway: true,
      endpoints: ['/health', '/', '/api/health', '/api/stripe/status'],
      rateLimit429: {
        global: rateLimitMetrics.global429,
        payment: rateLimitMetrics.payment429,
        session: rateLimitMetrics.session429,
      }
    });
    
    console.log('🏥 PRODUCTION: Health check response sent');
  } catch (error) {
    console.error('❌ PRODUCTION: Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// STEP 7: Root endpoint - Serve React application
app.get('/', (req, res) => {
  console.log('🏠 PRODUCTION: Root endpoint requested - serving React app');
  res.sendFile(path.join(staticPath, 'index.html'));
  console.log('🏠 PRODUCTION: React application served');
});

// STEP 8: API health endpoint
app.get('/api/health', async (req, res) => {
  console.log('🔍 PRODUCTION: API health check requested');
  
  try {
    // Check Redis connection
    let redisStatus = 'disconnected';
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.ping();
        redisStatus = 'connected';
      }
    } catch (error) {
      console.warn('⚠️ PRODUCTION: Redis ping failed:', error.message);
      redisStatus = 'disconnected';
    }
    
    // Check Stripe connection
    const stripeStatus = isStripeReady() ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: redisStatus,
      stripe: stripeStatus,
      environment: process.env.NODE_ENV || 'development',
      services: {
        express: 'running',
        redis: redisStatus,
        stripe: stripeStatus,
        server: 'listening'
      },
      rateLimit429: {
        global: rateLimitMetrics.global429,
        payment: rateLimitMetrics.payment429,
        session: rateLimitMetrics.session429,
      }
    });
    
    console.log('🔍 PRODUCTION: API health response sent');
  } catch (error) {
    console.error('❌ PRODUCTION: API health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// STEP 9: Initialize Redis (NON-BLOCKING)
console.log('🔧 PRODUCTION: Initializing Redis...');
let redisConnected = false;

try {
  const redis = await getRedis();
  if (redis) {
    console.log('✅ PRODUCTION: Redis connection established');
    redisConnected = true;
  } else {
    console.warn('⚠️ PRODUCTION: Redis not available - continuing without Redis');
  }
} catch (error) {
  console.warn('⚠️ PRODUCTION: Redis initialization failed (non-blocking):', error.message);
}

// STEP 9.5: Initialize Stripe Payment Gateway (NON-BLOCKING)
console.log('🔧 PRODUCTION: Initializing Stripe payment gateway...');
let stripeConnected = false;

try {
  const stripeResult = initStripe();
  if (stripeResult) {
    console.log('✅ PRODUCTION: Stripe payment gateway initialized');
    stripeConnected = true;
  } else {
    console.warn('⚠️ PRODUCTION: Stripe initialization failed (non-blocking)');
  }
} catch (error) {
  console.warn('⚠️ PRODUCTION: Stripe initialization failed (non-blocking):', error.message);
}

// STEP 9.6: Debug Stripe Configuration (NON-BLOCKING)
console.log('🔧 PRODUCTION: Debugging Stripe configuration...');
try {
  const stripeDebugResults = await debugStripeComprehensive();
  console.log('🔍 PRODUCTION: Stripe debugging completed');
} catch (error) {
  console.warn('⚠️ PRODUCTION: Stripe debugging failed (non-blocking):', error.message);
}

// STEP 9.5: Register critical message route BEFORE api-routes.js to prevent interception
console.log('🔧 PRODUCTION: Registering message route...');

app.post('/api/session/:sessionId/message', async (req, res) => {
  console.log('💬 PRODUCTION: Session message requested for:', req.params.sessionId);
  try {
    const userText = req.body.message || req.body.content || 'Hello';

    // Build lightweight conversation history from in-memory bucket for better replies
    global.__chatBuckets = global.__chatBuckets || new Map();
    const existing = global.__chatBuckets.get(req.params.sessionId) || [];
    const historyMessages = existing.map(m => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.content
    }));

    // Prefer Groq (fast, free); fallback to Ollama if Groq unavailable
    let aiText = null;
    const systemPrompt = 'You are a helpful AI assistant that chats with users to understand their needs. When users ask you to perform web tasks, acknowledge their request in a friendly way.';
    
    // Try Groq first (instant, free, 14k requests/day)
    if (process.env.GROQ_API_KEY) {
      try {
        const t0 = Date.now();
        console.log('🤖 AI: Calling Groq (llama-3.1-70b-versatile)');
        const groqMessages = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userText }
        ];
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-70b-versatile',
            messages: groqMessages,
            temperature: 0.7,
            max_tokens: 400
          })
        });
        if (groqResp.ok) {
          const groqData = await groqResp.json();
          aiText = groqData?.choices?.[0]?.message?.content?.trim() || null;
          console.log('🤖 AI: Groq responded in', (Date.now() - t0), 'ms');
        }
      } catch (e) {
        console.warn('⚠️  Groq call failed, will try Ollama:', e?.message);
      }
    }
    
    // Fallback to Ollama if Groq didn't respond
    if (!aiText && ollamaClient) {
      try {
        const t0 = Date.now();
        console.log('🤖 AI: Calling Ollama (model=', process.env.OLLAMA_MODEL || 'tinyllama:latest', ')');
        const ollamaMessages = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userText }
        ];
        const resp = await ollamaClient.chat({
          model: process.env.OLLAMA_MODEL || 'tinyllama:latest',
          messages: ollamaMessages,
          options: { temperature: 0.7, num_predict: 400, top_p: 0.9 }
        });
        aiText = resp?.message?.content?.trim() || null;
        console.log('🤖 AI: Ollama responded in', (Date.now() - t0), 'ms');
      } catch (e) {
        console.warn('⚠️  Ollama call failed:', e?.message);
      }
    }

    // Last resort fallback message
    if (!aiText) {
      console.warn('⚠️  All AI services unavailable, using fallback response');
      aiText = "I'm currently experiencing connectivity issues. Please try again in a moment.";
    }

    // Last resort fallback
    if (!aiText) {
      aiText = `I understand you said: "${userText}". I'm here to help, but I'm having trouble connecting to my AI service right now. Please try again in a moment.`;
    }

    // Store both user and AI messages in chat bucket with ALL required frontend fields
    const timestamp = new Date().toISOString();
    const newHistory = [
      { 
        id: `msg_${Date.now()}_user`,
        sessionId: req.params.sessionId,
        role: 'user', 
        content: userText, 
        timestamp: timestamp, 
        messageType: 'chat',
        inputMethod: 'typing',
        hasExecutableTask: null,
        taskDescription: null
      },
      { 
        id: `msg_${Date.now()}_agent`,
        sessionId: req.params.sessionId,
        role: 'agent', 
        content: aiText, 
        timestamp: timestamp, 
        messageType: 'chat',
        inputMethod: 'typing',
        hasExecutableTask: null,
        taskDescription: null
      }
    ];
    if (!global.__chatBuckets.has(req.params.sessionId)) {
      global.__chatBuckets.set(req.params.sessionId, []);
    }
    global.__chatBuckets.get(req.params.sessionId).push(...newHistory);
    console.log('💾 STORAGE: Stored messages for sessionId:', req.params.sessionId);
    console.log('💾 STORAGE: Total messages in bucket:', global.__chatBuckets.get(req.params.sessionId).length);

    res.json({
      success: true,
      userMessage: userText,
      agentMessage: aiText,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Session message processing failed:', error);
    res.status(500).json({
      error: 'Session message processing failed',
      details: error.message
    });
  }
});

console.log('✅ PRODUCTION: Message route registered');

// STEP 10: Initialize API routes (NON-BLOCKING)
console.log('🔧 PRODUCTION: Initializing API routes...');

try {
  // Use dynamic import for ES Module compatibility
  const routesModule = await import('./api-routes.js');
  const apiRoutes = routesModule.default || routesModule;
  app.use('/api', apiRoutes);
  console.log('✅ PRODUCTION: API routes initialized');
} catch (error) {
  console.warn('⚠️ PRODUCTION: API routes initialization failed (non-blocking):', error.message);
}

// STEP 10.5: API endpoints are now defined in api-routes.js
console.log('✅ PRODUCTION: API endpoints defined in api-routes.js');

// Create checkout session endpoint already exists in api-routes.js

// Checkout success endpoint - using existing stripe webhook endpoint


// FIXED: Session endpoints with proper expiry validation
app.get('/api/session/:sessionId', async (req, res) => {
  console.log('📋 PRODUCTION: Session status requested for:', req.params.sessionId);
  try {
    // Import database functions
    const { getUserSession, updateSessionStatus } = await import('./database.js');
    
    // Get real session from database
    const session = await getUserSession(req.params.sessionId);
    
    if (!session) {
      console.log('❌ PRODUCTION: Session not found:', req.params.sessionId);
      return res.status(404).json({
        sessionId: req.params.sessionId,
        status: 'not_found',
        message: 'Session not found or expired',
        timestamp: new Date().toISOString()
      });
    }
    
    // FIXED: Check if session is actually expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      console.log('❌ PRODUCTION: Session expired:', req.params.sessionId, 'expiresAt:', expiresAt);
      
      // Update session status to expired in database
      try {
        await updateSessionStatus(req.params.sessionId, 'expired');
        console.log('✅ PRODUCTION: Session status updated to expired');
      } catch (updateError) {
        console.warn('⚠️ PRODUCTION: Failed to update session status:', updateError.message);
      }
      
      return res.status(410).json({
        sessionId: req.params.sessionId,
        status: 'expired',
        message: 'Session has expired',
        expiresAt: session.expires_at,
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate time remaining in minutes
    const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)));
    
    console.log('✅ PRODUCTION: Session is active, time remaining:', timeRemaining, 'minutes');
    
    res.json({
      sessionId: req.params.sessionId,
      status: 'active',
      expiresAt: session.expires_at,
      timeRemaining: timeRemaining,
      paymentVerified: session.payment_verified,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Session lookup failed:', error);
    res.status(500).json({
      sessionId: req.params.sessionId,
      status: 'error',
      message: 'Session lookup failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// NOTE: Message route is now registered BEFORE api-routes.js (see line ~509) to prevent route interception

app.post('/api/session/:sessionId/execute', async (req, res) => {
  console.log('⚡ PRODUCTION: Session execute requested for:', req.params.sessionId);
  try {
    // Import and use the real unified AI agent
    const { LocalUnifiedAIAgent } = await import('./agents/local-unified-ai-agent.js');
    const agent = new LocalUnifiedAIAgent();
    await agent.initialize();
    
    const task = {
      id: `execute_${Date.now()}`,
      sessionId: req.params.sessionId,
      message: req.body.taskDescription || req.body.message || 'Execute task',
      context: req.body.context
    };
    
    const response = await agent.processMessage(task);
    
    res.json({
      success: response.success,
      sessionId: req.params.sessionId,
      task: response.message,
      actions: response.actions,
      screenshot: response.screenshot,
      confidence: response.confidence,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Task execution failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      task: 'Task execution failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Automation session endpoints (frontend expects these) - ACTIVATED REAL DATABASE STORAGE
app.post('/api/automation/create-session', async (req, res) => {
  console.log('🤖 PRODUCTION: Automation session creation requested');
  try {
    // Import database functions
    const { createUserSession } = await import('./database.js');
    
    const sessionId = 'automation_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store session in database
    const sessionData = {
      sessionId: sessionId,
      agentId: sessionId,
      expiresAt: expiresAt,
      status: 'active',
      paymentVerified: true,
      amountPaid: 1.00,
      customerEmail: req.body.email || null,
      stripeCustomerId: req.body.stripeCustomerId || null
    };
    
    const createdSession = await createUserSession(sessionData);
    
    res.json({
      success: true,
      sessionId: sessionId,
      automationUrl: `/automation/${sessionId}`,
      expiresAt: expiresAt.toISOString(),
      databaseId: createdSession.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation session creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Automation session creation failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/automation/:sessionId/status', async (req, res) => {
  console.log('📊 PRODUCTION: Automation status requested for:', req.params.sessionId);
  try {
    // Import database functions
    const { getUserSession } = await import('./database.js');
    
    // Get real session from database
    const session = await getUserSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({
        sessionId: req.params.sessionId,
        status: 'not_found',
        message: 'Automation session not found or expired',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      sessionId: req.params.sessionId,
      status: session.status,
      expiresAt: session.expires_at,
      paymentVerified: session.payment_verified,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation status lookup failed:', error);
    res.status(500).json({
      sessionId: req.params.sessionId,
      status: 'error',
      message: 'Automation status lookup failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/automation/:sessionId/execute', automationAuthMiddleware, executeLimiter, async (req, res) => {
  console.log('⚡ PRODUCTION: Automation execute requested for:', req.params.sessionId);
  try {
    const engine = await getAutomationEngine(req.params.sessionId);
    const command = req.body.command || req.body.taskDescription || req.body.message || 'open https://example.com';
    const result = await engine.executeCommand(command);

    res.json({
      success: true,
      sessionId: req.params.sessionId,
      task: command,
      action: result.action,
      url: result.url,
      title: result.title,
      selector: result.selector,
      screenshot: result.screenshot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation execution failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      task: 'Automation execution failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Take on-demand screenshot for the session's active browser
app.get('/api/automation/:sessionId/screenshot', automationAuthMiddleware, screenshotLimiter, async (req, res) => {
  console.log('📸 PRODUCTION: Automation screenshot requested for:', req.params.sessionId);
  try {
    const engine = activeAutomationEngines.get(req.params.sessionId) || await getAutomationEngine(req.params.sessionId);
    const result = await engine.takeScreenshot();
    res.json({
      success: true,
      sessionId: req.params.sessionId,
      screenshot: result.screenshot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Screenshot failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Screenshot failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Shutdown and clean up the session's browser engine
app.post('/api/automation/:sessionId/shutdown', async (req, res) => {
  console.log('🛑 PRODUCTION: Automation shutdown requested for:', req.params.sessionId);
  try {
    const ok = await shutdownAutomationEngine(req.params.sessionId);
    res.json({
      success: ok,
      sessionId: req.params.sessionId,
      status: ok ? 'closed' : 'not_found',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Shutdown failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Shutdown failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Live view toggle: start/stop VNC/WebSocket streaming using worker VNC manager
app.post('/api/automation/:sessionId/live-view/toggle', async (req, res) => {
  console.log('🎥 PRODUCTION: Live view toggle requested for:', req.params.sessionId);
  try {
    if (process.env.ENABLE_VNC_LIVE_VIEW !== 'true') {
      return res.status(501).json({
        success: false,
        sessionId: req.params.sessionId,
        message: 'Live view disabled. Set ENABLE_VNC_LIVE_VIEW=true to enable.',
        timestamp: new Date().toISOString()
      });
    }
    const enable = Boolean(req.body?.enable);

    // Initialize VNC-capable engine if available (compiled JS via esbuild)
    const { BrowserEngineWithVNC } = await import('../dist/worker/browser-engine-vnc.js');
    const vncEngine = new BrowserEngineWithVNC({}, { enableLiveView: true });
    await vncEngine.initialize();

    const sessionId = req.params.sessionId;
    const toggled = await vncEngine.toggleLiveView(sessionId, enable);
    const details = vncEngine.getLiveViewDetails(sessionId);

    res.json({
      success: toggled,
      sessionId,
      enable,
      liveView: details ? {
        webSocketURL: details.webSocketURL,
        isActive: details.isLiveViewActive,
        vncPort: details.vncSession?.vncPort,
        displayNumber: details.vncSession?.displayNumber
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Live view toggle failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Live view toggle failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== Chat history endpoints required by frontend =====
console.log('🛠️ PRODUCTION: Registering chat history routes');

app.get('/api/session/:agentId/messages', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { getUserSession } = await import('./database.js');
    const session = await getUserSession(agentId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (new Date() > new Date(session.expires_at)) {
      const { updateSessionStatus } = await import('./database.js');
      await updateSessionStatus(agentId, 'expired');
      return res.status(410).json({ error: 'LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed' });
    }
    global.__chatBuckets = global.__chatBuckets || new Map();
    if (!global.__chatBuckets.has(agentId)) global.__chatBuckets.set(agentId, []);
    const messages = global.__chatBuckets.get(agentId);
    console.log('📋 MESSAGES: Returning', messages.length, 'messages for agentId:', agentId);
    console.log('📋 MESSAGES: Available buckets:', Array.from(global.__chatBuckets.keys()));
    res.json(messages);
  } catch (e) {
    console.error('❌ PRODUCTION: messages endpoint failed:', e);
    res.status(500).json({ error: 'NEURAL_ARCHIVE_ACCESS_DENIED: ' + (e?.message || 'unknown') });
  }
});

app.get('/api/session/:agentId/chat-history', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { getUserSession } = await import('./database.js');
    const session = await getUserSession(agentId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (new Date() > new Date(session.expires_at)) {
      const { updateSessionStatus } = await import('./database.js');
      await updateSessionStatus(agentId, 'expired');
      return res.status(410).json({ error: 'LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed' });
    }
    global.__chatBuckets = global.__chatBuckets || new Map();
    const all = (global.__chatBuckets.get(agentId) || []).filter(m => m.messageType !== 'command');
    res.json(all);
  } catch (e) {
    console.error('❌ PRODUCTION: chat-history endpoint failed:', e);
    res.status(500).json({ error: 'CHAT_LOG_RETRIEVAL_FAILED: ' + (e?.message || 'unknown') });
  }
});

app.get('/api/session/:agentId/command-history', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { getUserSession } = await import('./database.js');
    const session = await getUserSession(agentId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (new Date() > new Date(session.expires_at)) {
      const { updateSessionStatus } = await import('./database.js');
      await updateSessionStatus(agentId, 'expired');
      return res.status(410).json({ error: 'LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed' });
    }
    global.__chatBuckets = global.__chatBuckets || new Map();
    const commands = (global.__chatBuckets.get(agentId) || []).filter(m => m.messageType === 'command');
    res.json(commands);
  } catch (e) {
    console.error('❌ PRODUCTION: command-history endpoint failed:', e);
    res.status(500).json({ error: 'COMMAND_LOG_RETRIEVAL_FAILED: ' + (e?.message || 'unknown') });
  }
});

// Issue per-session JWT for live view (WebSocket/VNC auth)
app.post('/api/automation/:sessionId/live-view/token', async (req, res) => {
  console.log('🔐 PRODUCTION: Live view token requested for:', req.params.sessionId);
  try {
    if (process.env.ENABLE_VNC_LIVE_VIEW !== 'true') {
      return res.status(501).json({
        error: 'Live view disabled. Set ENABLE_VNC_LIVE_VIEW=true to enable.',
        sessionId: req.params.sessionId
      });
    }
    const { getUserSession } = await import('./database.js');
    const session = await getUserSession(req.params.sessionId);
    if (!session || session.status !== 'active') {
      return res.status(404).json({
        error: 'Session not found or inactive',
        sessionId: req.params.sessionId
      });
    }

    const exp = Math.floor(new Date(session.expires_at).getTime() / 1000);
    const payload = {
      type: 'vnc_access',
      sessionId: req.params.sessionId,
      agentId: session.agent_id || session.agentId || req.params.sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp,
      iss: 'onedollaragent',
      aud: 'vnc-client'
    };

    const jwtModule = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'onedollaragent-dev-secret';
    const jwt = (jwtModule.default || jwtModule).sign(payload, secret);
    res.json({
      sessionId: req.params.sessionId,
      token: jwt,
      expiresAt: new Date(session.expires_at).toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Live view token generation failed:', error);
    res.status(500).json({
      error: 'Token generation failed',
      sessionId: req.params.sessionId,
      message: error.message
    });
  }
});

// Throttled screenshot endpoint per session (basic in-memory rate limiting)
const screenshotRate = new Map();
app.get('/api/automation/:sessionId/screenshot-throttled', async (req, res) => {
  const sessionId = req.params.sessionId;
  const now = Date.now();
  const last = screenshotRate.get(sessionId) || 0;
  // Allow one screenshot per 2 seconds
  if (now - last < 2000) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Screenshot rate limit exceeded',
      retryAfterMs: 2000 - (now - last)
    });
  }
  screenshotRate.set(sessionId, now);
  console.log('📸 PRODUCTION: Throttled screenshot requested for:', sessionId);
  try {
    const engine = activeAutomationEngines.get(sessionId) || await getAutomationEngine(sessionId);
    const result = await engine.takeScreenshot();
    res.json({
      success: true,
      sessionId,
      screenshot: result.screenshot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Throttled screenshot failed:', error);
    res.status(500).json({
      success: false,
      sessionId,
      message: 'Screenshot failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ PRODUCTION: Missing API endpoints added');

// STEP 7.5: REAL session management endpoints (available but not active)
console.log('🔧 PRODUCTION: REAL session management endpoints available but not active');
console.log('ℹ️ PRODUCTION: Real session endpoints can be enabled for production deployment');

// STEP 8: Initialize Database
console.log('🔧 PRODUCTION: Initializing database...');
try {
  const db = initializeDatabase();
  if (db) {
    await createTables();
    console.log('✅ PRODUCTION: Database initialized and tables created');
  } else {
    console.log('⚠️ PRODUCTION: Database not available - using mock storage');
  }
} catch (error) {
  console.warn('⚠️ PRODUCTION: Database initialization failed (non-blocking):', error.message);
}

// STEP 9: REAL session management (available but not initialized to avoid startup errors)
console.log('🔧 PRODUCTION: REAL session management available but not initialized');
console.log('ℹ️ PRODUCTION: Real implementations can be enabled for production deployment');
let realSessionManager = null;

// STEP 10: Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ PRODUCTION: Express error:', err);
  res.status(500).json({
    status: 'error',
    timestamp: new Date().toISOString(),
    error: err.message
  });
});

// STEP 12: Catch-all handler for React Router (SPA routing)
app.get('*', (req, res) => {
  console.log('🔄 PRODUCTION: SPA route requested:', req.originalUrl);
  // Serve React app for all non-API routes
  if (!req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/health')) {
    res.sendFile(path.join(staticPath, 'index.html'));
    console.log('🔄 PRODUCTION: SPA route served');
  } else {
    // API routes that don't exist
    console.log('❓ PRODUCTION: API route not found:', req.method, req.originalUrl);
    res.status(404).json({
      status: 'not_found',
      timestamp: new Date().toISOString(),
      message: 'API route not found',
      path: req.originalUrl
    });
  }
});

// STEP 13: Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO for realtime automation events (not VNC)
try {
  const ioOptions = { path: '/ws/socket.io/' };
  const realtime = new RealTimeAutomationSocket(server, ioOptions);
  // Optional: basic join/leave handlers via simple events
  // These are implemented inside RealTimeAutomationSocket using this.io
  console.log('🔗 Realtime (Socket.IO) initialized at path /ws/socket.io/');
} catch (e) {
  console.warn('⚠️  Realtime (Socket.IO) initialization failed:', e?.message);
}

// STEP 14: Server listening (proven pattern)
server.listen(port, host, () => {
  console.log('🌐 PRODUCTION: Server listening on port', port);
  console.log('🌐 PRODUCTION: Server listening on host', host);
  console.log('🌐 PRODUCTION: Server ready for Railway health checks');
  console.log('🌐 PRODUCTION: Health endpoint: http://localhost:' + port + '/health');
  console.log('🌐 PRODUCTION: Root endpoint: http://localhost:' + port + '/');
  console.log('🌐 PRODUCTION: API health endpoint: http://localhost:' + port + '/api/health');
  console.log('✅ PRODUCTION: Server started successfully');
  console.log('✅ PRODUCTION: Redis status:', redisConnected ? 'connected' : 'disconnected');
});

// STEP 15: Handle server errors
server.on('error', (error) => {
  console.error('❌ PRODUCTION: Server error:', error);
  process.exit(1);
});

// STEP 16: Handle process termination (proven pattern)
process.on('SIGTERM', () => {
  console.log('🔄 PRODUCTION: SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ PRODUCTION: Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 PRODUCTION: SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ PRODUCTION: Server closed');
    process.exit(0);
  });
});

console.log('🚀 PRODUCTION: Application setup complete');
// Optional auth middleware for automation routes (gated by env)
const requireAutomationAuth = process.env.REQUIRE_AUTH_FOR_AUTOMATION === 'true';
function automationAuthMiddleware(req, res, next) {
  if (!requireAutomationAuth) return next();
  (async () => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ')
        ? auth.slice(7)
        : null;
      if (!token) {
        return res.status(401).json({ error: 'Missing Bearer token' });
      }
      const jwtModule = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || process.env.SECRET_KEY || 'onedollaragent-dev-secret';
      const decoded = (jwtModule.default || jwtModule).verify(token, secret);
      if (!decoded || decoded.sessionId !== req.params.sessionId) {
        return res.status(403).json({ error: 'Invalid token sessionId' });
      }
      if (!['vnc_access', 'automation_access'].includes(decoded.type)) {
        return res.status(403).json({ error: 'Invalid token type' });
      }
      req.sessionAuth = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token validation failed', message: err.message });
    }
  })();
}

// Per-session rate limiters (zero-dependency, fixed window)
const makeSessionLimiter = (windowMs, max, message = 'Too many requests') => {
  const buckets = new Map(); // key -> { start, count, timer }
  return (req, res, next) => {
    try {
      const key = `${req.params.sessionId || 'global'}:${req.ip}`;
      const now = Date.now();
      let info = buckets.get(key);
      if (!info || (now - info.start) > windowMs) {
        if (info && info.timer) clearTimeout(info.timer);
        info = { start: now, count: 0, timer: null };
        info.timer = setTimeout(() => buckets.delete(key), windowMs);
        buckets.set(key, info);
      }
      info.count += 1;
      if (info.count > max) {
        return res.status(429).json({ error: message });
      }
      next();
    } catch (e) {
      // Fail open to avoid blocking if something goes wrong
      next();
    }
  };
};

// STEP 17: Environment-driven rate limits (tunable without code changes)
const MESSAGE_LIMIT_WINDOW = parseInt(process.env.MESSAGE_LIMIT_WINDOW_MS || '60000', 10);
const MESSAGE_LIMIT_MAX = parseInt(process.env.MESSAGE_LIMIT_MAX || '60', 10);
const EXECUTE_LIMIT_WINDOW = parseInt(process.env.EXECUTE_LIMIT_WINDOW_MS || '60000', 10);
const EXECUTE_LIMIT_MAX = parseInt(process.env.EXECUTE_LIMIT_MAX || '30', 10);
const SCREENSHOT_LIMIT_WINDOW = parseInt(process.env.SCREENSHOT_LIMIT_WINDOW_MS || '10000', 10);
const SCREENSHOT_LIMIT_MAX = parseInt(process.env.SCREENSHOT_LIMIT_MAX || '5', 10);

// Optional Redis-backed session limiter per route with fail-open
function createRedisSessionLimiter(windowMs, max, metricKey) {
  let redisClientPromise;
  const getClient = async () => {
    if (!redisClientPromise) {
      redisClientPromise = getRedis().catch(() => null);
    }
    return redisClientPromise;
  };
  return async (req, res, next) => {
    try {
      const redis = await getClient();
      if (!redis) return next();
      const { sessionId } = req.params || {};
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      const key = `rl:session:${sessionId || 'unknown'}:${metricKey}:${ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, Math.ceil(windowMs / 1000));
      const ttlSeconds = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      if (ttlSeconds && ttlSeconds > 0) res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + ttlSeconds));
      if (count > max) {
        if (ttlSeconds && ttlSeconds > 0) res.setHeader('Retry-After', String(ttlSeconds));
        if (metricKey === 'message') rateLimitMetrics.session429.message++;
        else if (metricKey === 'execute') rateLimitMetrics.session429.execute++;
        else if (metricKey === 'screenshot') rateLimitMetrics.session429.screenshot++;
        return res.status(429).json({
          error: 'SESSION_RATE_LIMIT_EXCEEDED',
          route: metricKey,
          limit: max,
          windowMs,
          retryAfterSeconds: ttlSeconds || Math.ceil(windowMs / 1000),
        });
      }
      return next();
    } catch (_) {
      return next();
    }
  };
}

const USE_REDIS_SESSION_LIMITER = process.env.USE_REDIS_SESSION_LIMITER === 'true';
messageLimiter = USE_REDIS_SESSION_LIMITER
  ? createRedisSessionLimiter(MESSAGE_LIMIT_WINDOW, MESSAGE_LIMIT_MAX, 'message')
  : makeSessionLimiter(MESSAGE_LIMIT_WINDOW, MESSAGE_LIMIT_MAX, 'Too many messages per minute');
executeLimiter = USE_REDIS_SESSION_LIMITER
  ? createRedisSessionLimiter(EXECUTE_LIMIT_WINDOW, EXECUTE_LIMIT_MAX, 'execute')
  : makeSessionLimiter(EXECUTE_LIMIT_WINDOW, EXECUTE_LIMIT_MAX, 'Too many automation executes per minute');
screenshotLimiter = USE_REDIS_SESSION_LIMITER
  ? createRedisSessionLimiter(SCREENSHOT_LIMIT_WINDOW, SCREENSHOT_LIMIT_MAX, 'screenshot')
  : makeSessionLimiter(SCREENSHOT_LIMIT_WINDOW, SCREENSHOT_LIMIT_MAX, 'Too many screenshots');
// Detailed health endpoint
app.get('/api/health/details', async (req, res) => {
  try {
    let redisStatus = 'disconnected';
    let redisLatencyMs = null;
    try {
      const start = Date.now();
      const redis = await getRedis();
      if (redis) {
        await redis.ping();
        redisStatus = 'connected';
        redisLatencyMs = Date.now() - start;
      }
    } catch (e) {
      redisStatus = 'disconnected';
    }

    let dbStatus = 'disconnected';
    let dbTimeMs = null;
    try {
      const pool = getDatabase();
      if (pool) {
        const start = Date.now();
        const r = await pool.query('SELECT 1');
        if (r && r.rowCount >= 0) {
          dbStatus = 'connected';
          dbTimeMs = Date.now() - start;
        }
      }
    } catch (e) {
      dbStatus = 'disconnected';
    }

    const stripeStatus = isStripeReady() ? 'connected' : 'disconnected';

    res.status(200).json({
      status: (redisStatus === 'connected' && dbStatus === 'connected') ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      redis: { status: redisStatus, latencyMs: redisLatencyMs },
      db: { status: dbStatus, queryTimeMs: dbTimeMs },
      stripe: { status: stripeStatus },
      environment: process.env.NODE_ENV || 'development',
      port: port
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});
