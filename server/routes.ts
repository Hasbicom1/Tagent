import type { Express } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import validator from "validator";
import helmet from "helmet";
import Stripe from "stripe";
import { storage } from "./storage";
import { analyzeTask, generateInitialMessage } from "./openai";
import { browserAgent } from "./browserAutomation";
import { mcpOrchestrator } from "./mcpOrchestrator";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing required OpenAI secret: OPENAI_API_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
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

// Security rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for sensitive endpoints
  message: { error: 'Rate limit exceeded for this endpoint.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware with development-friendly CSP
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "https://js.stripe.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: ["https://checkout.stripe.com", "https://js.stripe.com"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  
  app.use(generalLimiter);
  
  // Create Stripe Checkout session for 24h agent access
  app.post("/api/create-checkout-session", strictLimiter, async (req, res) => {
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
  app.post("/api/checkout-success", strictLimiter, async (req, res) => {
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

  // Send message to agent
  app.post("/api/session/:agentId/message", async (req, res) => {
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
      
      // Validate message content
      let validatedContent;
      try {
        validatedContent = validateInput(content, 2000);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }

      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
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
      
      // Validate task description
      let validatedTaskDescription;
      try {
        validatedTaskDescription = validateInput(taskDescription, 1000);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }

      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "Session expired" });
      }

      // Create AI-powered browser automation task using PHOENIX-7742
      const taskId = await browserAgent.createTask(session.id, validatedTaskDescription);
      
      // Start task execution asynchronously
      browserAgent.executeTask(taskId).catch(error => {
        console.error(`PHOENIX-7742 task execution failed for ${taskId}:`, error);
      });

      // Create execution record for compatibility
      const execution = await storage.createExecution({
        sessionId: session.id,
        taskDescription: validatedTaskDescription,
        status: "running",
        logs: ["PHOENIX-7742 NEURAL NETWORK ACTIVATED"]
      });

      res.json({
        executionId: execution.id,
        taskId: taskId,
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
      const executions = await storage.getSessionExecutions(''); // This is inefficient but OK for MVP
      const execution = Array.from(executions).find(e => e.id === executionId);
      
      if (!execution) {
        return res.status(404).json({ error: "Execution not found" });
      }

      res.json(execution);
    } catch (error: any) {
      console.error("Error getting execution:", error);
      res.status(500).json({ error: "Failed to get execution: " + error.message });
    }
  });

  // Get real-time browser automation task status
  app.get("/api/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await browserAgent.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({
        id: task.id,
        status: task.status,
        instruction: task.instruction,
        steps: task.steps,
        result: task.result,
        error: task.error,
        progress: {
          completed: task.steps.filter(s => s.status === 'completed').length,
          total: task.steps.length,
          percentage: Math.round((task.steps.filter(s => s.status === 'completed').length / task.steps.length) * 100)
        },
        createdAt: task.createdAt,
        completedAt: task.completedAt
      });
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

  const httpServer = createServer(app);
  return httpServer;
}


// Legacy simulation function removed - now using AI-powered browser automation