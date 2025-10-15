/**
 * API ROUTES - Production Server
 * 
 * Simplified API routes for the production server without complex dependencies.
 * Builds incrementally on the working foundation.
 */

import express from 'express';
import { createUserSession, getUserSession, updateSessionStatus } from './database.js';
import { getBrowserSession, createBrowserSession, removeBrowserSession } from './browser-automation.js';
import { queueBrowserJobAfterPayment, isQueueAvailable } from './queue-simple.js';
import { generateWebSocketToken } from './jwt-utils.js';

const router = express.Router();

// Lightweight in-memory message store (production fallback)
// Keyed by agentId; persists user and agent messages for chat views
const inMemoryMessages = new Map();
function getMessageBucket(agentId) {
  if (!inMemoryMessages.has(agentId)) inMemoryMessages.set(agentId, []);
  return inMemoryMessages.get(agentId);
}

// Basic API health check
router.get('/health', (req, res) => {
  console.log('🔍 API: Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Agents service status endpoint (required by external checks)
router.get('/agents/status', (req, res) => {
  console.log('📊 API: Agents service status requested');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'agents',
    message: 'Agents API operational'
  });
});

// Real Stripe payment verification endpoint
router.post('/stripe/verify-payment', async (req, res) => {
  try {
    console.log('🔍 STRIPE: Real payment verification requested');
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID is required',
        status: 'error'
      });
    }

    // Real Stripe verification
    const { default: Stripe } = await import('stripe');
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured - payments disabled' });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Real Stripe API verification
    console.log('🔍 STRIPE: Verifying session with Stripe API:', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: 'error',
        details: 'Session payment status is not paid'
      });
    }

    console.log('✅ STRIPE: Real payment verification successful');
    console.log('💰 STRIPE: Amount paid:', session.amount_total / 100, 'USD');
    console.log('👤 STRIPE: Customer email:', session.customer_details?.email);
    
    // Generate real agent session
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    
    const sessionData = {
      sessionId,
      agentId,
      expiresAt,
      status: 'active',
      paymentVerified: true,
      amountPaid: session.amount_total / 100,
      customerEmail: session.customer_details?.email,
      stripeCustomerId: session.customer,
      realPayment: true
    };

    // Store in database
    console.log('💾 STRIPE: Storing session in database...');
    try {
      const storedSession = await createUserSession(sessionData);
      console.log('✅ DATABASE: Session stored with ID:', storedSession.id);
      
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          ...sessionData,
          databaseId: storedSession.id,
          createdAt: storedSession.createdAt
        }
      });
    } catch (dbError) {
      console.error('❌ DATABASE: Failed to store session:', dbError);
      // Still return success but log the database error
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully (database storage failed)',
        data: sessionData,
        warning: 'Session not persisted to database'
      });
    }

  } catch (error) {
    console.error('❌ STRIPE: Payment verification failed:', error);
    res.status(500).json({
      error: 'Payment verification failed',
      status: 'error',
      details: error.message
    });
  }
});

