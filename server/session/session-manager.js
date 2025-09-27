/**
 * PRODUCTION SESSION MANAGER
 * Manages $1 automation sessions with 24-hour expiration
 */

import { createUserSession, getUserSession, updateSessionStatus } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

export class ProductionSessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.sessionCleanupInterval = null;
    this.startSessionCleanup();
  }

  /**
   * Create new automation session after successful payment
   */
  async createAutomationSession(paymentData) {
    try {
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const sessionData = {
        sessionId,
        userId: paymentData.userId || paymentData.customer_email,
        paymentId: paymentData.payment_intent_id || paymentData.id,
        status: 'active',
        createdAt: new Date(),
        expiresAt,
        usage: {
          commandsExecuted: 0,
          browserActions: 0,
          screenshots: 0
        },
        settings: {
          headless: false, // Show browser to user
          viewport: { width: 1280, height: 720 },
          timeout: 30000
        }
      };

      // Store in database
      await createUserSession(sessionData);
      
      // Store in memory for fast access
      this.activeSessions.set(sessionId, sessionData);
      
      console.log(`✅ SESSION: Created automation session ${sessionId} for user ${sessionData.userId}`);
      
      return {
        success: true,
        sessionId,
        sessionUrl: `/automation/${sessionId}`,
        expiresAt: expiresAt.toISOString(),
        message: 'Automation session created successfully'
      };
      
    } catch (error) {
      console.error('❌ SESSION: Failed to create automation session:', error);
      return {
        success: false,
        error: 'Failed to create automation session',
        details: error.message
      };
    }
  }

  /**
   * Get session by ID with validation
   */
  async getSession(sessionId) {
    try {
      // Check memory first
      if (this.activeSessions.has(sessionId)) {
        const session = this.activeSessions.get(sessionId);
        if (new Date() > new Date(session.expiresAt)) {
          this.activeSessions.delete(sessionId);
          return null;
        }
        return session;
      }

      // Check database
      const session = await getUserSession(sessionId);
      if (!session) {
        return null;
      }

      // Check if expired
      if (new Date() > new Date(session.expiresAt)) {
        await this.expireSession(sessionId);
        return null;
      }

      // Load into memory
      this.activeSessions.set(sessionId, session);
      return session;
      
    } catch (error) {
      console.error('❌ SESSION: Failed to get session:', error);
      return null;
    }
  }

  /**
   * Execute automation command in session
   */
  async executeCommand(sessionId, command, context = {}) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found or expired',
          sessionExpired: true
        };
      }

      // Update usage stats
      session.usage.commandsExecuted++;
      session.usage.browserActions++;
      
      // Update session in database
      await updateSessionStatus(sessionId, {
        usage: session.usage,
        lastActivity: new Date()
      });

      console.log(`🎯 SESSION: Executing command "${command}" in session ${sessionId}`);
      
      return {
        success: true,
        sessionId,
        command,
        usage: session.usage,
        message: 'Command queued for execution'
      };
      
    } catch (error) {
      console.error('❌ SESSION: Failed to execute command:', error);
      return {
        success: false,
        error: 'Failed to execute command',
        details: error.message
      };
    }
  }

  /**
   * Get session status and metrics
   */
  async getSessionStatus(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found or expired'
        };
      }

      const timeRemaining = new Date(session.expiresAt) - new Date();
      
      return {
        success: true,
        session: {
          id: session.sessionId,
          status: session.status,
          expiresAt: session.expiresAt,
          timeRemaining: Math.max(0, timeRemaining),
          usage: session.usage,
          createdAt: session.createdAt
        }
      };
      
    } catch (error) {
      console.error('❌ SESSION: Failed to get session status:', error);
      return {
        success: false,
        error: 'Failed to get session status',
        details: error.message
      };
    }
  }

  /**
   * Expire session manually
   */
  async expireSession(sessionId) {
    try {
      await updateSessionStatus(sessionId, { status: 'expired' });
      this.activeSessions.delete(sessionId);
      console.log(`⏰ SESSION: Expired session ${sessionId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ SESSION: Failed to expire session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start automatic session cleanup
   */
  startSessionCleanup() {
    this.sessionCleanupInterval = setInterval(async () => {
      const now = new Date();
      const expiredSessions = [];
      
      for (const [sessionId, session] of this.activeSessions) {
        if (now > new Date(session.expiresAt)) {
          expiredSessions.push(sessionId);
        }
      }
      
      for (const sessionId of expiredSessions) {
        await this.expireSession(sessionId);
      }
      
      if (expiredSessions.length > 0) {
        console.log(`🧹 SESSION: Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get all active sessions (for monitoring)
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values());
  }
}

// Export singleton instance
export const sessionManager = new ProductionSessionManager();
