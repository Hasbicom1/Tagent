/**
 * AUTOMATION SESSION API ROUTES
 * Handles $1 automation session endpoints
 */

import { Router } from 'express';
import { sessionManager } from '../session/session-manager.js';
import { invisibleOrchestrator } from '../automation/invisible-orchestrator.js';
// WebSocket utility function
const sendRealTimeUpdate = (io, event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`⬆️ WebSocket: Sent event "${event}" with data:`, data);
  } else {
    console.warn(`⚠️ WebSocket: Socket.IO instance not available to send event "${event}".`);
  }
};

export const createAutomationSessionRoutes = (io) => {
  const router = Router();

  /**
   * Create automation session after payment
   */
  router.post('/create-session', async (req, res) => {
    try {
      const { paymentData } = req.body;
      
      if (!paymentData) {
        return res.status(400).json({
          success: false,
          error: 'Payment data is required'
        });
      }

      const sessionResult = await sessionManager.createAutomationSession(paymentData);
      
      if (sessionResult.success) {
        res.json(sessionResult);
      } else {
        res.status(500).json(sessionResult);
      }
      
    } catch (error) {
      console.error('❌ AUTOMATION SESSION: Failed to create session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create automation session',
        details: error.message
      });
    }
  });

  /**
   * Get session status
   */
  router.get('/:sessionId/status', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const status = await sessionManager.getSessionStatus(sessionId);
      res.json(status);
    } catch (error) {
      console.error('❌ AUTOMATION SESSION: Failed to get session status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session status',
        details: error.message
      });
    }
  });

  /**
   * Execute automation command
   */
  router.post('/:sessionId/execute', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { command, context = {} } = req.body;
      
      if (!command) {
        return res.status(400).json({
          success: false,
          error: 'Command is required'
        });
      }

      // Validate session
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found or expired',
          sessionExpired: true
        });
      }

      // Execute command with invisible orchestrator
      const result = await invisibleOrchestrator.executeCommand(sessionId, command, context);
      
      // Send real-time updates via WebSocket
      if (io) {
        sendRealTimeUpdate(io, 'automation_start', {
          sessionId,
          command,
          timestamp: new Date().toISOString()
        });
        
        if (result.success) {
          sendRealTimeUpdate(io, 'automation_complete', {
            sessionId,
            result,
            timestamp: new Date().toISOString()
          });
        } else {
          sendRealTimeUpdate(io, 'automation_error', {
            sessionId,
            error: result.error,
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json(result);
      
    } catch (error) {
      console.error('❌ AUTOMATION SESSION: Failed to execute command:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute command',
        details: error.message
      });
    }
  });

  /**
   * Get session screenshot
   */
  router.get('/:sessionId/screenshot', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Validate session
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found or expired'
        });
      }

      // Get current browser screenshot
      const { BrowserEngine } = await import('../automation/real-browser-engine.js');
      const browserEngine = new BrowserEngine();
      
      try {
        const screenshot = await browserEngine.page?.screenshot({ encoding: 'base64' });
        
        res.json({
          success: true,
          screenshot,
          sessionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.json({
          success: false,
          error: 'Failed to capture screenshot',
          details: error.message
        });
      }
      
    } catch (error) {
      console.error('❌ AUTOMATION SESSION: Failed to get screenshot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get screenshot',
        details: error.message
      });
    }
  });

  /**
   * Get session metrics
   */
  router.get('/:sessionId/metrics', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const status = await sessionManager.getSessionStatus(sessionId);
      
      if (!status.success) {
        return res.status(404).json(status);
      }

      const metrics = {
        session: status.session,
        agentStats: invisibleOrchestrator.getAgentStats(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        metrics
      });
      
    } catch (error) {
      console.error('❌ AUTOMATION SESSION: Failed to get metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics',
        details: error.message
      });
    }
  });

  /**
   * Health check for automation system
   */
  router.get('/health', (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        sessionManager: 'active',
        invisibleOrchestrator: 'active',
        webSocket: io ? 'connected' : 'disconnected'
      },
      activeSessions: sessionManager.getActiveSessions().length,
      availableAgents: invisibleOrchestrator.getAvailableAgents().length
    };

    res.json(health);
  });

  return router;
};
