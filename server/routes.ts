import type { Express } from "express";
import { createServer, type Server } from "http";
import { Redis } from "ioredis";
import validator from "validator";
import Stripe from "stripe";
import { storage } from "./storage";
import { analyzeTask, generateInitialMessage } from "./openai";
import { browserAgent } from "./browserAutomation";
import { mcpOrchestrator } from "./mcpOrchestrator";
import { 
  validateAIInput,
  logSecurityEvent,
  createSecureSessionCookie,
  parseSecureSessionCookie,
  generateCSRFToken,
  validateCSRFToken,
  MultiLayerRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG
} from "./security";
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

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing required OpenAI secret: OPENAI_API_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Input validation helper - validates without corrupting data
function validateInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Invalid input type');
  }
  
  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    throw new Error('Input cannot be empty');
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`Input too long. Maximum ${maxLength} characters allowed`);
  }
  
  // Basic validation - no HTML tags or script content
  if (/<script|javascript:|data:|vbscript:/i.test(trimmed)) {
    throw new Error('Input contains potentially dangerous content');
  }
  
  return trimmed;
}

// Global rate limiting and session security stores
let rateLimiter: MultiLayerRateLimiter;
let sessionSecurityStore: SessionSecurityStore;

export async function registerRoutes(app: Express): Promise<Server> {
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
      throw new Error('REDIS_URL required for production rate limiting and session security');
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
  
  // Create Stripe Checkout session for 24h agent access
  app.post("/api/create-checkout-session", 
    rateLimiter ? rateLimiter.createPaymentLimiter() : (req, res, next) => next(), 
    async (req, res) => {
    try {
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
      console.error("Error creating checkout session:", error);
      res.status(500).json({ 
        error: "Failed to create checkout session: " + error.message 
      });
    }
  });

  // Handle successful Stripe Checkout and create agent session
  app.post("/api/checkout-success", 
    rateLimiter ? rateLimiter.createPaymentLimiter() : (req, res, next) => next(),
    async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: "Valid checkout session ID required" });
      }
      
      // Validate sessionId format (should be Stripe session ID)
      if (!validator.isAlphanumeric(sessionId.replace(/[_-]/g, '')) || sessionId.length < 20 || sessionId.length > 200) {
        return res.status(400).json({ error: "Invalid session ID format" });
      }

      // Check for replay attacks - ensure checkout session hasn't been used before
      const existingSession = await storage.getSessionByCheckoutSessionId(sessionId);
      if (existingSession) {
        return res.status(400).json({ error: "Checkout session already used" });
      }

      // Verify payment with Stripe
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Comprehensive session validation
      if (checkoutSession.payment_status !== "paid") {
        return res.status(400).json({ error: "Payment not successful" });
      }

      // Validate session parameters match expected values
      if (checkoutSession.amount_total !== 100) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }

      if (checkoutSession.currency !== "usd") {
        return res.status(400).json({ error: "Invalid payment currency" });
      }

      if (checkoutSession.mode !== "payment") {
        return res.status(400).json({ error: "Invalid payment mode" });
      }

      // Verify metadata
      if (checkoutSession.metadata?.product !== "agent-hq-24h-session") {
        return res.status(400).json({ error: "Invalid product metadata" });
      }

      // Generate unique agent ID
      const agentId = `PHOENIX-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      // Create 24-hour session with checkout session ID for idempotency
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const session = await storage.createSession({
        agentId,
        checkoutSessionId: sessionId,
        stripePaymentIntentId: checkoutSession.payment_intent as string,
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
      res.status(500).json({ error: "Failed to process payment: " + error.message });
    }
  });

  // Get agent session info
  app.get("/api/session/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        await storage.deactivateSession(session.id);
        return res.status(410).json({ error: "Session expired" });
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
      res.status(500).json({ error: "Failed to get session: " + error.message });
    }
  });

  // Get chat messages for a session
  app.get("/api/session/:agentId/messages", async (req, res) => {
    try {
      const { agentId } = req.params;
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "Session expired" });
      }

      const messages = await storage.getSessionMessages(session.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error getting messages:", error);
      res.status(500).json({ error: "Failed to get messages: " + error.message });
    }
  });

  // Send message to agent with AI operations rate limiting
  app.post("/api/session/:agentId/message", 
    rateLimiter ? rateLimiter.createAIOperationsLimiter() : (req, res, next) => next(),
    async (req, res) => {
    try {
      const { agentId } = req.params;
      const { content } = req.body;
      
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Message content required" });
      }
      
      // Validate and sanitize agentId
      if (!validator.isAlphanumeric(agentId.replace(/[-_]/g, '')) || agentId.length > 50) {
        return res.status(400).json({ error: "Invalid agent ID format" });
      }
      
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "Session expired" });
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
        return res.status(410).json({ error: "Session expired" });
      }

      // Save user message with validated content
      const userMessage = await storage.createMessage({
        sessionId: session.id,
        role: "user",
        content: validatedContent,
        hasExecutableTask: false,
        taskDescription: null
      });

      // Generate agent response using OpenAI with validated content
      const agentResponse = await analyzeTask(validatedContent);
      
      const agentMessage = await storage.createMessage({
        sessionId: session.id,
        role: "agent",
        content: agentResponse.response,
        hasExecutableTask: agentResponse.isExecutable,
        taskDescription: agentResponse.taskDescription
      });

      res.json({
        userMessage,
        agentMessage
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message: " + error.message });
    }
  });

  // Execute task
  app.post("/api/session/:agentId/execute", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { taskDescription } = req.body;
      
      if (!taskDescription || typeof taskDescription !== 'string') {
        return res.status(400).json({ error: "Valid task description required" });
      }
      
      // Validate and sanitize agentId
      if (!validator.isAlphanumeric(agentId.replace(/[-_]/g, '')) || agentId.length > 50) {
        return res.status(400).json({ error: "Invalid agent ID format" });
      }
      
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
        return res.status(410).json({ error: "Session expired" });
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
      res.status(500).json({ error: "Failed to execute task: " + error.message });
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
  app.post("/api/browser/:sessionId/command", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { command, timestamp } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "Valid command required" });
      }
      
      // Validate and sanitize sessionId
      if (!validator.isAlphanumeric(sessionId.replace(/[-_]/g, '')) || sessionId.length > 50) {
        return res.status(400).json({ error: "Invalid session ID format" });
      }
      
      // Sanitize command
      let sanitizedCommand;
      try {
        sanitizedCommand = validateInput(command, 500);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }

      // Verify session exists and is active
      const session = await storage.getSessionByAgentId(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "Session expired" });
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

  const httpServer = createServer(app);
  return httpServer;
}


// Legacy simulation function removed - now using AI-powered browser automation