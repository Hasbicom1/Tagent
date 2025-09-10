import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { analyzeTask, generateInitialMessage } from "./openai";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing required OpenAI secret: OPENAI_API_KEY');
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

      // Generate agent response using OpenAI
      const agentResponse = await analyzeTask(content);
      
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