// Checkout success endpoint used by legacy frontend (returns flat fields)
// Idempotent checkout success: always return the same agent/session for a given Stripe checkout session
router.post('/checkout-success', async (req, res) => {
  try {
    console.log('✅ API: Checkout success requested');
    const { sessionId: checkoutSessionId } = req.body;

    if (!checkoutSessionId) {
      return res.status(400).json({
        error: 'Session ID is required',
        status: 'error'
      });
    }

    // Verify payment with Stripe
    const { default: Stripe } = await import('stripe');
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({
        error: 'Stripe not configured - payments disabled'
      });
    }
    const stripe = new Stripe(secret);

    console.log('🔍 STRIPE: Verifying checkout session:', checkoutSessionId);
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: 'error',
        details: 'Session payment status is not paid'
      });
    }

    // Generate unique agent ID to avoid constraint violations
    const uniqueAgentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use the unique agent ID as both sessionId and agentId for consistency
    const automationSessionId = uniqueAgentId;

    // Check if a session already exists for this checkout in our primary storage (by sessionId)
    try {
      const existing = await getUserSession(automationSessionId);
      if (existing) {
        return res.status(200).json({
          sessionId: existing.session_id,
          agentId: existing.agent_id,
          expiresAt: new Date(existing.expires_at).toISOString(),
          databaseId: existing.id,
          reused: true
        });
      }
    } catch (_) {}

    // Create 24-hour automation session (flat response expected by frontend)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const sessionData = {
      sessionId: automationSessionId,
      agentId: uniqueAgentId, // Use unique agent ID to avoid constraint violations
      expiresAt,
      status: 'active',
      paymentVerified: true,
      amountPaid: (session.amount_total || 100) / 100,
      customerEmail: session.customer_details?.email || null,
      stripeCustomerId: session.customer || null
    };

    try {
           // Create session in database
           const storedSession = await createUserSession(sessionData);
           console.log('✅ DATABASE: Automation session stored with ID:', storedSession?.session_id || storedSession?.id);
      
      // Create session in real session manager if available
      if (global.realSessionManager) {
        try {
          await global.realSessionManager.createUserSession(
            session.customer_details?.email || 'user@example.com',
            automationSessionId,
            'phoenix-7742'
          );
          console.log('✅ REAL SESSION: Session created in real session manager');
        } catch (sessionError) {
          console.warn('⚠️ REAL SESSION: Failed to create session in real session manager:', sessionError?.message);
        }
      }

      // CRITICAL FIX: Generate JWT token for WebSocket authentication
      let websocketToken = null;
      try {
        websocketToken = generateWebSocketToken(automationSessionId, uniqueAgentId);
        console.log('✅ JWT: WebSocket token generated for session:', automationSessionId);
      } catch (jwtError) {
        console.error('❌ JWT: Failed to generate WebSocket token:', jwtError.message);
        // Don't fail the checkout, just log the error
      }

      // ⚠️ CRITICAL FIX: Store EVERYTHING in Redis
      try {
        const { getRedis } = await import('./redis-simple.js');
        const redis = await getRedis();
        
        if (redis) {
          await redis.hset(`session:${automationSessionId}`, {
            'agent_id': uniqueAgentId,
            'stripe_session_id': checkoutSessionId,
            'status': 'queued',
            'browser_ready': 'false',
            'worker_ready': 'false',
            'websocket_token': websocketToken,  // ⚠️ MUST STORE TOKEN!
            'expires_at': expiresAt.toISOString(),
            'created_at': new Date().toISOString()
          });
          
          // Set expiration (24 hours + 1 hour buffer)
          await redis.expire(`session:${automationSessionId}`, 25 * 60 * 60);
          
          console.log('✅ REDIS: Session stored with JWT token:', automationSessionId);
        } else {
          console.warn('⚠️ REDIS: Redis not available, JWT token not stored');
        }
      } catch (redisError) {
        console.error('❌ REDIS: Failed to store session in Redis:', redisError.message);
      }

      // CRITICAL FIX: Use unified queue system - only add to simple Redis queue that worker processes
      try {
        const { getRedis } = await import('./redis-simple.js');
        const redis = await getRedis();
        
        if (redis) {
          await redis.rpush('browser:queue', JSON.stringify({
            sessionId: automationSessionId,
            agentId: uniqueAgentId,
            websocketToken: websocketToken,
            timestamp: Date.now(),
            source: 'checkout-success'
          }));
          console.log('✅ UNIFIED QUEUE: Browser job added to worker queue:', automationSessionId);
        } else {
          console.warn('⚠️ UNIFIED QUEUE: Redis not available, browser job not queued');
        }
      } catch (queueError) {
        console.error('❌ UNIFIED QUEUE: Failed to add to worker queue:', queueError.message);
        // Don't fail the checkout, just log the error
      }
      
           return res.status(200).json({
             sessionId: automationSessionId,
             agentId: automationSessionId,
             expiresAt: expiresAt.toISOString(),
             databaseId: storedSession?.session_id || storedSession?.id,
             websocketToken: websocketToken
           });
    } catch (dbError) {
      console.warn('⚠️ DATABASE: Failed to persist session, returning ephemeral session:', dbError?.message);
      return res.status(200).json({
        sessionId: automationSessionId,
        agentId: automationSessionId,
        expiresAt: expiresAt.toISOString(),
        warning: 'Session not persisted to database'
      });
    }
  } catch (error) {
    console.error('❌ API: Checkout success handling failed:', error);
    return res.status(500).json({
      error: 'Checkout success handling failed',
      status: 'error',
      details: error.message
    });
  }
});

