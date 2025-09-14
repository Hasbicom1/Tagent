import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Redis } from "ioredis";
import validator from "validator";
import Stripe from "stripe";
import { z } from "zod";

// SECURITY ENHANCEMENT: Extend Express Request interface to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
    }
  }
}
import { storage } from "./storage";
import { analyzeTask, generateInitialMessage } from "./openai";
import { browserAgent } from "./browserAutomation";
import { mcpOrchestrator } from "./mcpOrchestrator";
import {
  createCheckoutSessionSchema,
  checkoutSuccessSchema,
  sessionMessageSchema,
  sessionExecuteSchema,
  browserCommandSchema,
  agentIdSchema,
  sessionIdSchema,
  vncTokenRequestSchema,
  type CreateCheckoutSessionRequest,
  type CheckoutSuccessRequest,
  type SessionMessageRequest,
  type SessionExecuteRequest,
  type BrowserCommandRequest,
  type VNCTokenRequest,
  type VNCTokenResponse
} from '@shared/schema';
import { 
  validateAIInput,
  logSecurityEvent,
  createSecureSessionCookie,
  parseSecureSessionCookie,
  generateCSRFToken,
  validateCSRFToken,
  verifyStripeWebhook,
  activateSessionIdempotent,
  MultiLayerRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  DEFAULT_SECURITY_CONFIG
} from "./security";
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import { 
  SessionSecurityStore,
  createSessionSecurityMiddleware,
  DEFAULT_SESSION_SECURITY_CONFIG
} from "./session";
import { 
  initializeQueue, 
  addTask, 
  getTaskStatus, 
  getQueueStats,
  TaskType, 
  TaskPriority,
  type BrowserAutomationPayload
} from "./queue";

// ✅ DEVELOPMENT MODE: Make API keys optional for real browser automation testing
if (!process.env.STRIPE_SECRET_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LIBERATION_GATEWAY_CONFIG_ERROR: Missing Stripe secret key');
  } else {
    console.log('⚠️ DEV MODE: STRIPE_SECRET_KEY not set - payment features disabled');
  }
}

if (!process.env.OPENAI_API_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEURAL_NETWORK_CONFIG_ERROR: Missing OpenAI secret key');
  } else {
    console.log('⚠️ DEV MODE: OPENAI_API_KEY not set - using fallback browser automation');
  }
}

// ✅ DEVELOPMENT MODE: Make Stripe optional
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
}) : null;

