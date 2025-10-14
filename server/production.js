/**
 * PRODUCTION ENTRY POINT - Railway Deployment
 * 
 * This combines the working patterns from test-server.js with the actual application.
 * Follows the exact successful configuration that passed Railway health checks.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
// Socket.IO realtime automation (events only; not used for VNC streaming)
import { RealTimeAutomationSocket } from './websocket/real-time-automation.js';
import { Server as SocketIOServer } from 'socket.io';
import { LiveStreamRelay } from './live-stream-relay.js';
// WebSocketManager removed - using Socket.IO only for now
import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import httpProxy from 'http-proxy';
import { fileURLToPath } from 'url';
import { getRedis, isRedisAvailable, waitForRedis } from './redis-simple.js';
import { debugStripeComprehensive } from './stripe-debug.js';
import { initStripe, isStripeReady } from './stripe-simple.js';
import { initializeDatabase, createTables, getDatabase } from './database.js';
import FreeAIService from '../services/FreeAIService.js';
import { initQueue, queueBrowserTask, isQueueAvailable } from './queue-simple.js';
import { getBrowserSession, createBrowserSession } from './browser-automation.js';

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

// Initialize Socket.IO for real-time communication
const { Server } = require('socket.io');

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
      // Allow embedding the worker's noVNC viewer (served from its own domain)
      // Broadly allow HTTPS frames to avoid whitelisting per-deploy worker hostnames
      frameSrc: ["'self'", 'https:', 'https://checkout.stripe.com', 'https://js.stripe.com'],
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

// In-browser automation: Active sessions tracking
const activeAutomationSessions = new Map();

function startAutomationSession(sessionId) {
  activeAutomationSessions.set(sessionId, {
    sessionId,
    startTime: new Date(),
    status: 'active'
  });
  console.log(`🤖 Automation session started: ${sessionId}`);
}

function stopAutomationSession(sessionId) {
  const session = activeAutomationSessions.get(sessionId);
  if (session) {
    session.status = 'stopped';
    session.endTime = new Date();
    activeAutomationSessions.delete(sessionId);
    console.log(`🛑 Automation session stopped: ${sessionId}`);
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

// FAST PATH: CSRF token endpoint (must never block; no session requirement here)
app.get('/api/csrf-token', (req, res) => {
  try {
    res.status(200).json({
      csrfToken: 'token-' + Date.now(),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(200).json({ csrfToken: 'token-fallback' });
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

// STEP 9: Initialize Redis (TRULY NON-BLOCKING - after server starts)
console.log('🔧 PRODUCTION: Scheduling Redis initialization...');
let redisConnected = false;
let queueInitialized = false;
setTimeout(async () => {
try {
  const redis = await getRedis();
  if (redis) {
    console.log('✅ PRODUCTION: Redis connection established');
    redisConnected = true;
      
      // CRITICAL FIX: Use EXTERNAL Redis URL for task queue to avoid DNS issues
      // Railway's internal DNS (redis.railway.internal) doesn't always resolve
      let redisUrl = process.env.REDIS_PUBLIC_URL || 
                     process.env.REDIS_EXTERNAL_URL ||
                     process.env.REDIS_URL;
      
      // Skip if URL still contains internal hostname
      if (redisUrl && redisUrl.includes('redis.railway.internal')) {
        console.warn('⚠️  PRODUCTION: Redis URL contains internal hostname - skipping queue init');
        console.warn('   Set REDIS_PUBLIC_URL or REDIS_EXTERNAL_URL to enable task queue');
        redisUrl = null;
      }
      
      if (redisUrl) {
        console.log(`🔌 PRODUCTION: Initializing queue with URL: ${redisUrl.substring(0, 30)}...`);
        queueInitialized = await initQueue(redisUrl);
        if (queueInitialized) {
          console.log('✅ PRODUCTION: Browser automation queue initialized');
        } else {
          console.warn('⚠️  PRODUCTION: Queue initialization failed - will use HTTP fallback');
        }
      }
  } else {
    console.warn('⚠️ PRODUCTION: Redis not available - continuing without Redis');
  }
} catch (error) {
  console.warn('⚠️ PRODUCTION: Redis initialization failed (non-blocking):', error.message);
}
}, 0);

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

    // Groq is the BRAIN - it analyzes requests and generates commands
    let aiText = null;
    let browserCommand = null;
    
    const systemPrompt = `You are an AI orchestrator that generates commands for a browser automation system. When users request web tasks, you IMMEDIATELY generate a <COMMAND> tag with JSON instructions.

YOUR JOB:
1. Detect when users want browser automation (navigate, search, click, type, screenshot, etc.)
2. IMMEDIATELY output a <COMMAND> tag with JSON - don't ask for confirmation
3. Also provide a friendly message explaining what you're doing

COMMAND FORMAT:
<COMMAND>{"action": "navigate|search|click|type|screenshot", "target": "url or query", "description": "brief description"}</COMMAND>

EXAMPLES:

User: "go to google"
You: "I'll navigate to Google for you now. <COMMAND>{"action": "navigate", "target": "https://google.com", "description": "Opening Google homepage"}</COMMAND>"

User: "search for iPhone 15"
You: "I'll search Google for iPhone 15. <COMMAND>{"action": "search", "target": "iPhone 15", "description": "Searching for iPhone 15"}</COMMAND>"

User: "navigate to youtube"
You: "Opening YouTube for you. <COMMAND>{"action": "navigate", "target": "https://youtube.com", "description": "Navigating to YouTube"}</COMMAND>"

User: "hello"
You: "Hello! I can help you browse the web. Just tell me what you'd like to do - navigate to sites, search for things, or interact with pages."

User: "what's the weather?"
You: "I'll check the weather for you. <COMMAND>{"action": "search", "target": "weather today", "description": "Searching for current weather"}</COMMAND>"

CRITICAL RULES:
- ALWAYS output <COMMAND> tags for browser tasks - don't wait for confirmation
- Put the <COMMAND> tag at the END of your response
- If it's NOT a browser task (like "hello"), just chat normally
- The worker agent will execute the command and stream live video to the user`;
    
    // Try Groq first (instant, free, 14k requests/day)
    if (process.env.GROQ_API_KEY) {
      try {
        const t0 = Date.now();
        console.log('🤖 AI: Calling Groq (llama-3.3-70b-versatile) - Agent Brain');
        const groqMessages = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userText }
        ];
        
        // Create a timeout promise (30 seconds - increased for reliability)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Groq timeout after 30s')), 30000)
        );
        
        // Race between fetch and timeout
        const groqResp = await Promise.race([
          fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: groqMessages,
              temperature: 0.7,
              max_tokens: 500
            })
          }),
          timeoutPromise
        ]);
        
        if (groqResp.ok) {
          const groqData = await groqResp.json();
          const fullResponse = groqData?.choices?.[0]?.message?.content?.trim() || null;
          console.log('✅ AI: Groq responded in', (Date.now() - t0), 'ms');
          
          // Extract browser command if present
          const commandMatch = fullResponse?.match(/<COMMAND>(.*?)<\/COMMAND>/);
          if (commandMatch) {
            try {
              browserCommand = JSON.parse(commandMatch[1]);
              console.log('🎯 Browser command extracted:', browserCommand);
              // Remove command tags from user-facing message
              aiText = fullResponse.replace(/<COMMAND>.*?<\/COMMAND>/, '').trim();
            } catch (parseError) {
              console.warn('⚠️  Failed to parse browser command:', parseError.message);
              aiText = fullResponse;
            }
          } else {
            aiText = fullResponse;
          }
        } else {
          // Log the actual error from Groq
          const errorBody = await groqResp.text();
          console.error('❌ Groq API error:', groqResp.status, groqResp.statusText, '-', errorBody);
        }
      } catch (e) {
        console.error('❌ Groq call failed:', e?.message);
      }
    }
    
    // Skip Ollama entirely - it's too slow on Railway CPU
    // Fallback directly to generic response if Groq fails

    // Last resort fallback message
    if (!aiText) {
      console.warn('⚠️  Groq unavailable, using fallback response');
      aiText = `I understand you said: "${userText}". I'm here to help! (Groq API temporarily unavailable)`;
    }

    // IN-BROWSER AUTOMATION: Send command directly to user's browser via Socket.IO
    let taskId = null;
    const hasBrowserCommand = !!browserCommand;

    if (hasBrowserCommand && browserCommand) {
      console.log('🎯 Browser command from Groq:', browserCommand);

      try {
        // Send command directly to user's browser via Socket.IO
        const io = require('socket.io')(server);
        io.emit('automation:command', { 
          sessionId: req.params.sessionId, 
          ...browserCommand 
        });
        
        taskId = `automation-${Date.now()}`;
        console.log(`✅ Automation command sent to user browser: ${taskId}`);
      } catch (error) {
        console.warn('⚠️  Failed to send automation command:', error?.message || error);
      }
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
        hasExecutableTask: hasBrowserCommand,
        taskDescription: hasBrowserCommand ? 'Browser automation task' : null
      },
      { 
        id: `msg_${Date.now()}_agent`,
        sessionId: req.params.sessionId,
        role: 'agent', 
        content: aiText, 
        timestamp: timestamp, 
        messageType: 'chat',
        inputMethod: 'typing',
        hasExecutableTask: hasBrowserCommand,
        taskDescription: hasBrowserCommand ? 'Browser automation task' : null
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
      hasExecutableTask: hasBrowserCommand,
      taskDescription: hasBrowserCommand ? 'Browser automation task' : null,
      taskId: taskId,
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

// STEP 10.6: Add LLM proxy routes for secure API key handling
try {
  const llmProxyModule = await import('./api/llm/proxy.js');
  const llmProxyRoutes = llmProxyModule.default || llmProxyModule;
  app.use('/api/llm', llmProxyRoutes);
  console.log('✅ PRODUCTION: LLM proxy routes initialized');
} catch (error) {
  console.warn('⚠️ PRODUCTION: LLM proxy routes initialization failed (non-blocking):', error.message);
}

// Create checkout session endpoint already exists in api-routes.js

// Checkout success endpoint - using existing stripe webhook endpoint


// CRITICAL FIX: Session status endpoint for race condition fix
app.get('/api/session-status', async (req, res) => {
  const { session } = req.query;
  
  console.log('🔍 Checking session status:', session);
  
  if (!session) {
    return res.status(400).json({ 
      error: 'Session ID required',
      status: 'error'
    });
  }
  
  try {
    // Check Redis for session data
    const redis = await getRedis();
    if (!redis) {
      return res.status(500).json({
        error: 'Redis not available',
        status: 'error'
      });
    }
    
    const sessionData = await redis.hgetall(`session:${session}`);
    
    console.log('📊 Session data from Redis:', sessionData);
    
    if (!sessionData || Object.keys(sessionData).length === 0) {
      return res.json({
        status: 'not_found',
        ready: false,
        message: 'Session not found in Redis'
      });
    }
    
    // Check if worker has marked browser as ready
    const isReady = sessionData.status === 'active' && 
                    sessionData.browser_ready === 'true';
    
    return res.json({
      status: sessionData.status || 'unknown',
      ready: isReady,
      browserReady: sessionData.browser_ready === 'true',
      workerReady: sessionData.worker_ready === 'true',
      timestamp: new Date().toISOString(),
      debug: sessionData // Include full data for debugging
    });
    
  } catch (error) {
    console.error('❌ Error checking session status:', error);
    return res.status(500).json({
      error: 'Failed to check session status',
      message: error.message
    });
  }
});

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
    
    // CRITICAL FIX: Generate JWT token for WebSocket authentication
    const jwt = require('jsonwebtoken');
    const tokenExpiration = Math.floor((expiresAt.getTime()) / 1000);
    const jwtPayload = {
      agentId: req.params.sessionId,
      sessionId: req.params.sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: tokenExpiration,
      iss: 'phoenix-agent-system',
      aud: 'websocket-client'
    };
    
           const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET || 'dev-secret-key-replace-in-production');
    console.log('🔐 PRODUCTION: JWT token generated for WebSocket authentication');
    
    res.json({
      sessionId: req.params.sessionId,
      agentId: req.params.sessionId, // agentId is same as sessionId
      status: 'active',
      isActive: true,
      expiresAt: session.expires_at,
      timeRemaining: timeRemaining,
      paymentVerified: session.payment_verified,
      token: jwtToken, // CRITICAL: Include JWT token for WebSocket authentication
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
    // Route directly to worker with real AI frameworks
    const workerUrls = [
      'https://worker-production-6480.up.railway.app',
      'http://worker.railway.internal:8080'
    ];
    
    let workerResponse = null;
    let lastError = null;
    
    for (const workerUrl of workerUrls) {
      try {
        console.log(`🔄 Task: Trying worker URL: ${workerUrl}`);
        workerResponse = await fetch(`${workerUrl}/task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: req.body.taskDescription || req.body.message || 'Execute task',
      sessionId: req.params.sessionId,
            agentId: req.params.sessionId
          }),
          signal: AbortSignal.timeout(8000)
        });
        
        if (workerResponse.ok) {
          console.log(`✅ Task: Worker ${workerUrl} responded successfully`);
          break;
        } else {
          console.warn(`⚠️ Task: Worker ${workerUrl} returned ${workerResponse.status}`);
        }
      } catch (error) {
        console.warn(`⚠️ Task: Failed to connect to ${workerUrl}: ${error.message}`);
        lastError = error;
        continue;
      }
    }
    
    if (!workerResponse || !workerResponse.ok) {
      throw new Error(`All workers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    const result = await workerResponse.json();
    
    res.json({
      success: result.success,
      sessionId: req.params.sessionId,
      task: result.data,
      actions: result.actionsExecuted || 0,
      screenshot: result.screenshot,
      agentType: result.agentType || 'worker',
      executionTime: result.executionTime || 0,
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
    const { getRedis } = await import('./redis-simple.js');
    
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
    
    // CRITICAL FIX: Get JWT token from Redis
    let websocketToken = null;
    try {
      const redis = await getRedis();
      if (redis) {
        const sessionData = await redis.hgetall(`session:${req.params.sessionId}`);
        websocketToken = sessionData.websocket_token;
        console.log('🔐 PRODUCTION: JWT token retrieved from Redis:', !!websocketToken);
      }
    } catch (redisError) {
      console.warn('⚠️ PRODUCTION: Failed to get JWT token from Redis:', redisError.message);
    }
    
    res.json({
      sessionId: req.params.sessionId,
      status: session.status,
      expiresAt: session.expires_at,
      paymentVerified: session.payment_verified,
      websocketToken: websocketToken, // ⚠️ CRITICAL: Add JWT token!
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

// Helper function to get or create automation engine
async function getAutomationEngine(sessionId) {
  let engine = getBrowserSession(sessionId);
  if (!engine) {
    engine = createBrowserSession(sessionId);
    await engine.initialize();
  }
  return engine;
}

app.post('/api/automation/:sessionId/execute', automationAuthMiddleware, executeLimiter, async (req, res) => {
  console.log('⚡ PRODUCTION: Automation execute requested for:', req.params.sessionId);
  try {
    const engine = await getAutomationEngine(req.params.sessionId);
    const command = req.body.command || req.body.taskDescription || req.body.message || 'open https://example.com';
    const result = await engine.executeTask(command);

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

// In-browser automation: request screenshot from user's browser
app.get('/api/automation/:sessionId/screenshot', async (req, res) => {
  console.log('📸 PRODUCTION: Automation screenshot requested for:', req.params.sessionId);
  try {
    const sessionId = req.params.sessionId;
    
    // Send screenshot request to user's browser via Socket.IO
    const io = require('socket.io')(server);
    io.emit('automation:command', { 
      sessionId,
      action: 'screenshot',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      sessionId: sessionId,
      message: 'Screenshot request sent to user browser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Screenshot request failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Screenshot request failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// In-browser automation: stop automation session
app.post('/api/automation/:sessionId/shutdown', async (req, res) => {
  console.log('🛑 PRODUCTION: Automation shutdown requested for:', req.params.sessionId);
  try {
    const sessionId = req.params.sessionId;
    
    // Stop automation session
    const stopped = stopAutomationSession(sessionId);
    
    // Send stop command to user's browser via Socket.IO
    const io = require('socket.io')(server);
    io.emit('automation:stop', { sessionId });
    
    res.json({
      success: stopped,
      sessionId: sessionId,
      status: stopped ? 'stopped' : 'not_found',
      message: stopped ? 'Automation stopped - AI agents no longer controlling browser' : 'Session not found',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation shutdown failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Automation shutdown failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// In-browser automation: start/stop automation session
app.post('/api/automation/:sessionId/start', async (req, res) => {
  console.log('🤖 PRODUCTION: Automation start requested for:', req.params.sessionId);
  try {
    const sessionId = req.params.sessionId;
    
    // Start automation session
    startAutomationSession(sessionId);
    
    // Emit automation start event via Socket.IO
    const io = require('socket.io')(server);
    io.emit('automation:start', { sessionId });
    
    res.json({
      success: true,
      sessionId,
      message: 'Automation started - AI agents will now control your browser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation start failed:', error);
    res.status(500).json({
        success: false,
        sessionId: req.params.sessionId,
      message: 'Automation start failed',
      error: error.message,
        timestamp: new Date().toISOString()
      });
    }
});

app.post('/api/automation/:sessionId/stop', async (req, res) => {
  console.log('🛑 PRODUCTION: Automation stop requested for:', req.params.sessionId);
  try {
    const sessionId = req.params.sessionId;
    
    // Stop automation session
    stopAutomationSession(sessionId);
    
    // Emit automation stop event via Socket.IO
    const io = require('socket.io')(server);
    io.emit('automation:stop', { sessionId });

    res.json({
      success: true,
      sessionId,
      message: 'Automation stopped - AI agents no longer controlling browser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation stop failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Automation stop failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== Chat history endpoints required by frontend =====
console.log('🛠️ PRODUCTION: Registering chat history routes');

app.get('/api/session/:sessionId/messages', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { getUserSession } = await import('./database.js');
    const session = await getUserSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (new Date() > new Date(session.expires_at)) {
      const { updateSessionStatus } = await import('./database.js');
      await updateSessionStatus(sessionId, 'expired');
      return res.status(410).json({ error: 'LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed' });
    }
    global.__chatBuckets = global.__chatBuckets || new Map();
    if (!global.__chatBuckets.has(sessionId)) global.__chatBuckets.set(sessionId, []);
    const messages = global.__chatBuckets.get(sessionId);
    console.log('📋 MESSAGES: Returning', messages.length, 'messages for sessionId:', sessionId);
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

// Get task status from worker
app.get('/api/task/:taskId', async (req, res) => {
  console.log('📊 PRODUCTION: Task status requested for:', req.params.taskId);
  try {
    const workerUrl = process.env.WORKER_INTERNAL_URL || 'http://worker.railway.internal:3001';
    
    const workerResponse = await fetch(`${workerUrl}/task/${req.params.taskId}`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!workerResponse.ok) {
      return res.status(workerResponse.status).json({ error: 'Task not found or worker unavailable' });
    }
    
    const taskData = await workerResponse.json();
    res.json(taskData);
  } catch (error) {
    console.error('❌ PRODUCTION: Failed to get task status:', error);
    res.status(503).json({ error: 'Worker service unavailable', message: error.message });
  }
});

// In-browser automation: send command to user's browser
app.post('/api/automation/:sessionId/command', async (req, res) => {
  console.log('🎯 PRODUCTION: Automation command requested for:', req.params.sessionId);
  try {
    const sessionId = req.params.sessionId;
    const command = req.body;
    
    // Emit automation command via Socket.IO to user's browser
    const io = require('socket.io')(server);
    io.emit('automation:command', { sessionId, ...command });
    
    res.json({
      success: true,
      sessionId,
      command,
      message: 'Command sent to user browser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Automation command failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.sessionId,
      message: 'Automation command failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// In-browser automation: throttled screenshot endpoint
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
    // Send screenshot request to user's browser via Socket.IO
    const io = require('socket.io')(server);
    io.emit('automation:command', { 
      sessionId,
      action: 'screenshot',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      sessionId,
      message: 'Screenshot request sent to user browser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Throttled screenshot failed:', error);
    res.status(500).json({
      success: false,
      sessionId,
      message: 'Screenshot request failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ PRODUCTION: Missing API endpoints added');

// STEP 7.5: REAL session management endpoints (ENABLED FOR PRODUCTION)
console.log('🔧 PRODUCTION: REAL session management endpoints ENABLED');
console.log('✅ PRODUCTION: Real session endpoints are ACTIVE for production deployment');

// STEP 8: Initialize REAL Database (NO MOCK FALLBACKS)
console.log('🔧 PRODUCTION: Initializing REAL PostgreSQL database...');
setTimeout(async () => {
try {
  const db = await initializeDatabase();
  if (db && db.connected) {
    console.log('✅ PRODUCTION: Database connected, creating tables...');
    const tablesCreated = await createTables();
    if (tablesCreated) {
      console.log('✅ PRODUCTION: REAL PostgreSQL database initialized and tables created');
  } else {
      console.error('❌ PRODUCTION: Table creation failed');
      process.exit(1);
    }
  } else {
    console.error('❌ PRODUCTION: REAL Database initialization failed - NO MOCK FALLBACKS ALLOWED');
    console.error('Database error:', db?.error);
    process.exit(1); // Exit if database fails - no mock fallbacks
  }
} catch (error) {
  console.error('❌ PRODUCTION: REAL Database initialization failed:', error);
  process.exit(1); // Exit if database fails - no mock fallbacks
}
}, 1000);

// STEP 9: REAL session management (INITIALIZED FOR PRODUCTION)
console.log('🔧 PRODUCTION: REAL session management INITIALIZING...');
console.log('✅ PRODUCTION: Real implementations are ENABLED for production deployment');

// Initialize real session management
let realSessionManager = null;
try {
  // Import and initialize real session manager (JavaScript version)
  const { RealSessionManager } = await import('./session/real-session-manager.js');
  realSessionManager = new RealSessionManager();
  await realSessionManager.initialize();
  console.log('✅ PRODUCTION: Real session management initialized successfully');
  
  // Make session manager globally available
  global.realSessionManager = realSessionManager;
} catch (error) {
  console.error('❌ PRODUCTION: Real session management initialization failed:', error);
  console.log('⚠️ PRODUCTION: Continuing with basic session handling');
  // Don't exit - continue with basic session handling
}

// STEP 10: Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ PRODUCTION: Express error:', err);
  res.status(500).json({
    status: 'error',
    timestamp: new Date().toISOString(),
    error: err.message
  });
});

// IMPORTANT: Define API routes BEFORE SPA catch-all so they don't 404
// VNC CODE REMOVED - Using in-browser automation instead

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

// CRITICAL MISSING ENDPOINTS - ADDING THEM NOW
// Session message endpoint (for chat)
app.post('/api/session/:agentId/message', async (req, res) => {
  console.log('💬 PRODUCTION: Session message requested for:', req.params.agentId);
  try {
    const { agentId } = req.params;
    const { content, csrfToken } = req.body;
    
    // Validate session exists
    const { getUserSession } = await import('./database.js');
    const session = await getUserSession(agentId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (new Date() > new Date(session.expires_at)) {
      return res.status(410).json({ error: 'LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed' });
    }
    
    // Store message in chat bucket
    global.__chatBuckets = global.__chatBuckets || new Map();
    const messages = global.__chatBuckets.get(agentId) || [];
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content,
      timestamp: new Date().toISOString(),
      messageType: 'message'
    };
    messages.push(userMessage);
    global.__chatBuckets.set(agentId, messages);
    
    // Generate AI response using Groq
    const aiResponse = await ai.generateResponse(content, messages.slice(-10)); // Last 10 messages for context
    
    const agentMessage = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      content: aiResponse.message,
      timestamp: new Date().toISOString(),
      messageType: 'message',
      hasExecutableTask: aiResponse.hasExecutableTask,
      taskDescription: aiResponse.taskDescription
    };
    messages.push(agentMessage);
    global.__chatBuckets.set(agentId, messages);
    
    res.json({
      success: true,
      agentMessage: aiResponse.message,
      hasExecutableTask: aiResponse.hasExecutableTask,
      taskDescription: aiResponse.taskDescription,
      taskId: aiResponse.hasExecutableTask ? `task-${Date.now()}` : null
    });
    
  } catch (error) {
    console.error('❌ PRODUCTION: Session message failed:', error);
    res.status(500).json({
      success: false,
      error: 'Message processing failed',
      message: error.message
    });
  }
});

// Session execute endpoint (for task execution)
app.post('/api/session/:agentId/execute', async (req, res) => {
  console.log('⚡ PRODUCTION: Session execute requested for:', req.params.agentId);
  try {
    const sessionId = req.params.agentId;
    const taskDescription = req.body.taskDescription || req.body.message || 'Execute task';
    
    // Send automation command directly to user's browser via Socket.IO
    const io = require('socket.io')(server);
    io.emit('automation:command', { 
      sessionId,
      action: 'execute',
      task: taskDescription,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Automation command sent to user browser for session: ${sessionId}`);
    
    res.json({
      success: true,
      sessionId: sessionId,
      task: taskDescription,
      actions: 1,
      screenshot: null, // Will be taken by user's browser
      agentType: 'in-browser-automation',
      executionTime: 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ PRODUCTION: Task execution failed:', error);
    res.status(500).json({
      success: false,
      sessionId: req.params.agentId,
      task: 'Task execution failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// STEP 13: Create HTTP server
const server = http.createServer(app);

// Async server initialization function
async function initializeServer() {
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

  // Initialize live stream relay
  const liveStreamRelay = new LiveStreamRelay(server);
  console.log('📹 Live stream relay initialized');

  // Handle WebSocket upgrades for live streaming
  server.on('upgrade', (request, socket, head) => {
    try {
      // Worker stream connections
      if (liveStreamRelay.handleUpgrade(request, socket, head)) {
        return;
      }
      
      // Frontend viewer connections (both /ws/view/ and /ws/stream/ for compatibility)
      if (request.url.startsWith('/ws/view/') || request.url.startsWith('/ws/stream/')) {
        const url = new URL(request.url, 'ws://localhost');
        const sessionId = url.pathname.split('/').pop();
        
        const wss = new WebSocketServer({ noServer: true });
        wss.handleUpgrade(request, socket, head, (ws) => {
          liveStreamRelay.addFrontendConnection(sessionId, ws);
        });
        return;
      }
      
      // REMOVED: WebSocket proxy causing protocol conflicts
      // The existing Socket.IO and live stream relay handle all WebSocket connections
    } catch (error) {
      console.error('❌ WebSocket upgrade error:', error.message);
      socket.destroy();
    }
  });

  // REMOVED: WebSocket proxy handler - using existing Socket.IO and live stream relay

  // VNC CODE REMOVED - Using in-browser automation instead

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
  console.log('🔌 PRODUCTION: Socket.IO available at /ws/socket.io/');
  });
}

// Initialize the server
initializeServer().catch(error => {
  console.error('❌ PRODUCTION: Failed to initialize server:', error);
  process.exit(1);
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
      if (!['automation_access'].includes(decoded.type)) {
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

// DUPLICATE SERVER INITIALIZATION REMOVED - Server already created and listening above

// ===== DEBUG ENDPOINTS FOR TROUBLESHOOTING =====
console.log('🔧 PRODUCTION: Adding debug endpoints for troubleshooting...');

// Debug endpoint for live stream status
app.get('/api/debug/live-stream/:sessionId', async (req, res) => {
  console.log('🔍 DEBUG: Live stream status requested for:', req.params.sessionId);
  try {
    const sessionId = req.params.sessionId;
    
    // Check Redis for session data
    let redisStatus = 'disconnected';
    let sessionData = null;
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.ping();
        redisStatus = 'connected';
        sessionData = await redis.hgetall(`session:${sessionId}`);
      }
    } catch (error) {
      console.warn('⚠️ DEBUG: Redis check failed:', error.message);
    }
    
    // Check if session exists in database
    let dbSession = null;
    try {
      const { getUserSession } = await import('./database.js');
      dbSession = await getUserSession(sessionId);
    } catch (error) {
      console.warn('⚠️ DEBUG: Database check failed:', error.message);
    }
    
    res.json({
      sessionId,
      timestamp: new Date().toISOString(),
      redis: {
        status: redisStatus,
        sessionData: sessionData || {}
      },
      database: {
        session: dbSession ? {
          id: dbSession.id,
          status: dbSession.status,
          expiresAt: dbSession.expires_at,
          paymentVerified: dbSession.payment_verified
        } : null
      },
      liveStream: {
        activeConnections: liveStreamRelay?.frontendConnections?.size || 0,
        hasFrontendConnection: liveStreamRelay?.frontendConnections?.has(sessionId) || false
      }
    });
  } catch (error) {
    console.error('❌ DEBUG: Live stream status check failed:', error);
    res.status(500).json({
      error: 'Debug check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint for Redis frame channels
app.get('/api/debug/redis-frames', async (req, res) => {
  console.log('🔍 DEBUG: Redis frame channels check requested');
  try {
    const redis = await getRedis();
    if (!redis) {
      return res.status(503).json({
        error: 'Redis not available',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get all browser frame channels
    const channels = await redis.pubsub('CHANNELS', 'browser:frames:*');
    
    res.json({
      channels: channels || [],
      channelCount: channels?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ DEBUG: Redis frames check failed:', error);
    res.status(500).json({
      error: 'Redis frames check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint for WebSocket connections
app.get('/api/debug/websocket-connections', async (req, res) => {
  console.log('🔍 DEBUG: WebSocket connections check requested');
  try {
    const connections = {
      liveStreamRelay: {
        frontendConnections: liveStreamRelay?.frontendConnections?.size || 0,
        hasRedisSubscriber: !!liveStreamRelay?.redisSubscriber
      },
      realtimeAutomation: {
        // Socket.IO connections are handled internally
        available: true
      }
    };
    
    res.json({
      connections,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ DEBUG: WebSocket connections check failed:', error);
    res.status(500).json({
      error: 'WebSocket connections check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint for environment variables
app.get('/api/debug/env', async (req, res) => {
  console.log('🔍 DEBUG: Environment variables check requested');
  try {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      REDIS_URL: process.env.REDIS_URL ? '***configured***' : 'not set',
      REDIS_PUBLIC_URL: process.env.REDIS_PUBLIC_URL ? '***configured***' : 'not set',
      JWT_SECRET: process.env.JWT_SECRET ? '***configured***' : 'not set',
      GROQ_API_KEY: process.env.GROQ_API_KEY ? '***configured***' : 'not set',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '***configured***' : 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? '***configured***' : 'not set'
    };
    
    res.json({
      environment: envVars,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ DEBUG: Environment check failed:', error);
    res.status(500).json({
      error: 'Environment check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ PRODUCTION: Debug endpoints added for troubleshooting');

// ===== COMPREHENSIVE TEST ENDPOINT =====
console.log('🔧 PRODUCTION: Adding comprehensive test endpoint...');

// Test complete end-to-end flow
app.get('/api/test-complete-flow', async (req, res) => {
  console.log('🧪 TEST: Complete flow test requested');
  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    // Test 1: Redis Connection
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.ping();
        testResults.tests.redis = { status: 'connected', message: 'Redis connection successful' };
      } else {
        testResults.tests.redis = { status: 'disconnected', message: 'Redis not available' };
      }
    } catch (error) {
      testResults.tests.redis = { status: 'error', message: error.message };
    }
    
    // Test 2: Database Connection
    try {
      const { getDatabase } = await import('./database.js');
      const db = getDatabase();
      if (db) {
        const result = await db.query('SELECT 1');
        testResults.tests.database = { status: 'connected', message: 'Database connection successful' };
      } else {
        testResults.tests.database = { status: 'disconnected', message: 'Database not available' };
      }
    } catch (error) {
      testResults.tests.database = { status: 'error', message: error.message };
    }
    
    // Test 3: JWT Utils
    try {
      const { generateWebSocketToken, verifyWebSocketToken } = await import('./jwt-utils.js');
      const testToken = generateWebSocketToken('test-session', 'test-agent');
      const decoded = verifyWebSocketToken(testToken);
      testResults.tests.jwt = { 
        status: 'working', 
        message: 'JWT generation and verification successful',
        testToken: testToken.substring(0, 20) + '...'
      };
    } catch (error) {
      testResults.tests.jwt = { status: 'error', message: error.message };
    }
    
    // Test 4: Live Stream Relay
    try {
      const hasRelay = !!liveStreamRelay;
      const hasFrontendConnections = !!liveStreamRelay?.frontendConnections;
      const hasRedisSubscriber = !!liveStreamRelay?.redisSubscriber;
      
      testResults.tests.liveStreamRelay = {
        status: hasRelay ? 'initialized' : 'not initialized',
        message: `Relay: ${hasRelay}, Frontend: ${hasFrontendConnections}, Redis: ${hasRedisSubscriber}`,
        frontendConnections: liveStreamRelay?.frontendConnections?.size || 0
      };
    } catch (error) {
      testResults.tests.liveStreamRelay = { status: 'error', message: error.message };
    }
    
    // Test 5: WebSocket Server
    try {
      const hasWebSocketServer = !!liveStreamRelay?.wss;
      testResults.tests.webSocketServer = {
        status: hasWebSocketServer ? 'initialized' : 'not initialized',
        message: `WebSocket server: ${hasWebSocketServer}`
      };
    } catch (error) {
      testResults.tests.webSocketServer = { status: 'error', message: error.message };
    }
    
    // Test 6: Environment Variables
    const requiredEnvVars = ['NODE_ENV', 'PORT', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    testResults.tests.environment = {
      status: missingEnvVars.length === 0 ? 'complete' : 'incomplete',
      message: missingEnvVars.length === 0 ? 'All required environment variables set' : `Missing: ${missingEnvVars.join(', ')}`,
      missing: missingEnvVars
    };
    
    // Test 7: API Routes
    try {
      const testRoutes = [
        '/api/health',
        '/api/debug/env',
        '/api/debug/websocket-connections'
      ];
      
      const routeTests = [];
      for (const route of testRoutes) {
        try {
          const response = await fetch(`http://localhost:${port}${route}`);
          routeTests.push({
            route,
            status: response.ok ? 'working' : 'error',
            statusCode: response.status
          });
        } catch (error) {
          routeTests.push({
            route,
            status: 'error',
            error: error.message
          });
        }
      }
      
      testResults.tests.apiRoutes = {
        status: routeTests.every(r => r.status === 'working') ? 'working' : 'partial',
        message: `API routes test completed`,
        routes: routeTests
      };
    } catch (error) {
      testResults.tests.apiRoutes = { status: 'error', message: error.message };
    }
    
    // Overall Status
    const allTests = Object.values(testResults.tests);
    const workingTests = allTests.filter(test => test.status === 'working' || test.status === 'connected' || test.status === 'initialized' || test.status === 'complete');
    const totalTests = allTests.length;
    
    testResults.overall = {
      status: workingTests.length === totalTests ? 'all_passing' : 'partial',
      message: `${workingTests.length}/${totalTests} tests passing`,
      score: Math.round((workingTests.length / totalTests) * 100)
    };
    
    res.json(testResults);
  } catch (error) {
    console.error('❌ TEST: Complete flow test failed:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ PRODUCTION: Comprehensive test endpoint added');
