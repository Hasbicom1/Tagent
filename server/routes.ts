import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create $1 payment intent for 24h agent access
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 100, // $1.00 in cents
        currency: "usd",
        metadata: {
          product: "agent-hq-24h-session"
        }
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ 
        error: "Failed to create payment intent: " + error.message 
      });
    }
  });

  // Confirm payment and create agent session
  app.post("/api/confirm-payment", async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ error: "Payment intent ID required" });
      }

      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ error: "Payment not successful" });
      }

      // Generate unique agent ID
      const agentId = `PHOENIX-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      // Create 24-hour session
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const session = await storage.createSession({
        agentId,
        stripePaymentIntentId: paymentIntentId,
        expiresAt,
        isActive: true
      });

      // Create initial agent message
      await storage.createMessage({
        sessionId: session.id,
        role: "agent",
        content: "PHOENIX-7742 NEURAL NETWORK ONLINE\n\nAutonomous agent initialized and ready for task deployment.\nProvide task parameters and I will execute with full transparency.\n\nWhat would you like me to accomplish?",
        hasExecutableTask: false,
        taskDescription: null
      });

      res.json({
        sessionId: session.id,
        agentId: session.agentId,
        expiresAt: session.expiresAt
      });
    } catch (error: any) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment: " + error.message });
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

      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "Session expired" });
      }

      // Save user message
      const userMessage = await storage.createMessage({
        sessionId: session.id,
        role: "user",
        content,
        hasExecutableTask: false,
        taskDescription: null
      });

      // Generate agent response
      const agentResponse = analyzeTask(content);
      
      const agentMessage = await storage.createMessage({
        sessionId: session.id,
        role: "agent",
        content: agentResponse.response,
        hasExecutableTask: agentResponse.isExecutable,
        taskDescription: agentResponse.task
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
      
      if (!taskDescription) {
        return res.status(400).json({ error: "Task description required" });
      }

      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (new Date() > session.expiresAt) {
        return res.status(410).json({ error: "Session expired" });
      }

      // Create execution record
      const execution = await storage.createExecution({
        sessionId: session.id,
        taskDescription,
        status: "running",
        logs: ["INITIALIZING BROWSER ENGINE..."]
      });

      // Simulate task execution
      simulateTaskExecution(execution.id, storage);

      res.json({
        executionId: execution.id,
        status: "running"
      });
    } catch (error: any) {
      console.error("Error executing task:", error);
      res.status(500).json({ error: "Failed to execute task: " + error.message });
    }
  });

  // Get execution status
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

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to analyze user tasks
function analyzeTask(message: string) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('amazon') || lowerMessage.includes('shop') || lowerMessage.includes('buy')) {
    return {
      response: 'E-COMMERCE AUTOMATION DETECTED\n\nI will navigate to the target shopping platform, perform product searches, analyze pricing data, check availability, and can handle cart operations.\n\nReady to execute autonomous shopping workflow.',
      isExecutable: true,
      task: 'E-commerce automation and price comparison'
    };
  }
  
  if (lowerMessage.includes('linkedin') || lowerMessage.includes('social') || lowerMessage.includes('post')) {
    return {
      response: 'SOCIAL MEDIA AUTOMATION IDENTIFIED\n\nI will handle social media platform navigation, content creation, posting workflows, engagement tracking, and audience analysis.\n\nReady to execute social media management sequence.',
      isExecutable: true,
      task: 'Social media management and automation'
    };
  }
  
  if (lowerMessage.includes('form') || lowerMessage.includes('fill') || lowerMessage.includes('submit')) {
    return {
      response: 'FORM AUTOMATION PROTOCOL ACTIVATED\n\nI will navigate to target forms, analyze field requirements, populate data intelligently, handle validation errors, and complete submissions.\n\nReady to execute form processing workflow.',
      isExecutable: true,
      task: 'Automated form filling and submission'
    };
  }
  
  if (lowerMessage.includes('data') || lowerMessage.includes('scrape') || lowerMessage.includes('extract')) {
    return {
      response: 'DATA EXTRACTION SYSTEM ONLINE\n\nI will systematically navigate target sites, extract structured information, handle pagination, process dynamic content, and compile results.\n\nReady to execute data collection protocol.',
      isExecutable: true,
      task: 'Web data extraction and scraping'
    };
  }
  
  return {
    response: 'TASK ANALYSIS COMPLETE\n\nI have processed your request and developed an execution plan. I will handle all browser interactions, data processing, and result compilation autonomously.\n\nReady to execute when you give the command.',
    isExecutable: true,
    task: 'General web automation task'
  };
}

// Simulate browser automation task execution
async function simulateTaskExecution(executionId: string, storage: any) {
  const steps = [
    'LOADING NEURAL NETWORKS...',
    'ESTABLISHING SECURE SESSION...',
    'ANALYZING TARGET ENVIRONMENT...',
    'EXECUTING AUTOMATION SEQUENCE...',
    'PROCESSING RESULTS...',
    'TASK COMPLETED SUCCESSFULLY'
  ];

  for (let i = 0; i < steps.length; i++) {
    setTimeout(async () => {
      const logs = steps.slice(0, i + 1);
      const isComplete = i === steps.length - 1;
      
      await storage.updateExecutionStatus(
        executionId,
        isComplete ? "completed" : "running",
        logs,
        isComplete ? new Date() : undefined
      );
    }, (i + 1) * 2000);
  }
}