const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { createClient } = require('redis');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

// Redis connection
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch(console.error);

// ============================================
// CHECKOUT SUCCESS ENDPOINT
// ============================================
router.post('/checkout-success', async (req, res) => {
  const { sessionId: stripeSessionId } = req.body;

  console.log('💳 Processing checkout success:', stripeSessionId);

  if (!stripeSessionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing sessionId' 
    });
  }

  try {
    // Generate unique agent session ID
    const agentSessionId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const agentId = `${stripeSessionId.slice(-15)}`;
    const expiresAt = new Date(Date.now() + JWT_EXPIRY * 1000);

    // Generate JWT token
    const token = jwt.sign(
      { 
        sessionId: agentSessionId, 
        agentId,
        stripeSessionId,
        exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY
      },
      JWT_SECRET
    );

    console.log('🔑 JWT Token generated:', {
      sessionId: agentSessionId,
      agentId,
      expiresAt
    });

    // Store session in PostgreSQL
    await pool.query(`
      INSERT INTO sessions (session_id, agent_id, status, expires_at, payment_verified, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (session_id) 
      DO UPDATE SET 
        payment_verified = true,
        status = 'active',
        updated_at = NOW()
    `, [agentSessionId, agentId, 'active', expiresAt, true]);

    // Store session data in Redis
    await redisClient.setEx(
      `session:${agentSessionId}`,
      JWT_EXPIRY,
      JSON.stringify({
        sessionId: agentSessionId,
        agentId,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        token,
        createdAt: new Date().toISOString()
      })
    );

    console.log('✅ Session created successfully:', agentSessionId);

    res.json({ 
      success: true, 
      sessionId: agentSessionId,
      agentId,
      token,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing checkout:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process checkout' 
    });
  }
});

// ============================================
// SESSION STATUS ENDPOINT
// ============================================
router.get('/session-status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');

  console.log('🔍 Checking session status:', sessionId);

  try {
    // Verify JWT token if provided
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.sessionId !== sessionId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Token does not match session' 
          });
        }
      } catch (error) {
        console.error('❌ Invalid token:', error.message);
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid or expired token' 
        });
      }
    }

    // Get session from Redis first (faster)
    let sessionData = await redisClient.get(`session:${sessionId}`);
    
    if (sessionData) {
      sessionData = JSON.parse(sessionData);
      console.log('✅ Session found in Redis:', sessionId);
      
      return res.json({
        success: true,
        status: sessionData.status,
        expiresAt: sessionData.expiresAt,
        agentId: sessionData.agentId
      });
    }

    // Fallback to PostgreSQL
    const result = await pool.query(
      'SELECT status, expires_at, agent_id FROM sessions WHERE session_id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    const session = result.rows[0];
    console.log('✅ Session found in PostgreSQL:', sessionId);

    res.json({
      success: true,
      status: session.status,
      expiresAt: session.expires_at,
      agentId: session.agent_id
    });

  } catch (error) {
    console.error('❌ Error checking session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check session status' 
    });
  }
});

// ============================================
// REFRESH TOKEN ENDPOINT
// ============================================
router.post('/refresh-token', async (req, res) => {
  const { token: oldToken } = req.body;

  if (!oldToken) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing token' 
    });
  }

  try {
    // Verify old token (even if expired)
    const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
    
    // Check if session still exists
    const sessionData = await redisClient.get(`session:${decoded.sessionId}`);
    
    if (!sessionData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session expired or not found' 
      });
    }

    // Generate new token
    const newToken = jwt.sign(
      { 
        sessionId: decoded.sessionId, 
        agentId: decoded.agentId,
        exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY
      },
      JWT_SECRET
    );

    console.log('🔄 Token refreshed for session:', decoded.sessionId);

    res.json({ 
      success: true, 
      token: newToken 
    });

  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
});

// ============================================
// DEBUG ENDPOINTS
// ============================================
router.get('/debug/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Get from Redis
    const redisData = await redisClient.get(`session:${sessionId}`);
    
    // Get from PostgreSQL
    const pgResult = await pool.query(
      'SELECT * FROM sessions WHERE session_id = $1',
      [sessionId]
    );

    res.json({
      redis: redisData ? JSON.parse(redisData) : null,
      postgres: pgResult.rows[0] || null
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;