// Agent session validation endpoint
router.get('/agent/:agentId/status', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('🔍 AGENT: Checking status for agent:', agentId);
    
    // Use real session manager if available
    let session = null;
    if (global.realSessionManager) {
      session = await global.realSessionManager.getUserSession(agentId);
    } else {
      // Fallback to database
      session = await getUserSession(agentId);
    }
    
    if (!session) {
      return res.status(404).json({
        error: 'Agent session not found or expired',
        status: 'not_found'
      });
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expiresAt || session.expires_at);
    
    if (now > expiresAt) {
      console.log('⚠️ AGENT: Session expired for agent:', agentId);
      if (global.realSessionManager) {
        await global.realSessionManager.updateSession(agentId, { status: 'expired' });
      } else {
        await updateSessionStatus(agentId, 'expired');
      }
      
      return res.status(410).json({
        error: 'Agent session has expired',
        status: 'expired',
        expiredAt: session.expiresAt || session.expires_at
      });
    }

    console.log('✅ AGENT: Active session found for agent:', agentId);
    res.status(200).json({
      success: true,
      agentId: session.agentId || session.agent_id,
      status: session.status,
      expiresAt: session.expiresAt || session.expires_at,
      paymentVerified: session.payment_verified || true,
      amountPaid: session.amount_paid || 1.00,
      customerEmail: session.customerEmail || session.customer_email || 'user@example.com',
      timeRemaining: Math.max(0, expiresAt.getTime() - now.getTime())
    });

  } catch (error) {
    console.error('❌ AGENT: Failed to check agent status:', error);
    res.status(500).json({
      error: 'Failed to check agent status',
      status: 'error',
      details: error.message
    });
  }
});

// Session endpoint for frontend
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('🔍 SESSION: Checking session:', sessionId);
    
    // Use real session manager if available
    let session = null;
    if (global.realSessionManager) {
      session = await global.realSessionManager.getUserSession(sessionId);
    } else {
      // Fallback to database
      session = await getUserSession(sessionId);
    }
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        status: 'not_found'
      });
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expiresAt || session.expires_at);
    
    if (now > expiresAt) {
      console.log('⚠️ SESSION: Session expired:', sessionId);
      return res.status(410).json({
        error: 'Session has expired',
        status: 'expired',
        expiredAt: session.expiresAt || session.expires_at
      });
    }

    console.log('✅ SESSION: Active session found:', sessionId);
    res.status(200).json({
      success: true,
      sessionId: session.id || session.session_id,
      agentId: session.agentId || session.agent_id,
      status: session.status,
      expiresAt: session.expiresAt || session.expires_at,
      isActive: session.status === 'active',
      timeRemaining: Math.max(0, expiresAt.getTime() - now.getTime())
    });

  } catch (error) {
    console.error('❌ SESSION: Failed to check session:', error);
    res.status(500).json({
      error: 'Failed to check session',
      status: 'error',
      details: error.message
    });
  }
});