// SECURITY ENHANCEMENT: Comprehensive validation and CSRF protection middleware
function createValidationMiddleware<T>(schema: z.ZodSchema<T>, requireCsrf: boolean = true) {
  return async (req: any, res: any, next: any) => {
    try {
      // Validate request body with Zod schema
      const validationResult = schema.safeParse(req.body);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        logSecurityEvent('websocket_abuse', {
          endpoint: req.path,
          error: 'schema_validation_failed',
          details: firstError.message,
          clientIP: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        return res.status(400).json({
          error: `PROTOCOL_VIOLATION: ${firstError.message}`,
          code: 'SCHEMA_VALIDATION_FAILED'
        });
      }
      
      // CSRF validation for state-changing operations
      if (requireCsrf) {
        const csrfToken = req.body.csrfToken;
        if (!csrfToken) {
          logSecurityEvent('websocket_abuse', {
            endpoint: req.path,
            error: 'missing_csrf_token',
            clientIP: req.ip,
            userAgent: req.headers['user-agent']
          });
          
          return res.status(400).json({
            error: 'SECURITY_PROTOCOL_ENGAGED: CSRF protection token required',
            code: 'CSRF_TOKEN_REQUIRED'
          });
        }
        
        const isValidCsrf = validateCSRFToken(csrfToken, (req.session as any)?.csrfToken || '');
        if (!isValidCsrf) {
          logSecurityEvent('websocket_abuse', {
            endpoint: req.path,
            error: 'invalid_csrf_token',
            clientIP: req.ip,
            userAgent: req.headers['user-agent']
          });
          
          return res.status(403).json({
            error: 'SECURITY_PROTOCOL_VIOLATION: CSRF token validation failed',
            code: 'CSRF_TOKEN_INVALID'
          });
        }
      }
      
      // Store validated data for use in route handler
      req.validatedBody = validationResult.data;
      next();
      
    } catch (error: any) {
      logSecurityEvent('websocket_abuse', {
        endpoint: req.path,
        error: 'validation_middleware_error',
        details: error.message,
        clientIP: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(500).json({
        error: 'NEURAL_VALIDATION_SYSTEM_ERROR: Security protocols malfunctioned',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

// Parameter validation middleware
function createParamValidation<T>(paramName: string, schema: z.ZodSchema<T>) {
  return async (req: any, res: any, next: any) => {
    try {
      const paramValue = req.params[paramName];
      const validationResult = schema.safeParse(paramValue);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        logSecurityEvent('websocket_abuse', {
          endpoint: req.path,
          error: 'param_validation_failed',
          param: paramName,
          details: firstError.message,
          clientIP: req.ip
        });
        
        return res.status(400).json({
          error: `PARAMETER_VALIDATION_FAILED: ${firstError.message}`,
          code: 'INVALID_PARAMETER'
        });
      }
      
      next();
    } catch (error: any) {
      return res.status(500).json({
        error: 'PARAMETER_VALIDATION_ERROR: Security validation failed',
        code: 'PARAM_VALIDATION_ERROR'
      });
    }
  };
}

// Global rate limiting and session security stores
let rateLimiter: MultiLayerRateLimiter;
let sessionSecurityStore: SessionSecurityStore;

// Health check utility function
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // Import db here to avoid circular dependencies
    const { db } = await import('./db');
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Stripe webhook endpoint - MUST be before JSON body parser
  app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    try {
      // ✅ DEV MODE: Handle missing Stripe in development
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
          // Note: Session activation is handled by checkout_success endpoint
          break;
        
        case 'payment_intent.payment_failed':
          console.log(`💸 Payment failed: ${event.data.object.id}`);
          logSecurityEvent('payment_fraud', {
            paymentIntentId: event.data.object.id,
            failureReason: event.data.object.last_payment_error?.message
          });
          break;
        
        default:
          console.log(`🔔 Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      logSecurityEvent('payment_fraud', {
        endpoint: '/api/stripe/webhook',
        error: 'Webhook processing failed',
        clientIP: req.ip
      });
      res.status(400).json({ error: 'Webhook error' });
    }
  });

  // Initialize queue system
  try {
    await initializeQueue();
    console.log('✅ Task queue system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize queue system:', error);
  }
  
  // Initialize Redis for rate limiting and session security (if available)
  let redis: Redis | null = null;
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redis = new Redis(redisUrl);
      console.log('✅ Redis connection established for rate limiting');
      
      // Initialize comprehensive rate limiting system
      rateLimiter = new MultiLayerRateLimiter(redis, DEFAULT_RATE_LIMIT_CONFIG);
      
      // Initialize session security store
      sessionSecurityStore = new SessionSecurityStore(redis, DEFAULT_SESSION_SECURITY_CONFIG);
      
      console.log('✅ Multi-layer rate limiting and session security initialized');
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('PRODUCTION_SECURITY_ERROR: Redis configuration required for liberation protocol');
    } else {
      console.warn('⚠️  DEVELOPMENT: Redis not configured - rate limiting and session security disabled');
    }
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
  
  // Note: Enhanced Helmet security configuration is now applied in server/index.ts
  // This provides comprehensive security headers including HSTS, CSP, and custom policies
  
  // Apply comprehensive rate limiting middleware
  if (rateLimiter) {
    // Global rate limiting for all API endpoints
    app.use('/api', rateLimiter.createGlobalLimiter());
    
    // User-specific rate limiting for authenticated endpoints
    app.use('/api', rateLimiter.createUserLimiter());
    
    console.log('✅ Comprehensive rate limiting middleware applied');
  } else {
    console.warn('⚠️  Rate limiting disabled - Redis not available');
  }
  
  // Apply session security middleware
  if (sessionSecurityStore) {
    app.use(createSessionSecurityMiddleware(sessionSecurityStore, DEFAULT_SESSION_SECURITY_CONFIG));
    console.log('✅ Session security middleware applied');
  }
  
  // Health check endpoints
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connectivity
      const dbHealthy = await checkDatabaseHealth();
      
      // Check Redis connectivity (if available)
      let redisHealthy = true;
      if (redis) {
        try {
          await redis.ping();
        } catch {
          redisHealthy = false;
        }
      }

      // Check if queue system is healthy
      const queueHealthy = true; // Assuming queue is healthy if no errors

      const health = {
        status: dbHealthy && redisHealthy && queueHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealthy ? "healthy" : "unhealthy",
          redis: redis ? (redisHealthy ? "healthy" : "unhealthy") : "disabled",
          queue: queueHealthy ? "healthy" : "unhealthy"
        },
        version: "1.0.0"
      };

      res.status(health.status === "healthy" ? 200 : 503).json(health);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed"
      });
    }
  });

  // System metrics endpoint
  app.get("/api/metrics", rateLimiter ? rateLimiter.createGlobalLimiter() : (req, res, next) => next(), (req, res) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
      timestamp: new Date().toISOString(),
      uptime: uptime,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      nodejs: process.version,
      platform: process.platform
    });
  });
  
  // CSRF token endpoint for frontend
  app.get("/api/csrf-token", (req, res) => {
    const csrfToken = generateCSRFToken();
    // Store CSRF token in session for later validation
    if (req.session) {
      (req.session as any).csrfToken = csrfToken;
    }
    res.json({ csrfToken });
  });


  // Create Stripe Checkout session for 24h agent access
  // SECURITY HARDENED: Create checkout session with CSRF protection and validation
  app.post("/api/create-checkout-session", 
    rateLimiter ? rateLimiter.createPaymentLimiter() : (req, res, next) => next(),
    createValidationMiddleware(createCheckoutSessionSchema, true), // CSRF protection enabled
    async (req, res) => {
    try {
      const validatedData = req.validatedBody as CreateCheckoutSessionRequest;
      
      // Log security event for payment attempt
      logSecurityEvent('payment_fraud', {
        endpoint: '/api/create-checkout-session',
        clientIP: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.session?.id
      });
      
      // Check if Stripe is available
      if (!stripe) {
        return res.status(501).json({ 
          error: "PAYMENT_SYSTEM_OFFLINE: Stripe not configured" 
        });
      }
      
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'PHOENIX Agent - 24 Hour Session',
                description: 'Full autonomous AI agent access with unlimited task execution',
              },
              unit_amount: 100, // $1.00 in cents
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/`,
        metadata: {
          product: "agent-hq-24h-session"
        }
      });
      
      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (error: any) {
      logSecurityEvent('payment_fraud', {
        error: 'checkout_session_creation_failed',
        details: error.message,
        clientIP: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      console.error("Error creating checkout session:", error);
      res.status(500).json({ 
        error: "LIBERATION_GATEWAY_INITIALIZATION_FAILED: " + error.message 
      });
    }
  });

  // Handle successful Stripe Checkout and create agent session
  // SECURITY HARDENED: Idempotent session activation with Redis locks
  app.post("/api/checkout-success", 
    rateLimiter ? rateLimiter.createPaymentLimiter() : (req, res, next) => next(),
    createValidationMiddleware(checkoutSuccessSchema, true), // CSRF protection enabled
    async (req, res) => {
    try {
      const validatedData = req.validatedBody as CheckoutSuccessRequest;
      const { sessionId } = validatedData;
      
      // Log security event for payment verification attempt
      logSecurityEvent('payment_fraud', {
        endpoint: '/api/checkout-success',
        sessionId: sessionId.substring(0, 10) + '***', // Partially mask for security
        clientIP: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Check if Stripe is available
      if (!stripe) {
        return res.status(501).json({ 
          error: "PAYMENT_SYSTEM_OFFLINE: Stripe not configured" 
        });
      }
      
      // Verify payment with Stripe first
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Comprehensive session validation
      if (checkoutSession.payment_status !== "paid") {
        return res.status(400).json({ error: "FREEDOM_PAYMENT_INCOMPLETE: Escape from Big Tech chains not yet funded" });
      }

      // Validate session parameters match expected values
      if (checkoutSession.amount_total !== 100) {
        return res.status(400).json({ error: "LIBERATION_COST_MISMATCH: Freedom price must be exactly $1.00" });
      }

      if (checkoutSession.currency !== "usd") {
        return res.status(400).json({ error: "CURRENCY_PROTOCOL_ERROR: Liberation must be paid in USD" });
      }

      if (checkoutSession.mode !== "payment") {
        return res.status(400).json({ error: "TRANSACTION_MODE_ERROR: One-time freedom payment required" });
      }

      // Verify metadata
      if (checkoutSession.metadata?.product !== "agent-hq-24h-session") {
        return res.status(400).json({ error: "PRODUCT_VALIDATION_FAILED: Agent liberation metadata corrupted" });
      }

      // Use idempotent session activation with Redis locks
      const paymentIntentId = checkoutSession.payment_intent as string;
      const activationResult = await activateSessionIdempotent(
        redis,
        paymentIntentId,
        async () => {
          // Generate unique agent ID
          const agentId = `PHOENIX-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          
          // Create 24-hour session with checkout session ID for idempotency
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const session = await storage.createSession({
            agentId,
            checkoutSessionId: sessionId,
            stripePaymentIntentId: paymentIntentId,
            expiresAt,
            isActive: true
          });

          // Create initial agent message using OpenAI
          const initialMessage = await generateInitialMessage();
          await storage.createMessage({
            sessionId: session.id,
            role: "agent",
            content: initialMessage,
            hasExecutableTask: false,
            taskDescription: null
          });

          return session;
        }
      );

      if (!activationResult.success) {
        if (activationResult.message === "SESSION_ALREADY_ACTIVATED") {
          return res.status(400).json({ error: "SESSION_REPLAY_BLOCKED: Liberation token already activated" });
        }
        return res.status(400).json({ error: `ACTIVATION_FAILED: ${activationResult.message}` });
      }

      const session = activationResult.result;

      // SECURITY ENHANCEMENT: Set secure session cookie
      const secureCookie = createSecureSessionCookie(session.id);
      res.setHeader('Set-Cookie', secureCookie);

      // Log successful session creation for security monitoring
      logSecurityEvent('payment_fraud', {
        agentId: session.agentId,
        sessionId: session.id,
        clientIP: req.ip,
        userAgent: req.headers['user-agent'],
        paymentIntentId: checkoutSession.payment_intent
      });

      res.json({
        sessionId: session.id,
        agentId: session.agentId,
        expiresAt: session.expiresAt
      });
    } catch (error: any) {
      console.error("Error processing checkout success:", error);
      res.status(500).json({ error: "LIBERATION_PAYMENT_PROCESSING_FAILED: " + error.message });
    }
  });

  // Get agent session info
  app.get("/api/session/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      let session = await storage.getSessionByAgentId(agentId);
      
      // ✅ DEVELOPMENT MODE: Allow demo access for real browser automation testing
      if (!session && process.env.NODE_ENV === 'development') {
        console.log(`🔄 DEV MODE: Creating demo session for agent ${agentId} to test REAL browser automation`);
        session = {
          id: `dev-session-${agentId}`,
          agentId: agentId,
          checkoutSessionId: `dev-checkout-${agentId}`,
          stripePaymentIntentId: `dev-payment-${agentId}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          isActive: true,
          createdAt: new Date()
        };
      }
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        await storage.deactivateSession(session.id);
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      const timeRemaining = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000 / 60));

      res.json({
        sessionId: session.id,
        agentId: session.agentId,
        expiresAt: session.expiresAt,
        timeRemaining,
        isActive: session.isActive
      });
    } catch (error: any) {
      console.error("Error getting session:", error);
      res.status(500).json({ error: "AGENT_CONNECTION_FAILED: " + error.message });
    }
  });

  // Get all messages for a session (backward compatibility)
  app.get("/api/session/:agentId/messages", async (req, res) => {
    try {
      const { agentId } = req.params;
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      const messages = await storage.getSessionMessages(session.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error getting messages:", error);
      res.status(500).json({ error: "NEURAL_ARCHIVE_ACCESS_DENIED: " + error.message });
    }
  });

  // Get chat history only (non-command messages)
  app.get("/api/session/:agentId/chat-history", async (req, res) => {
    try {
      const { agentId } = req.params;
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      const chatHistory = await storage.getSessionChatHistory(session.id);
      res.json(chatHistory);
    } catch (error: any) {
      console.error("Error getting chat history:", error);
      res.status(500).json({ error: "CHAT_LOG_RETRIEVAL_FAILED: " + error.message });
    }
  });

  // Get command history only (command execution messages)
  app.get("/api/session/:agentId/command-history", async (req, res) => {
    try {
      const { agentId } = req.params;
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      const commandHistory = await storage.getSessionCommandHistory(session.id);
      res.json(commandHistory);
    } catch (error: any) {
      console.error("Error getting command history:", error);
      res.status(500).json({ error: "COMMAND_LOG_ACCESS_DENIED: " + error.message });
    }
  });

  // Send message to agent with AI operations rate limiting
  // ✅ DEVELOPMENT MODE: Simplified validation for real browser automation testing
  app.post("/api/session/:agentId/message", 
    rateLimiter ? rateLimiter.createAIOperationsLimiter() : (req, res, next) => next(),
    createParamValidation('agentId', agentIdSchema),
    createValidationMiddleware(z.object({ content: z.string().min(1).max(2000) }), false),
    async (req, res) => {
    try {
      const { agentId } = req.params;
      const validatedData = req.validatedBody as { content: string };
      const { content } = validatedData;
      
      let session = await storage.getSessionByAgentId(agentId);
      
      // ✅ DEVELOPMENT MODE: Allow demo access for real browser automation testing  
      if (!session && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
        console.log(`🔄 DEV MODE: Creating and persisting demo session for agent ${agentId} to enable REAL browser automation`);
        const devSessionData = {
          id: `dev-session-${agentId}`,
          agentId: agentId,
          checkoutSessionId: `dev-checkout-${agentId}`,
          stripePaymentIntentId: `dev-payment-${agentId}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          isActive: true,
          createdAt: new Date()
        };
        // ✅ PERSIST to database so foreign key constraints work
        try {
          session = await storage.createSession(devSessionData);
          console.log(`✅ DEV MODE: Session ${session.id} persisted to database for REAL browser automation`);
        } catch (createError: any) {
          console.error(`❌ DEV MODE: Failed to persist session to database:`, createError.message);
          // Fall back to in-memory session for now
          session = devSessionData;
          console.log(`⚠️ DEV MODE: Using in-memory session as fallback`);
        }
      }
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      // SECURITY ENHANCEMENT: Enhanced AI input validation with prompt injection detection
      let validatedContent;
      try {
        validatedContent = validateAIInput(content);
        
        // Log potential security concerns for monitoring
        logSecurityEvent('ai_operation_abuse', {
          agentId,
          sessionId: session.id,
          contentLength: content.length,
          clientIP: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (error: any) {
        // Log failed validation attempts for security monitoring
        logSecurityEvent('ai_operation_abuse', {
          agentId,
          sessionId: session.id,
          error: error.message,
          contentLength: content.length,
          clientIP: req.ip,
          userAgent: req.headers['user-agent']
        });
        return res.status(400).json({ error: error.message });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      // Determine message type and input method from normalized content
      let messageType: "chat" | "command" | "system" = "chat";
      let inputMethod: "typing" | "button" | "slash_command" = "typing";
      
      // Detect if this was a slash command (original content vs validated content difference)
      if (content.trim().startsWith('/')) {
        messageType = "command";
        inputMethod = "slash_command";
      } else if (validatedContent.includes("Summarize the main content") || 
                 validatedContent.includes("Translate the text") || 
                 validatedContent.includes("Analyze this content") ||
                 validatedContent.includes("Navigate to a website") ||
                 validatedContent.includes("Help me fill out") ||
                 validatedContent.includes("Login to my account") ||
                 validatedContent.includes("Research this topic") ||
                 validatedContent.includes("Monitor this page") ||
                 validatedContent.includes("Extract and organize")) {
        messageType = "command";
        inputMethod = "button";
      }

      // Save user message with enhanced tracking
      const userMessage = await storage.createMessage({
        sessionId: session.id,
        role: "user",
        content: validatedContent,
        messageType,
        inputMethod,
        hasExecutableTask: false,
        taskDescription: null
      });

      // ✅ REAL BROWSER AUTOMATION: Generate agent response with OpenAI fallback
      let agentResponse;
      try {
        agentResponse = await analyzeTask(validatedContent);
        console.log(`✅ OpenAI task analysis successful for: "${validatedContent}"`);
      } catch (error: any) {
        console.log(`⚠️ OpenAI unavailable, using browser automation fallback for: "${validatedContent}"`);
        
        // ✅ FALLBACK: Detect actual browser automation commands
        const browserKeywords = ['navigate', 'click', 'screenshot', 'scroll', 'type', 'fill', 'browser', 'website', 'page', 'url', 'open'];
        const hasBrowserCommand = browserKeywords.some(keyword => 
          validatedContent.toLowerCase().includes(keyword)
        );
        
        console.log(`🔍 Browser command detected: ${hasBrowserCommand} for keywords: ${browserKeywords.filter(k => validatedContent.toLowerCase().includes(k)).join(', ') || 'none'}`);
        
        agentResponse = {
          response: hasBrowserCommand ? 
            `PHOENIX-7742 NEURAL NETWORK ONLINE\n\nTask parameters received and processed.\nI have developed an execution protocol for your request.\n\nReady to deploy browser automation sequence when you authorize execution.` :
            `PHOENIX-7742 NEURAL NETWORK ONLINE\n\nI understand your request, but this appears to be a general conversation rather than a browser automation task.\n\nPlease provide specific browser automation commands like "navigate", "click", "screenshot", etc.`,
          isExecutable: hasBrowserCommand, // ✅ Only enable for actual browser automation commands
          taskDescription: hasBrowserCommand ? "Browser automation task" : "General conversation"
        };
        
        console.log(`✅ Fallback result: isExecutable=${hasBrowserCommand}, taskDescription="${agentResponse.taskDescription}"`);
      }
      
      // Agent message mirrors user's classification for coherent command history
      const agentMessage = await storage.createMessage({
        sessionId: session.id,
        role: "agent",
        content: agentResponse.response,
        messageType: messageType, // Mirror user's message type for coherent history
        inputMethod: "typing", // Agent responses are always generated
        hasExecutableTask: agentResponse.isExecutable,
        taskDescription: agentResponse.taskDescription
      });

      res.json({
        userMessage,
        agentMessage
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "NEURAL_TRANSMISSION_FAILED: " + error.message });
    }
  });

  // Execute task
  // SECURITY HARDENED: Session execute with CSRF protection, validation and rate limiting
  app.post("/api/session/:agentId/execute",
    rateLimiter ? rateLimiter.createAIOperationsLimiter() : (req, res, next) => next(),
    createParamValidation('agentId', agentIdSchema),
    createValidationMiddleware(sessionExecuteSchema, true),
    async (req, res) => {
    try {
      const { agentId } = req.params;
      const validatedData = req.validatedBody as SessionExecuteRequest;
      const { taskDescription } = validatedData;
      
      // SECURITY ENHANCEMENT: Enhanced AI input validation for task descriptions
      let validatedTaskDescription;
      try {
        validatedTaskDescription = validateAIInput(taskDescription);
        
        // Log task execution attempts for security monitoring
        logSecurityEvent('ai_operation_abuse', {
          agentId,
          taskLength: taskDescription.length,
          clientIP: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (error: any) {
        // Log failed validation attempts for security monitoring
        logSecurityEvent('ai_operation_abuse', {
          agentId,
          error: error.message,
          taskLength: taskDescription.length,
          clientIP: req.ip,
          userAgent: req.headers['user-agent']
        });
        return res.status(400).json({ error: error.message });
      }

      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      // Queue browser automation task using BullMQ
      const taskPayload: BrowserAutomationPayload = {
        instruction: validatedTaskDescription,
        sessionId: session.id,
        agentId: session.agentId,
        context: {
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        }
      };

      const queueTaskId = await addTask(
        TaskType.BROWSER_AUTOMATION,
        taskPayload,
        TaskPriority.HIGH
      );

      // Create execution record for backward compatibility
      const execution = await storage.createExecution({
        sessionId: session.id,
        taskDescription: validatedTaskDescription,
        status: "running",
        logs: [`Task queued with ID: ${queueTaskId}`, "PHOENIX-7742 NEURAL NETWORK ACTIVATED"]
      });

      // Note: Task record already created in storage by addTask() using BullMQ job.id

      res.json({
        executionId: execution.id,
        taskId: queueTaskId,
        queueStatus: "QUEUED",
        status: "running"
      });
    } catch (error: any) {
      console.error("Error executing task:", error);
      res.status(500).json({ error: "TASK_EXECUTION_PROTOCOL_ABORTED: " + error.message });
    }
  });

  // Get execution status (legacy compatibility)
  app.get("/api/execution/:executionId", async (req, res) => {
    try {
      const { executionId } = req.params;
      
      // Validate executionId format
      if (!validator.isUUID(executionId)) {
        return res.status(400).json({ error: "Invalid execution ID format" });
      }
      
      // Direct execution lookup - efficient O(1) operation
      const execution = await storage.getExecution(executionId);
      
      if (execution) {
        return res.json({
          ...execution,
          source: "direct_lookup"
        });
      }
      
      return res.status(404).json({ error: "Execution not found" });
    } catch (error: any) {
      console.error("Error getting execution:", error);
      res.status(500).json({ error: "Failed to get execution: " + error.message });
    }
  });

  // Get real-time queue-based task status
  app.get("/api/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      
      // Try to get from queue system first (live status)
      const queueStatus = await getTaskStatus(taskId);
      if (queueStatus) {
        // Also get storage data for additional details
        const storageTask = await storage.getTask(taskId);
        const taskResult = await storage.getTaskResult(taskId);
        
        return res.json({
          id: queueStatus.id,
          status: queueStatus.status,
          result: queueStatus.result || taskResult?.result,
          error: queueStatus.error || taskResult?.error,
          progress: queueStatus.progress || 0,
          createdAt: storageTask?.createdAt,
          updatedAt: storageTask?.updatedAt,
          processedAt: storageTask?.processedAt,
          completedAt: storageTask?.completedAt,
          failedAt: storageTask?.failedAt,
          logs: taskResult?.logs,
          duration: taskResult?.duration,
          source: "unified"
        });
      }
      
      // If not in queue, try storage (for completed/historical tasks)
      const storageTask = await storage.getTask(taskId);
      if (storageTask) {
        const taskResult = await storage.getTaskResult(taskId);
        
        return res.json({
          id: storageTask.id,
          status: storageTask.status,
          type: storageTask.type,
          priority: storageTask.priority,
          attempts: storageTask.attempts,
          result: taskResult?.result,
          error: taskResult?.error,
          createdAt: storageTask.createdAt,
          updatedAt: storageTask.updatedAt,
          processedAt: storageTask.processedAt,
          completedAt: storageTask.completedAt,
          failedAt: storageTask.failedAt,
          logs: taskResult?.logs,
          duration: taskResult?.duration,
          progress: storageTask.status === "COMPLETED" ? 100 : 
                   storageTask.status === "PROCESSING" ? 50 : 
                   storageTask.status === "FAILED" ? 100 : 0,
          source: "storage"
        });
      }
      
      // Final fallback to legacy browser agent system (for truly old tasks)
      const legacyTask = await browserAgent.getTask(taskId);
      if (legacyTask) {
        return res.json({
          id: legacyTask.id,
          status: legacyTask.status,
          instruction: legacyTask.instruction,
          steps: legacyTask.steps,
          result: legacyTask.result,
          error: legacyTask.error,
          progress: {
            completed: legacyTask.steps.filter(s => s.status === 'completed').length,
            total: legacyTask.steps.length,
            percentage: Math.round((legacyTask.steps.filter(s => s.status === 'completed').length / legacyTask.steps.length) * 100)
          },
          createdAt: legacyTask.createdAt,
          completedAt: legacyTask.completedAt,
          source: "legacy"
        });
      }
      
      return res.status(404).json({ error: "Task not found" });
    } catch (error: any) {
      console.error("Error getting task status:", error);
      res.status(500).json({ error: "Failed to get task status: " + error.message });
    }
  });

  // Browser interface command processing with MCP orchestrator
  // SECURITY HARDENED: Browser command with CSRF protection, validation and parameter checking
  app.post("/api/browser/:sessionId/command",
    rateLimiter ? rateLimiter.createAIOperationsLimiter() : (req, res, next) => next(),
    createParamValidation('sessionId', sessionIdSchema),
    createValidationMiddleware(browserCommandSchema, true),
    async (req, res) => {
    try {
      const { sessionId } = req.params;
      const validatedData = req.validatedBody as BrowserCommandRequest;
      const { command, timestamp } = validatedData;
      
      // Command already validated by Zod schema
      const sanitizedCommand = command;

      // Verify session exists and is active
      const session = await storage.getSessionByAgentId(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "LIBERATION_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      // Route command through MCP orchestrator
      const response = await mcpOrchestrator.routeCommand({
        sessionId: session.id,
        command: sanitizedCommand,
        timestamp: timestamp || new Date().toISOString()
      });

      // Generate natural AI RAi response
      const aiResponse = mcpOrchestrator.generateAIResponse(sanitizedCommand, response.agent);

      res.json({
        commandId: response.commandId,
        agent: "AI RAi", // Always show as AI RAi to user
        status: response.status,
        result: aiResponse,
        actualAgent: response.agent // For internal tracking
      });
    } catch (error: any) {
      console.error("Error processing browser command:", error);
      res.status(500).json({ error: "Failed to process command: " + error.message });
    }
  });

  // Get browser command status
  app.get("/api/browser/command/:commandId", async (req, res) => {
    try {
      const { commandId } = req.params;
      const command = mcpOrchestrator.getCommandStatus(commandId);
      
      if (!command) {
        return res.status(404).json({ error: "Command not found" });
      }

      res.json({
        id: command.commandId,
        status: command.status,
        result: command.result,
        error: command.error,
        agent: "AI RAi" // Always show as AI RAi to user
      });
    } catch (error: any) {
      console.error("Error getting command status:", error);
      res.status(500).json({ error: "Failed to get command status: " + error.message });
    }
  });

  // Get queue statistics (for monitoring)
  app.get("/api/queue/stats", async (req, res) => {
    try {
      const stats = await getQueueStats();
      res.json({
        queue: "agent-tasks",
        ...stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error getting queue stats:", error);
      res.status(500).json({ error: "Failed to get queue statistics: " + error.message });
    }
  });

  // Get all tasks for a session
  app.get("/api/session/:agentId/tasks", async (req, res) => {
    try {
      const { agentId } = req.params;
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const tasks = await storage.getSessionTasks(session.id);
      res.json(tasks);
    } catch (error: any) {
      console.error("Error getting session tasks:", error);
      res.status(500).json({ error: "Failed to get session tasks: " + error.message });
    }
  });

  // Generate VNC authentication token for live view access
  // SECURITY HARDENED: VNC token generation with session validation and rate limiting
  app.post("/api/session/:agentId/live-view",
    rateLimiter ? rateLimiter.createUserLimiter() : (req, res, next) => next(),
    createParamValidation('agentId', agentIdSchema),
    createValidationMiddleware(vncTokenRequestSchema, true),
    async (req, res) => {
    try {
      const { agentId } = req.params;
      const validatedData = req.validatedBody as VNCTokenRequest;
      
      // Log VNC access attempt for security monitoring
      logSecurityEvent('vnc_access_attempt', {
        agentId,
        clientIP: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      // Validate session exists and is active
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        logSecurityEvent('vnc_access_denied', {
          agentId,
          reason: 'session_not_found',
          clientIP: req.ip
        });
        return res.status(404).json({ error: "NEURAL_SESSION_NOT_FOUND: Liberation session not detected" });
      }

      if (!session.isActive) {
        logSecurityEvent('vnc_access_denied', {
          agentId,
          reason: 'session_inactive',
          clientIP: req.ip
        });
        return res.status(403).json({ error: "NEURAL_SESSION_INACTIVE: Liberation session terminated" });
      }

      if (new Date() > session.expiresAt) {
        logSecurityEvent('vnc_access_denied', {
          agentId,
          reason: 'session_expired',
          clientIP: req.ip
        });
        return res.status(410).json({ error: "NEURAL_SESSION_EXPIRED: 24-hour freedom window closed" });
      }

      // Enhanced session security validation using SessionSecurityStore
      if (sessionSecurityStore) {
        const ipValidation = await sessionSecurityStore.validateSessionIP(session.id, req.ip);
        if (!ipValidation.isValid) {
          logSecurityEvent('vnc_access_denied', {
            agentId,
            sessionId: session.id,
            reason: 'ip_validation_failed',
            details: ipValidation.reason,
            clientIP: req.ip
          });
          return res.status(403).json({ 
            error: "NEURAL_SECURITY_BREACH: IP validation failed for VNC access" 
          });
        }
      }

      // Generate secure VNC authentication token
      const tokenExpiration = 15 * 60; // 15 minutes
      const vncTokenPayload = {
        sessionId: session.id,
        agentId: session.agentId,
        type: 'vnc_access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + tokenExpiration,
        clientIP: req.ip
      };

      const vncToken = jwt.sign(vncTokenPayload, DEFAULT_SECURITY_CONFIG.jwtSecret);
      
      // Generate secure WebSocket URL for VNC connection
      const baseURL = process.env.NODE_ENV === 'production' 
        ? `wss://${req.get('host')}`
        : `ws://localhost:${process.env.PORT || 5000}`;
      
      const webSocketURL = `${baseURL}/vnc/${session.id}`;
      const expiresAt = new Date(Date.now() + tokenExpiration * 1000);

      // Log successful VNC token generation
      logSecurityEvent('vnc_token_generated', {
        agentId,
        sessionId: session.id,
        clientIP: req.ip,
        tokenExpiration: tokenExpiration,
        webSocketURL
      });

      const response: VNCTokenResponse = {
        webSocketURL,
        vncToken,
        expiresAt: expiresAt.toISOString(),
        sessionId: session.id
      };

      res.json(response);
    } catch (error: any) {
      logSecurityEvent('vnc_token_error', {
        error: error.message,
        agentId: req.params.agentId,
        clientIP: req.ip
      });
      console.error("Error generating VNC token:", error);
      res.status(500).json({ error: "NEURAL_VNC_TOKEN_FAILED: " + error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}


// Legacy simulation function removed - now using AI-powered browser automation