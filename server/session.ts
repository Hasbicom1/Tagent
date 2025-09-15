import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import crypto from 'crypto';
import { logSecurityEvent } from './security';
import { wsManager } from './websocket';
import { vncProxy } from './vnc-proxy';

// Session Security Configuration
export interface SessionSecurityConfig {
  // Session fixation protection
  regenerateOnLogin: boolean;
  regenerateOnPayment: boolean;
  regenerateOnRoleChange: boolean;
  
  // IP binding and validation
  enableIPBinding: boolean;
  allowIPChanges: boolean;
  maxIPChanges: number;
  ipChangeTimeWindow: number; // milliseconds
  
  // Concurrent session management
  maxConcurrentSessions: number;
  enableSessionKicking: boolean; // kick oldest session when limit exceeded
  
  // Session timeout and cleanup
  idleTimeout: number; // milliseconds
  absoluteTimeout: number; // milliseconds
  cleanupInterval: number; // milliseconds
  
  // Activity tracking
  trackLoginAttempts: boolean;
  trackSessionActivity: boolean;
  suspiciousActivityThreshold: number;
}

export const DEFAULT_SESSION_SECURITY_CONFIG: SessionSecurityConfig = {
  regenerateOnLogin: true,
  regenerateOnPayment: true,
  regenerateOnRoleChange: true,
  
  enableIPBinding: true,
  allowIPChanges: true,
  maxIPChanges: 3,
  ipChangeTimeWindow: 60 * 60 * 1000, // 1 hour
  
  maxConcurrentSessions: 3,
  enableSessionKicking: true,
  
  idleTimeout: 30 * 60 * 1000, // 30 minutes idle
  absoluteTimeout: 24 * 60 * 60 * 1000, // 24 hours absolute
  cleanupInterval: 5 * 60 * 1000, // 5 minutes cleanup
  
  trackLoginAttempts: true,
  trackSessionActivity: true,
  suspiciousActivityThreshold: 10
};

// Session activity tracking
export interface SessionActivity {
  sessionId: string;
  agentId: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  timestamp: Date;
  endpoint?: string;
  metadata?: Record<string, any>;
}