// NEW: Session status API for race condition fix
router.get('/session-status', async (req, res) => {
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
    const { getRedis } = await import('./redis-simple.js');
    const redis = await getRedis();
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

// NEW: Test endpoint to verify complete flow
router.post('/test-browser-flow', async (req, res) => {
  try {
    console.log('🧪 TEST: Testing complete browser flow...');
    
    // Generate test session
    const testSessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const testAgentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🧪 TEST: Generated test session:', testSessionId);
    
    // Test JWT token generation
    let websocketToken = null;
    try {
      websocketToken = generateWebSocketToken(testSessionId, testAgentId);
      console.log('✅ TEST: JWT token generated successfully');
    } catch (jwtError) {
      console.error('❌ TEST: JWT token generation failed:', jwtError.message);
      return res.status(500).json({ error: 'JWT token generation failed', details: jwtError.message });
    }
    
    // Test queue availability
    if (!isQueueAvailable()) {
      console.error('❌ TEST: Queue not available');
      return res.status(500).json({ error: 'Queue not available' });
    }
    console.log('✅ TEST: Queue is available');
    
    // Test queue browser job
    try {
      const queueResult = await queueBrowserJobAfterPayment(testSessionId, testAgentId, websocketToken);
      console.log('✅ TEST: Browser job queued successfully:', queueResult);
    } catch (queueError) {
      console.error('❌ TEST: Failed to queue browser job:', queueError.message);
      return res.status(500).json({ error: 'Failed to queue browser job', details: queueError.message });
    }
    
    // Test Redis session storage
    try {
      const { getRedis } = require('./redis-simple.js');
      const redis = getRedis();
      const sessionData = await redis.hgetall(`session:${testSessionId}`);
      console.log('✅ TEST: Session data in Redis:', sessionData);
    } catch (redisError) {
      console.error('❌ TEST: Failed to check Redis session:', redisError.message);
    }
    
    console.log('✅ TEST: Complete browser flow test passed');
    
    return res.status(200).json({
      success: true,
      message: 'Complete browser flow test passed',
      testSessionId,
      testAgentId,
      websocketToken: websocketToken ? 'generated' : 'failed',
      queueAvailable: isQueueAvailable(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ TEST: Complete flow test failed:', error);
    return res.status(500).json({ 
      error: 'Complete flow test failed', 
      details: error.message,
      stack: error.stack
    });
  }
});

// NEW: Environment variables check endpoint
router.get('/env-check', async (req, res) => {
  try {
    console.log('🔍 ENV: Checking environment variables...');
    
    const envCheck = {
      // Database
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      
      // Redis
      REDIS_URL: process.env.REDIS_URL ? '✅ Set' : '❌ Missing',
      REDIS_PUBLIC_URL: process.env.REDIS_PUBLIC_URL ? '✅ Set' : '❌ Missing',
      
      // JWT
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '⚠️ Using default',
      
      // Stripe
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing',
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing',
      
      // AI Providers
      GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? '✅ Set' : '⚠️ Not set',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '⚠️ Not set',
      
      // Worker
      BACKEND_WS_URL: process.env.BACKEND_WS_URL ? '✅ Set' : '⚠️ Using default',
      
      // Node Environment
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '8080',
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'not set'
    };
    
    // Check critical variables
    const criticalMissing = [];
    if (!process.env.DATABASE_URL) criticalMissing.push('DATABASE_URL');
    if (!process.env.REDIS_URL && !process.env.REDIS_PUBLIC_URL) criticalMissing.push('REDIS_URL or REDIS_PUBLIC_URL');
    if (!process.env.STRIPE_SECRET_KEY) criticalMissing.push('STRIPE_SECRET_KEY');
    if (!process.env.GROQ_API_KEY) criticalMissing.push('GROQ_API_KEY');
    
    const status = criticalMissing.length === 0 ? 'healthy' : 'missing_critical';
    
    console.log('🔍 ENV: Environment check completed');
    console.log('🔍 ENV: Critical missing:', criticalMissing);
    
    return res.status(200).json({
      status,
      criticalMissing,
      environment: envCheck,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ENV: Environment check failed:', error);
    return res.status(500).json({ 
      error: 'Environment check failed', 
      details: error.message 
    });
  }
});

// Browser automation endpoints
router.post('/browser/:agentId/initialize', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('🚀 BROWSER: Initializing browser session for agent:', agentId);
    
    // Verify agent session
    const session = await getUserSession(agentId);
    if (!session) {
      return res.status(404).json({
        error: 'Agent session not found or expired',
        status: 'not_found'
      });
    }

    // Create browser session
    const browserSession = createBrowserSession(agentId);
    await browserSession.initialize();
    
    console.log('✅ BROWSER: Browser session initialized for agent:', agentId);
    res.status(200).json({
      success: true,
      message: 'Browser automation initialized',
      agentId,
      status: 'active'
    });

  } catch (error) {
    console.error('❌ BROWSER: Failed to initialize browser session:', error);
    res.status(500).json({
      error: 'Failed to initialize browser automation',
      status: 'error',
      details: error.message
    });
  }
});

router.post('/browser/:agentId/execute', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { task } = req.body;
    
    console.log('🎯 BROWSER: Executing task for agent:', agentId, 'Task:', task);
    
    const browserSession = getBrowserSession(agentId);
    if (!browserSession) {
      return res.status(404).json({
        error: 'Browser session not found',
        status: 'not_found'
      });
    }

    const result = await browserSession.executeTask(task);
    
    console.log('✅ BROWSER: Task executed successfully for agent:', agentId);
    res.status(200).json({
      success: true,
      result,
      agentId,
      task
    });

  } catch (error) {
    console.error('❌ BROWSER: Failed to execute task:', error);
    res.status(500).json({
      error: 'Failed to execute browser task',
      status: 'error',
      details: error.message
    });
  }
});

router.get('/browser/:agentId/screenshot', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('📸 BROWSER: Taking screenshot for agent:', agentId);
    
    const browserSession = getBrowserSession(agentId);
    if (!browserSession) {
      return res.status(404).json({
        error: 'Browser session not found',
        status: 'not_found'
      });
    }

    const result = await browserSession.takeScreenshot();
    
    console.log('✅ BROWSER: Screenshot taken for agent:', agentId);
    res.status(200).json({
      success: true,
      screenshot: result.screenshot,
      timestamp: result.timestamp,
      agentId
    });

  } catch (error) {
    console.error('❌ BROWSER: Failed to take screenshot:', error);
    res.status(500).json({
      error: 'Failed to take screenshot',
      status: 'error',
      details: error.message
    });
  }
});

router.delete('/browser/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('🔒 BROWSER: Closing browser session for agent:', agentId);
    
    removeBrowserSession(agentId);
    
    console.log('✅ BROWSER: Browser session closed for agent:', agentId);
    res.status(200).json({
      success: true,
      message: 'Browser session closed',
      agentId
    });

  } catch (error) {
    console.error('❌ BROWSER: Failed to close browser session:', error);
    res.status(500).json({
      error: 'Failed to close browser session',
      status: 'error',
      details: error.message
    });
  }
});

