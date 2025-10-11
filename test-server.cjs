const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 5000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = 24 * 60 * 60; // 24 hours

// Middleware
app.use(cors());
app.use(express.json());

// In-memory session storage (for testing)
const sessions = new Map();

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    sessions: sessions.size
  });
});

// ============================================
// CREATE TEST SESSION
// ============================================
app.post('/api/create-session', (req, res) => {
  try {
    const agentSessionId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const agentId = `test_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + JWT_EXPIRY * 1000);

    // Generate JWT token
    const token = jwt.sign(
      { 
        sessionId: agentSessionId, 
        agentId,
        exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY
      },
      JWT_SECRET
    );

    // Store in memory
    sessions.set(agentSessionId, {
      sessionId: agentSessionId,
      agentId,
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      token,
      createdAt: new Date().toISOString()
    });

    console.log('✅ Test session created:', agentSessionId);

    res.json({ 
      success: true, 
      sessionId: agentSessionId,
      agentId,
      token,
      expiresAt: expiresAt.toISOString(),
      instructions: `Use this URL: /live/agent/${agentSessionId}`
    });

  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create session' 
    });
  }
});

// ============================================
// AGENT STATUS ENDPOINT (CRITICAL FIX)
// ============================================
app.get('/api/agent/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');

  console.log('🔍 Checking agent status:', sessionId);

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

    // Get session from memory
    const sessionData = sessions.get(sessionId);
    
    if (!sessionData) {
      console.error('❌ Session not found:', sessionId);
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found',
        message: 'This agent session does not exist or has expired'
      });
    }

    console.log('✅ Agent session found:', sessionId);

    // Check if expired
    const isExpired = new Date(sessionData.expiresAt) < new Date();
    
    if (isExpired) {
      sessions.delete(sessionId);
      return res.status(410).json({ 
        success: false, 
        error: 'Session expired',
        expiresAt: sessionData.expiresAt
      });
    }

    res.json({
      success: true,
      status: sessionData.status,
      agentId: sessionData.agentId,
      expiresAt: sessionData.expiresAt,
      isActive: sessionData.status === 'active',
      timeRemaining: Math.floor((new Date(sessionData.expiresAt) - new Date()) / 1000)
    });

  } catch (error) {
    console.error('❌ Error checking agent status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check agent status' 
    });
  }
});

// ============================================
// DEBUG ENDPOINTS
// ============================================
app.get('/api/debug/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = sessions.get(sessionId);
  
  res.json({
    session: sessionData || null,
    exists: !!sessionData,
    totalSessions: sessions.size
  });
});

app.get('/api/debug/all-sessions', (req, res) => {
  const allSessions = Array.from(sessions.values());
  res.json({
    sessions: allSessions,
    count: allSessions.length
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(port, () => {
  console.log('🚀 TEST SERVER: Starting emergency session fix server...');
  console.log(`🌐 Server running on port ${port}`);
  console.log('🌐 Health endpoint: http://localhost:5000/health');
  console.log('🌐 Create session: POST http://localhost:5000/api/create-session');
  console.log('🌐 Agent status: GET http://localhost:5000/api/agent/:sessionId/status');
  console.log('✅ TEST SERVER: Ready for emergency session recovery!');
});