// Session security store for tracking and management
export class SessionSecurityStore {
  private redis: Redis;
  private config: SessionSecurityConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis, config: SessionSecurityConfig = DEFAULT_SESSION_SECURITY_CONFIG) {
    this.redis = redis;
    this.config = config;
    this.startCleanupInterval();
  }

  /**
   * Create secure session with enhanced tracking
   */
  async createSession(sessionData: {
    sessionId: string;
    agentId: string;
    ipAddress: string;
    userAgent: string;
    checkoutSessionId?: string;
  }): Promise<void> {
    const sessionKey = `session:${sessionData.sessionId}`;
    const userSessionsKey = `user_sessions:${sessionData.agentId}`;
    const ipTrackingKey = `ip_tracking:${sessionData.sessionId}`;
    
    const sessionInfo = {
      sessionId: sessionData.sessionId,
      agentId: sessionData.agentId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      checkoutSessionId: sessionData.checkoutSessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipChangeCount: 0,
      activityCount: 0,
      isActive: true
    };

    // Store session info
    await this.redis.setex(
      sessionKey, 
      Math.ceil(this.config.absoluteTimeout / 1000),
      JSON.stringify(sessionInfo)
    );

    // Track user sessions for concurrent session management
    await this.redis.sadd(userSessionsKey, sessionData.sessionId);
    await this.redis.expire(userSessionsKey, Math.ceil(this.config.absoluteTimeout / 1000));

    // Initialize IP tracking
    await this.redis.setex(
      ipTrackingKey,
      Math.ceil(this.config.ipChangeTimeWindow / 1000),
      JSON.stringify({ 
        originalIP: sessionData.ipAddress,
        ipChanges: [],
        changeCount: 0
      })
    );

    // Log session creation
    await this.logSessionActivity({
      sessionId: sessionData.sessionId,
      agentId: sessionData.agentId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      action: 'session_created',
      timestamp: new Date(),
      metadata: { checkoutSessionId: sessionData.checkoutSessionId }
    });

    // Enforce concurrent session limits
    await this.enforceConcurrentSessionLimits(sessionData.agentId);
  }

  /**
   * Regenerate session ID for security
   */
  async regenerateSession(
    oldSessionId: string, 
    newSessionId: string, 
    reason: 'login' | 'payment' | 'role_change' | 'security'
  ): Promise<boolean> {
    try {
      const oldSessionKey = `session:${oldSessionId}`;
      const newSessionKey = `session:${newSessionId}`;
      
      // Get existing session data
      const sessionDataStr = await this.redis.get(oldSessionKey);
      if (!sessionDataStr) {
        return false;
      }

      const sessionData = JSON.parse(sessionDataStr);
      
      // Update session data with new ID
      sessionData.sessionId = newSessionId;
      sessionData.lastActivity = new Date().toISOString();
      sessionData.regeneratedAt = new Date().toISOString();
      sessionData.regenerationReason = reason;

      // Create new session
      await this.redis.setex(
        newSessionKey,
        Math.ceil(this.config.absoluteTimeout / 1000),
        JSON.stringify(sessionData)
      );

      // Update user sessions tracking
      const userSessionsKey = `user_sessions:${sessionData.agentId}`;
      await this.redis.srem(userSessionsKey, oldSessionId);
      await this.redis.sadd(userSessionsKey, newSessionId);

      // Transfer IP tracking
      const oldIPKey = `ip_tracking:${oldSessionId}`;
      const newIPKey = `ip_tracking:${newSessionId}`;
      const ipData = await this.redis.get(oldIPKey);
      if (ipData) {
        await this.redis.setex(
          newIPKey,
          Math.ceil(this.config.ipChangeTimeWindow / 1000),
          ipData
        );
        await this.redis.del(oldIPKey);
      }

      // Remove old session
      await this.redis.del(oldSessionKey);

      // Log session regeneration
      await this.logSessionActivity({
        sessionId: newSessionId,
        agentId: sessionData.agentId,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        action: 'session_regenerated',
        timestamp: new Date(),
        metadata: { 
          oldSessionId, 
          reason,
          previousRegenerationReason: sessionData.regenerationReason 
        }
      });

      logSecurityEvent('session_regenerated', {
        oldSessionId,
        newSessionId,
        agentId: sessionData.agentId,
        reason
      });

      return true;
    } catch (error) {
      console.error('Session regeneration failed:', error);
      return false;
    }
  }

  /**
   * Validate session IP binding
   */
  async validateSessionIP(sessionId: string, currentIP: string): Promise<{
    isValid: boolean;
    requiresAction: boolean;
    reason?: string;
  }> {
    if (!this.config.enableIPBinding) {
      return { isValid: true, requiresAction: false };
    }

    try {
      const sessionKey = `session:${sessionId}`;
      const ipTrackingKey = `ip_tracking:${sessionId}`;
      
      const sessionDataStr = await this.redis.get(sessionKey);
      const ipTrackingStr = await this.redis.get(ipTrackingKey);
      
      if (!sessionDataStr || !ipTrackingStr) {
        return { 
          isValid: false, 
          requiresAction: true, 
          reason: 'session_not_found' 
        };
      }

      const sessionData = JSON.parse(sessionDataStr);
      const ipTracking = JSON.parse(ipTrackingStr);

      // Check if IP has changed
      if (sessionData.ipAddress === currentIP) {
        return { isValid: true, requiresAction: false };
      }

      // IP has changed - check if allowed
      if (!this.config.allowIPChanges) {
        logSecurityEvent('session_ip_change_blocked', {
          sessionId,
          agentId: sessionData.agentId,
          originalIP: sessionData.ipAddress,
          newIP: currentIP
        });
        
        return { 
          isValid: false, 
          requiresAction: true, 
          reason: 'ip_change_not_allowed' 
        };
      }

      // Check IP change limits
      if (ipTracking.changeCount >= this.config.maxIPChanges) {
        logSecurityEvent('session_ip_change_limit_exceeded', {
          sessionId,
          agentId: sessionData.agentId,
          changeCount: ipTracking.changeCount,
          maxChanges: this.config.maxIPChanges
        });
        
        return { 
          isValid: false, 
          requiresAction: true, 
          reason: 'ip_change_limit_exceeded' 
        };
      }

      // Record IP change
      await this.recordIPChange(sessionId, sessionData.agentId, currentIP, sessionData.ipAddress);

      return { isValid: true, requiresAction: false };
    } catch (error) {
      console.error('IP validation error:', error);
      return { 
        isValid: false, 
        requiresAction: true, 
        reason: 'validation_error' 
      };
    }
  }

  /**
   * Record IP address change
   */
  private async recordIPChange(
    sessionId: string, 
    agentId: string, 
    newIP: string, 
    oldIP: string
  ): Promise<void> {
    const ipTrackingKey = `ip_tracking:${sessionId}`;
    const sessionKey = `session:${sessionId}`;
    
    // Update IP tracking
    const ipTrackingStr = await this.redis.get(ipTrackingKey);
    if (ipTrackingStr) {
      const ipTracking = JSON.parse(ipTrackingStr);
      ipTracking.changeCount += 1;
      ipTracking.ipChanges.push({
        from: oldIP,
        to: newIP,
        timestamp: new Date().toISOString()
      });
      
      await this.redis.setex(
        ipTrackingKey,
        Math.ceil(this.config.ipChangeTimeWindow / 1000),
        JSON.stringify(ipTracking)
      );
    }

    // Update session with new IP
    const sessionDataStr = await this.redis.get(sessionKey);
    if (sessionDataStr) {
      const sessionData = JSON.parse(sessionDataStr);
      sessionData.ipAddress = newIP;
      sessionData.ipChangeCount = (sessionData.ipChangeCount || 0) + 1;
      sessionData.lastActivity = new Date().toISOString();
      
      await this.redis.setex(
        sessionKey,
        Math.ceil(this.config.absoluteTimeout / 1000),
        JSON.stringify(sessionData)
      );
    }

    // Log IP change
    await this.logSessionActivity({
      sessionId,
      agentId,
      ipAddress: newIP,
      userAgent: '',
      action: 'ip_changed',
      timestamp: new Date(),
      metadata: { oldIP, newIP }
    });

    logSecurityEvent('session_ip_changed', {
      sessionId,
      agentId,
      oldIP,
      newIP
    });
  }

  /**
   * Update session activity and enforce timeouts
   */
  async updateSessionActivity(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
    endpoint?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionDataStr = await this.redis.get(sessionKey);
      
      if (!sessionDataStr) {
        return { valid: false, reason: 'session_not_found' };
      }

      const sessionData = JSON.parse(sessionDataStr);
      const now = new Date();
      const lastActivity = new Date(sessionData.lastActivity);
      
      // Check idle timeout
      if (now.getTime() - lastActivity.getTime() > this.config.idleTimeout) {
        await this.destroySession(sessionId, 'idle_timeout');
        return { valid: false, reason: 'idle_timeout' };
      }

      // Check absolute timeout
      const createdAt = new Date(sessionData.createdAt);
      if (now.getTime() - createdAt.getTime() > this.config.absoluteTimeout) {
        await this.destroySession(sessionId, 'absolute_timeout');
        return { valid: false, reason: 'absolute_timeout' };
      }

      // Update activity
      sessionData.lastActivity = now.toISOString();
      sessionData.activityCount = (sessionData.activityCount || 0) + 1;
      
      await this.redis.setex(
        sessionKey,
        Math.ceil(this.config.absoluteTimeout / 1000),
        JSON.stringify(sessionData)
      );

      // Log activity if enabled
      if (this.config.trackSessionActivity) {
        await this.logSessionActivity({
          sessionId,
          agentId: sessionData.agentId,
          ipAddress,
          userAgent,
          action: 'activity_update',
          timestamp: now,
          endpoint,
          metadata: { activityCount: sessionData.activityCount }
        });
      }

      return { valid: true };
    } catch (error) {
      console.error('Session activity update error:', error);
      return { valid: false, reason: 'update_error' };
    }
  }

  /**
   * Enforce concurrent session limits
   */
  private async enforceConcurrentSessionLimits(agentId: string): Promise<void> {
    const userSessionsKey = `user_sessions:${agentId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);
    
    if (sessionIds.length <= this.config.maxConcurrentSessions) {
      return;
    }

    // Get session details to find oldest sessions
    const sessionDetails = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const sessionKey = `session:${sessionId}`;
        const dataStr = await this.redis.get(sessionKey);
        return dataStr ? { sessionId, ...JSON.parse(dataStr) } : null;
      })
    );

    // Sort by creation time (oldest first)
    const validSessions = sessionDetails
      .filter(Boolean)
      .sort((a, b) => new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime());

    // Remove oldest sessions to enforce limit
    const sessionsToRemove = validSessions.slice(0, validSessions.length - this.config.maxConcurrentSessions);
    
    for (const session of sessionsToRemove) {
      if (this.config.enableSessionKicking) {
        await this.destroySession(session!.sessionId, 'concurrent_limit_exceeded');
        
        logSecurityEvent('session_kicked_concurrent_limit', {
          kickedSessionId: session!.sessionId,
          agentId,
          totalSessions: validSessions.length,
          maxAllowed: this.config.maxConcurrentSessions
        });
      }
    }
  }

  /**
   * Destroy session and cleanup
   */
  async destroySession(sessionId: string, reason: string): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionDataStr = await this.redis.get(sessionKey);
      
      if (sessionDataStr) {
        const sessionData = JSON.parse(sessionDataStr);
        
        // Remove from user sessions tracking
        const userSessionsKey = `user_sessions:${sessionData.agentId}`;
        await this.redis.srem(userSessionsKey, sessionId);
        
        // Log session destruction
        await this.logSessionActivity({
          sessionId,
          agentId: sessionData.agentId,
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
          action: 'session_destroyed',
          timestamp: new Date(),
          metadata: { reason }
        });

        logSecurityEvent('session_destroyed', {
          sessionId,
          agentId: sessionData.agentId,
          reason
        });
      }

      // Cleanup session data
      await this.redis.del(sessionKey);
      await this.redis.del(`ip_tracking:${sessionId}`);
      
    } catch (error) {
      console.error('Session destruction error:', error);
    }
  }

  /**
   * Log session activity for security monitoring
   */
  private async logSessionActivity(activity: SessionActivity): Promise<void> {
    if (!this.config.trackSessionActivity) {
      return;
    }

    const activityKey = `session_activity:${activity.sessionId}:${Date.now()}`;
    const userActivityKey = `user_activity:${activity.agentId}`;
    
    // Store individual activity
    await this.redis.setex(
      activityKey,
      24 * 60 * 60, // 24 hours
      JSON.stringify(activity)
    );

    // Add to user's activity timeline
    await this.redis.zadd(
      userActivityKey,
      Date.now(),
      activityKey
    );
    
    // Trim old activities (keep last 100)
    await this.redis.zremrangebyrank(userActivityKey, 0, -101);
    await this.redis.expire(userActivityKey, 7 * 24 * 60 * 60); // 7 days
  }

  /**
   * Start cleanup interval for expired sessions
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      // Clean up expired session tokens and user activity
      const now = Date.now();
      const idleExpiredCutoff = now - this.config.idleTimeout;
      const absoluteExpiredCutoff = now - this.config.absoluteTimeout;
      
      // Get all session keys (fix pattern to match actual session keys)
      const sessionKeys = await this.redis.keys('session:*');
      let cleanupCount = 0;
      
      for (const key of sessionKeys) {
        // Skip non-session keys that might match the pattern
        if (key.includes(':metadata') || key.includes('ip_tracking') || key.includes('user_sessions')) {
          continue;
        }
        
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.lastActivity && session.createdAt) {
            // CRITICAL FIX: Convert ISO timestamp strings to numbers before comparison
            const lastActivityTime = new Date(session.lastActivity).getTime();
            const createdAtTime = new Date(session.createdAt).getTime();
            
            if ((now - lastActivityTime) > this.config.idleTimeout || 
                (now - createdAtTime) > this.config.absoluteTimeout) {
              // Extract agent ID for cascade revocation
              const sessionId = key.split(':')[1];
              const agentId = session.agentId;
              
              // CRITICAL: Cascade revocation - close all associated connections
              if (agentId) {
                console.log(`🚫 SESSION: Expiring session and closing connections for agent ${agentId}`);
                
                // Close WebSocket connections for this agent
                const wsDisconnected = wsManager.disconnectConnectionsByAgentId(agentId, 'session_expired');
                
                // Close VNC connections for this agent
                const vncDisconnected = vncProxy.disconnectConnectionsByAgentId(agentId, 'session_expired');
                
                if (wsDisconnected > 0 || vncDisconnected > 0) {
                  console.log(`🧹 SESSION: Cascade revocation - ${wsDisconnected} WebSocket + ${vncDisconnected} VNC connections closed`);
                  
                  // Log security event for cascade revocation
                  logSecurityEvent('session_destroyed', {
                    sessionId,
                    agentId,
                    reason: 'session_expired_cascade_revocation',
                    wsConnectionsClosed: wsDisconnected,
                    vncConnectionsClosed: vncDisconnected
                  });
                }
              }
              
              // Remove expired session and related data
              await this.redis.del(key);
              await this.redis.del(`session:${sessionId}:activity:*`);
              await this.redis.del(`session:${sessionId}:ip`);
              cleanupCount++;
            }
          }
        }
      }
      
      // Clean up expired user activity timelines (older than 7 days)
      const userActivityKeys = await this.redis.keys('user:*:activity');
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      for (const key of userActivityKeys) {
        await this.redis.zremrangebyscore(key, 0, weekAgo);
      }
      
      if (cleanupCount > 0) {
        console.log(`🧹 SESSION: Cleaned up ${cleanupCount} expired sessions and old activity data`);
      }
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Session security middleware factory
 */
export function createSessionSecurityMiddleware(sessionStore: any) {
  const isMemoryStore = sessionStore?.constructor?.name === "MemoryStore";
  const isProduction = process.env.NODE_ENV === "production";

  return (req: Request, res: Response, next: NextFunction) => {
    // 🚨 Always bypass CSRF token endpoint
    if (req.path === "/api/csrf-token") {
      return next();
    }

    // 🛠 In dev/staging: skip validation if MemoryStore
    if (!isProduction && isMemoryStore) {
      console.log("🔄 SECURITY: Skipping session validation (MemoryStore in dev/staging)");
      return next();
    }

    // 🔒 Production: enforce strict session validation
    try {
      if (sessionStore && typeof sessionStore.validateSessionIP === 'function') {
        sessionStore.validateSessionIP(req);
      }
      next();
    } catch (err: any) {
      console.error("❌ Session security validation failed:", err.message);
      return res.status(401).json({ error: "session_not_found" });
    }
  };
}

/**
 * Create Redis session store for production
 */
export function createRedisSessionStore(redis: Redis): RedisStore {
  
  const store = new RedisStore({
    client: redis,
    prefix: 'agent_session:',
    ttl: 24 * 60 * 60, // 24 hours in seconds
    disableTouch: false, // Allow session activity updates
    disableTTL: false
  });

  // Add custom error logging
  store.on('error', (error: any) => {
    console.error('Redis session store error:', error);
    logSecurityEvent('redis_session_error', { error: error.message });
  });

  return store;
}