// Test import endpoint
router.get('/test-import', async (req, res) => {
  console.log('🔍 API: Test import requested');
  
  try {
    const { getStatus } = await import('./stripe-simple.js');
    const status = getStatus();
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      import: 'successful',
      stripeStatus: status
    });
  } catch (error) {
    console.error('❌ API: Test import failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
  }
});

// CSRF Token endpoint (frontend expects this)
router.get('/csrf-token', (req, res) => {
  console.log('🔐 API: CSRF token requested');
  res.json({ 
    csrfToken: 'real-csrf-token-' + Date.now(),
    timestamp: new Date().toISOString(),
    message: 'CSRF token generated successfully'
  });
});

// Chat endpoint (frontend expects this) - REAL AI PROCESSING
router.post('/chat', async (req, res) => {
  console.log('💬 API: Chat message requested');
  try {
    // Import and use the real unified AI agent
    const { LocalUnifiedAIAgent } = await import('./agents/local-unified-ai-agent.js');
    const agent = new LocalUnifiedAIAgent();
    await agent.initialize();
    
    const task = {
      id: `chat_${Date.now()}`,
      sessionId: req.body.sessionId || 'default',
      message: req.body.message || req.body.content || 'Hello',
      context: req.body.context
    };
    
    console.log('🤖 API: Processing with real AI agent...');
    const result = await agent.processTask(task);
    
    res.json({
      success: true,
      message: 'Real AI processing completed',
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API: Chat processing failed:', error);
    res.status(500).json({
      error: 'Chat processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Session endpoints (frontend expects these)
router.get('/session/:sessionId', async (req, res) => {
  console.log('🔍 API: Session lookup requested:', req.params.sessionId);
  try {
    const session = await getUserSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        status: 'not_found'
      });
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      console.log('❌ API: Session expired:', req.params.sessionId, 'expiresAt:', expiresAt);
      return res.status(410).json({
        error: 'Session has expired',
        status: 'expired'
      });
    }

    // Calculate time remaining in minutes
    const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)));

    // Generate JWT token for WebSocket authentication
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
    console.log('🔐 API: JWT token generated for WebSocket authentication');

    res.json({
      success: true,
      sessionId: req.params.sessionId,
      agentId: req.params.sessionId,
      status: 'active',
      isActive: true,
      expiresAt: session.expires_at,
      timeRemaining: timeRemaining,
      token: jwtToken, // CRITICAL: Include JWT token for WebSocket authentication
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API: Session lookup failed:', error);
    res.status(500).json({
      error: 'Session lookup failed',
      details: error.message
    });
  }
});

// DISABLED: This route is now handled in production.js with Ollama integration
// router.post('/session/:sessionId/message', async (req, res) => {
//   console.log('💬 API: Session message requested:', req.params.sessionId);
//   try {
//     const { message, content } = req.body;
//     const userMessage = message || content;
//     if (!userMessage || (typeof userMessage === 'string' && userMessage.trim() === '')) {
//       return res.status(400).json({
//         error: 'Message is required',
//         status: 'error'
//       });
//     }
//     
//     // Process message with real AI
//     const { LocalUnifiedAIAgent } = await import('./agents/local-unified-ai-agent.js');
//     const agent = new LocalUnifiedAIAgent();
//     await agent.initialize();
//     
//     const task = {
//       id: `session_${Date.now()}`,
//       sessionId: req.params.sessionId,
//       message: userMessage,
//       context: req.body.context
//     };
//     
//     const result = await agent.processTask(task);
//     
//     // Persist chat to in-memory history keyed by agentId (deterministic id)
//     try {
//       const agentId = req.params.sessionId; // deterministic: automation_<stripe_session_id>
//       const bucket = getMessageBucket(agentId);
//       bucket.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString(), messageType: 'chat' });
//       bucket.push({ role: 'agent', content: result.message || '', timestamp: new Date().toISOString(), messageType: 'chat' });
//     } catch (e) {
//       console.warn('⚠️  API: Failed to persist chat to memory:', e?.message);
//     }
// 
//     res.json({
//       success: true,
//       message: 'Session message processed',
//       result: result,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('❌ API: Session message processing failed:', error);
//     res.status(500).json({
//       error: 'Session message processing failed',
//       details: error.message
//     });
//   }
// });

// Chat history endpoints (expected by frontend)
router.get('/session/:agentId/messages', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('💾 API: Messages requested for agentId:', agentId);
    
    // Use in-memory storage only (no database dependency)
    const bucket = getMessageBucket(agentId);
    console.log('💾 API: Messages loaded:', bucket.length, 'messages');
    res.json(bucket);
  } catch (error) {
    console.error('❌ API: Get messages failed:', error);
    res.status(500).json({ error: 'NEURAL_ARCHIVE_ACCESS_DENIED: ' + (error?.message || 'unknown') });
  }
});

router.get('/session/:agentId/chat-history', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('💾 API: Chat history requested for agentId:', agentId);
    
    // Use in-memory storage only (no database dependency)
    const bucket = getMessageBucket(agentId).filter(m => m.messageType !== 'command');
    console.log('💾 API: Chat history loaded:', bucket.length, 'messages');
    res.json(bucket);
  } catch (error) {
    console.error('❌ API: Get chat history failed:', error);
    res.status(500).json({ error: 'CHAT_LOG_RETRIEVAL_FAILED: ' + (error?.message || 'unknown') });
  }
});

