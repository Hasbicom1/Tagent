/**
 * Browser Instance Manager - Prevents Resource Conflicts
 * Manages browser instances to avoid conflicts between multiple automation requests
 */

import { logger } from './logger';
import { EventEmitter } from 'events';

export interface BrowserSession {
  id: string;
  sessionId: string;
  status: 'idle' | 'busy' | 'error' | 'closed';
  lastActivity: Date;
  createdAt: Date;
  metadata?: any;
}

export interface BrowserRequest {
  sessionId: string;
  taskId: string;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}

export class BrowserInstanceManager extends EventEmitter {
  private sessions: Map<string, BrowserSession> = new Map();
  private requestQueue: BrowserRequest[] = [];
  private maxConcurrentSessions: number = 3; // Limit concurrent browser instances
  private sessionTimeout: number = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.startCleanupTimer();
  }

  async acquireBrowserSession(request: BrowserRequest): Promise<string> {
    try {
      logger.info('🌐 Browser Manager: Acquiring session', {
        sessionId: request.sessionId,
        taskId: request.taskId,
        priority: request.priority
      });

      // Check if session already exists and is available
      const existingSession = this.findAvailableSession(request.sessionId);
      if (existingSession) {
        existingSession.status = 'busy';
        existingSession.lastActivity = new Date();
        
        logger.info('♻️ Browser Manager: Reusing existing session', {
          sessionId: request.sessionId,
          browserId: existingSession.id
        });
        
        return existingSession.id;
      }

      // Check if we can create a new session
      if (this.getActiveSessions().length >= this.maxConcurrentSessions) {
        logger.warn('⏳ Browser Manager: Max sessions reached, queuing request', {
          sessionId: request.sessionId,
          queueLength: this.requestQueue.length
        });
        
        // Add to queue and wait
        return await this.queueRequest(request);
      }

      // Create new browser session
      const browserId = await this.createBrowserSession(request.sessionId);
      
      logger.info('✅ Browser Manager: New session created', {
        sessionId: request.sessionId,
        browserId: browserId
      });

      return browserId;

    } catch (error) {
      logger.error('❌ Browser Manager: Failed to acquire session', {
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async releaseBrowserSession(browserId: string): Promise<void> {
    try {
      const session = this.sessions.get(browserId);
      
      if (!session) {
        logger.warn('⚠️ Browser Manager: Session not found for release', { browserId });
        return;
      }

      session.status = 'idle';
      session.lastActivity = new Date();

      logger.info('🔓 Browser Manager: Session released', {
        browserId: browserId,
        sessionId: session.sessionId
      });

      // Process queued requests
      await this.processQueue();

      this.emit('sessionReleased', { browserId, sessionId: session.sessionId });

    } catch (error) {
      logger.error('❌ Browser Manager: Failed to release session', {
        browserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createBrowserSession(sessionId: string): Promise<string> {
    const browserId = `browser_${sessionId}_${Date.now()}`;
    
    const session: BrowserSession = {
      id: browserId,
      sessionId: sessionId,
      status: 'busy',
      lastActivity: new Date(),
      createdAt: new Date(),
      metadata: {
        userAgent: 'Tagent-Browser-Automation/1.0',
        viewport: { width: 1920, height: 1080 }
      }
    };

    this.sessions.set(browserId, session);

    // Notify worker to create browser instance
    await this.notifyWorkerCreateBrowser(browserId, sessionId);

    this.emit('sessionCreated', { browserId, sessionId });

    return browserId;
  }

  private async notifyWorkerCreateBrowser(browserId: string, sessionId: string): Promise<void> {
    // In production, this would send a message to the worker to create a browser instance
    logger.info('📤 Browser Manager: Notifying worker to create browser', {
      browserId,
      sessionId
    });

    // Simulate browser creation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private findAvailableSession(sessionId: string): BrowserSession | null {
    for (const session of this.sessions.values()) {
      if (session.sessionId === sessionId && session.status === 'idle') {
        return session;
      }
    }
    return null;
  }

  private getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status === 'busy' || session.status === 'idle'
    );
  }

  private async queueRequest(request: BrowserRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      // Add timeout handling
      const timeout = request.timeout || 30000; // 30 seconds default
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.requestQueue.findIndex(r => r.taskId === request.taskId);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
        }
        reject(new Error('Browser session request timeout'));
      }, timeout);

      // Add to queue with priority sorting
      this.requestQueue.push(request);
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Listen for session availability
      const onSessionAvailable = async () => {
        const queueIndex = this.requestQueue.findIndex(r => r.taskId === request.taskId);
        if (queueIndex === -1) return; // Request was removed (timeout)

        try {
          clearTimeout(timeoutId);
          this.requestQueue.splice(queueIndex, 1);
          
          const browserId = await this.createBrowserSession(request.sessionId);
          this.removeListener('sessionReleased', onSessionAvailable);
          resolve(browserId);
        } catch (error) {
          this.removeListener('sessionReleased', onSessionAvailable);
          reject(error);
        }
      };

      this.on('sessionReleased', onSessionAvailable);
    });
  }

  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return;
    if (this.getActiveSessions().length >= this.maxConcurrentSessions) return;

    // Process highest priority request
    const nextRequest = this.requestQueue.shift();
    if (nextRequest) {
      this.emit('sessionReleased'); // Trigger queue processing
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [browserId, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.sessionTimeout && session.status === 'idle') {
        expiredSessions.push(browserId);
      }
    }

    for (const browserId of expiredSessions) {
      this.closeBrowserSession(browserId);
    }

    if (expiredSessions.length > 0) {
      logger.info('🧹 Browser Manager: Cleaned up expired sessions', {
        count: expiredSessions.length,
        sessionIds: expiredSessions
      });
    }
  }

  private async closeBrowserSession(browserId: string): Promise<void> {
    const session = this.sessions.get(browserId);
    if (!session) return;

    session.status = 'closed';
    
    // Notify worker to close browser instance
    await this.notifyWorkerCloseBrowser(browserId, session.sessionId);
    
    this.sessions.delete(browserId);
    
    this.emit('sessionClosed', { browserId, sessionId: session.sessionId });
  }

  private async notifyWorkerCloseBrowser(browserId: string, sessionId: string): Promise<void> {
    logger.info('📤 Browser Manager: Notifying worker to close browser', {
      browserId,
      sessionId
    });
  }

  getSessionStatus(): { [key: string]: any } {
    const activeSessions = this.getActiveSessions();
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.maxConcurrentSessions,
      sessions: activeSessions.map(session => ({
        id: session.id,
        sessionId: session.sessionId,
        status: session.status,
        lastActivity: session.lastActivity,
        ageMinutes: Math.floor((Date.now() - session.createdAt.getTime()) / 60000)
      }))
    };
  }

  async shutdown(): Promise<void> {
    logger.info('🔄 Browser Manager: Shutting down...');

    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const browserId of sessionIds) {
      await this.closeBrowserSession(browserId);
    }

    // Clear queue
    this.requestQueue.length = 0;

    logger.info('✅ Browser Manager: Shutdown complete');
  }
}

export default BrowserInstanceManager;