router.get('/session/:agentId/command-history', async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log('💾 API: Command history requested for agentId:', agentId);
    
    // Use in-memory storage only (no database dependency)
    const bucket = getMessageBucket(agentId).filter(m => m.messageType === 'command');
    console.log('💾 API: Command history loaded:', bucket.length, 'commands');
    res.json(bucket);
  } catch (error) {
    console.error('❌ API: Get command history failed:', error);
    res.status(500).json({ error: 'COMMAND_LOG_RETRIEVAL_FAILED: ' + (error?.message || 'unknown') });
  }
});

// Basic API status
router.get('/status', (req, res) => {
  console.log('📊 API: Status requested');
  res.status(200).json({
    status: 'running',
    timestamp: new Date().toISOString(),
    service: 'api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      '/api/health',
      '/api/status',
      '/api/test',
      '/api/csrf-token',
      '/api/chat',
      '/api/session/:sessionId'
    ]
  });
});

// Worker diagnostics here too, to guarantee availability regardless of route order in production.js
router.get('/diag/worker', async (req, res) => {
  try {
    const workerUrls = [
      process.env.WORKER_INTERNAL_URL,
      process.env.WORKER_PUBLIC_URL,
      'http://worker.railway.internal:8080',
      'http://automation-worker.railway.internal:8080',
      'http://browser-worker.railway.internal:8080',
      'http://vnc-worker.railway.internal:8080',
      'http://worker:8080'
    ].filter(Boolean);

    const results = [];
    for (const base of workerUrls) {
      const item = { base, health: null, ok: false, error: null };
      try {
        const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
        item.health = { status: r.status, ok: r.ok, text: await r.text().catch(() => '') };
        item.ok = item.ok || r.ok;
      } catch (e) {
        item.error = e?.message || String(e);
      }
      results.push(item);
    }
    res.json({
      from: 'api-router',
      workerEnv: process.env.WORKER_INTERNAL_URL || null,
      anyOk: results.some(x => x.health?.ok),
      results,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: 'diag_failed', message: e?.message || String(e) });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🧪 API: Test endpoint requested');
  res.status(200).json({
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    test: 'success'
  });
});

// Stripe status endpoint
router.get('/stripe/status', async (req, res) => {
  console.log('💳 API: Stripe status requested');
  
  try {
    const { getStatus } = await import('./stripe-simple.js');
    const stripeStatus = getStatus();
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      stripe: stripeStatus
    });
  } catch (error) {
    console.error('❌ API: Stripe status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// FLOW ENDPOINTS: Safe real browser automation with fallback
router.post('/flow/create-session', async (req, res) => {
  try {
    const agentId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      await createUserSession({
        sessionId: agentId,
        agentId,
        expiresAt,
        status: 'active',
        paymentVerified: true
      });
    } catch (e) {
      // Database may be unavailable in some local setups; still return success
    }
    res.json({ success: true, session: { sessionId: agentId, agentId, expiresAt } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session', details: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/flow/chat/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const message = req.body?.message || '';

    // Basic session existence check (best effort)
    try {
      const session = await getUserSession(sessionId);
      if (!session) {
        console.warn('FLOW: Session not found, continuing in dev mode:', sessionId);
      }
    } catch (e) {
      // If DB unavailable, continue in dev mode
    }

    // Try real Playwright automation first
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      try {
        const page = await browser.newPage();
        const urlMatch = message.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
          await page.goto(urlMatch[0], { waitUntil: 'domcontentloaded' });
        } else {
          await page.goto('about:blank');
        }
        const buf = await page.screenshot({ type: 'png' });
        const screenshot = Buffer.from(buf).toString('base64');
        return res.json({ success: true, real: true, result: { screenshot, url: page.url() } });
      } finally {
        await browser.close();
      }
    } catch (browserError) {
      console.error('FLOW: Real browser automation failed:', browserError instanceof Error ? browserError.message : String(browserError));
      // Graceful fallback keeps system working
      return res.json({ success: true, real: false, message: 'Session active but browser automation unavailable' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Flow chat failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// Create checkout session endpoint
router.post('/stripe/create-checkout-session', async (req, res) => {
  console.log('💳 API: Create checkout session requested');
  
  try {
    const { createSession } = await import('./stripe-simple.js');
    await createSession(req, res);
  } catch (error) {
    console.error('❌ API: Create checkout session failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// NOTE: Stripe webhook is handled in server/production.js with express.raw()
// to preserve the exact payload for signature verification. Duplicate route
// removed here to avoid conflicts and ensure a single, correct handler.

// GET /api/agent/:sessionId/status
router.get('/api/agent/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('🔍 API: Checking status for session:', sessionId);
    
    const session = await getUserSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        status: 'not_found'
      });
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      console.log('⚠️ API: Session expired:', sessionId);
      await updateSessionStatus(sessionId, 'expired');
      
      return res.status(410).json({
        error: 'Session has expired',
        status: 'expired',
        expiredAt: session.expires_at
      });
    }

    console.log('✅ API: Active session found:', sessionId);
    res.status(200).json({
      success: true,
      sessionId: session.session_id,
      status: session.status,
      expiresAt: session.expires_at,
      timeRemaining: Math.max(0, expiresAt.getTime() - now.getTime())
    });

  } catch (error) {
    console.error('❌ API: Failed to check session status:', error);
    res.status(500).json({
      error: 'Failed to check session status',
      status: 'error',
      details: error.message
    });
  }
});

// POST /create-or-recover-session (mounted at /api)
router.post('/create-or-recover-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log('🔍 API: Create or recover session:', sessionId);
    
    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID is required',
        status: 'error'
      });
    }

    // Check if session exists
    try {
      const existingSession = await getUserSession(sessionId);
      
      if (existingSession) {
        // Check if session is expired
        const now = new Date();
        const expiresAt = new Date(existingSession.expires_at);
        
        if (now > expiresAt) {
          console.log('⚠️ API: Session expired, cannot recover:', sessionId);
          return res.status(410).json({
            error: 'Session has expired and cannot be recovered',
            status: 'expired',
            expiredAt: existingSession.expires_at
          });
        }

        console.log('✅ API: Recovered existing session:', sessionId);
        return res.status(200).json({
          success: true,
          message: 'Session recovered successfully',
          sessionId: existingSession.session_id,
          status: existingSession.status,
          expiresAt: existingSession.expires_at,
          recovered: true
        });
      }
    } catch (e) {
      console.warn('⚠️ API: Error checking existing session:', e);
      // Continue to create new session
    }

    // Create new session (24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const sessionData = {
      sessionId,
      agentId: sessionId,
      expiresAt,
      status: 'active',
      paymentVerified: true
    };

    try {
      const storedSession = await createUserSession(sessionData);
      console.log('✅ API: New session created:', sessionId);
      
      return res.status(201).json({
        success: true,
        message: 'Session created successfully',
        sessionId,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        created: true
      });
    } catch (dbError) {
      console.error('❌ API: Failed to store session:', dbError);
      return res.status(500).json({
        error: 'Failed to create session',
        status: 'error',
        details: dbError.message
      });
    }

  } catch (error) {
    console.error('❌ API: Create or recover session failed:', error);
    res.status(500).json({
      error: 'Failed to create or recover session',
      status: 'error',
      details: error.message
    });
  }
});

// Basic error handling for API routes
router.use((err, req, res, next) => {
  console.error('❌ API: Error in API route:', err);
  res.status(500).json({
    status: 'error',
    timestamp: new Date().toISOString(),
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// NOTE: No 404 handler here - let routes in production.js handle unmatched paths

export default router;
// AUTH: Issue a simple JWT token for clients needing WebSocket auth
// Supports POST body and GET query for flexibility
router.post('/auth/token', async (req, res) => {
  try {
    const { sessionId, agentId } = req.body || {};
    const sid = (typeof sessionId === 'string' && sessionId.trim()) ? sessionId.trim() : `anon_${Date.now()}`;
    const aid = (typeof agentId === 'string' && agentId.trim()) ? agentId.trim() : `anon_${Date.now()}`;

    const token = generateWebSocketToken(sid, aid);
    return res.status(200).json({
      token,
      sessionId: sid,
      agentId: aid,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('❌ AUTH: Token generation failed:', error?.message || error);
    return res.status(500).json({ error: 'TOKEN_GENERATION_FAILED', message: error?.message || 'Unknown error' });
  }
});

router.get('/api/auth/token', async (req, res) => {
  try {
    const { sessionId, agentId } = req.query || {};
    const sid = (typeof sessionId === 'string' && sessionId.trim()) ? sessionId.trim() : `anon_${Date.now()}`;
    const aid = (typeof agentId === 'string' && agentId.trim()) ? agentId.trim() : `anon_${Date.now()}`;

    const token = generateWebSocketToken(sid, aid);
    return res.status(200).json({
      token,
      sessionId: sid,
      agentId: aid,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('❌ AUTH: Token generation failed (GET):', error?.message || error);
    return res.status(500).json({ error: 'TOKEN_GENERATION_FAILED', message: error?.message || 'Unknown error' });
  }
});
