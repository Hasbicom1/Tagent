/**
 * VNC Manager for Browser Live View Integration
 * 
 * Leverages Replit's built-in VNC functionality to provide live browser streaming
 * Manages X11 display configuration and VNC session lifecycle
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import { validateJWTToken, DEFAULT_SECURITY_CONFIG } from '../server/security';

export interface VNCConfig {
  displayNumber: number;
  vncPort: number;
  webSocketPort: number;
  resolution: string;
  colorDepth: number;
  enableAuth: boolean;
  password?: string;
}

export interface VNCSession {
  id: string;
  displayNumber: number;
  vncPort: number;
  webSocketPort: number;
  xvfbProcess?: ChildProcess;
  vncProcess?: ChildProcess;
  websockifyProcess?: ChildProcess;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export class VNCManager extends EventEmitter {
  private sessions = new Map<string, VNCSession>();
  private config: VNCConfig;
  private nextDisplayNumber = 1;
  private nextVNCPort = 5901;
  private nextWSPort = 6081;

  constructor(config: Partial<VNCConfig> = {}) {
    super();
    this.config = {
      displayNumber: 1,
      vncPort: 5901,
      webSocketPort: 6081,
      resolution: '1280x720',
      colorDepth: 24,
      enableAuth: true, // ✅ SECURITY: Enable authentication by default
      ...config
    };
  }

  /**
   * Create a new VNC session for browser automation
   */
  async createSession(sessionId: string): Promise<VNCSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`VNC session ${sessionId} already exists`);
    }

    const displayNumber = this.nextDisplayNumber++;
    const vncPort = this.nextVNCPort++;
    const webSocketPort = this.nextWSPort++;

    const session: VNCSession = {
      id: sessionId,
      displayNumber,
      vncPort,
      webSocketPort,
      isActive: false,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    try {
      // Check if we're running in Replit environment with built-in VNC
      if (process.env.REPL_ID) {
        this.log(`📺 Using Replit's built-in VNC for session ${sessionId}`);
        // In Replit, VNC is automatically available when GUI apps are launched
        session.isActive = true;
        this.sessions.set(sessionId, session);
        this.emit('sessionCreated', session);
        return session;
      }

      // For other environments, set up our own VNC stack
      await this.startXvfb(session);
      await this.startVNCServer(session);
      await this.startWebSocketProxy(session);

      session.isActive = true;
      this.sessions.set(sessionId, session);
      
      this.log(`✅ VNC session created: ${sessionId} on display :${displayNumber}`);
      this.emit('sessionCreated', session);
      
      return session;
    } catch (error) {
      this.log(`❌ Failed to create VNC session ${sessionId}:`, error);
      await this.cleanupSession(session);
      throw error;
    }
  }

  /**
   * Get VNC connection details for a session
   */
  getSessionDetails(sessionId: string): VNCSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get VNC WebSocket URL for frontend integration
   */
  getWebSocketURL(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return null;

    // In Replit, VNC is accessible via the built-in interface
    if (process.env.REPL_ID) {
      return `${process.env.REPL_SLUG || 'vnc'}.${process.env.REPL_OWNER}.repl.co`;
    }

    return `ws://localhost:${session.webSocketPort}`;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Start Xvfb virtual display (for non-Replit environments)
   */
  private async startXvfb(session: VNCSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const xvfbArgs = [
        `:${session.displayNumber}`,
        '-screen', '0', `${this.config.resolution}x${this.config.colorDepth}`,
        '-ac',
        '+extension', 'GLX',
        '+render',
        '-noreset'
      ];

      session.xvfbProcess = spawn('Xvfb', xvfbArgs);

      session.xvfbProcess.on('error', (error) => {
        this.log(`❌ Xvfb failed for session ${session.id}:`, error);
        reject(error);
      });

      // Give Xvfb time to start
      setTimeout(() => {
        if (session.xvfbProcess && !session.xvfbProcess.killed) {
          this.log(`✅ Xvfb started for session ${session.id} on display :${session.displayNumber}`);
          resolve();
        } else {
          reject(new Error('Xvfb failed to start'));
        }
      }, 2000);
    });
  }

  /**
   * Start VNC server (for non-Replit environments)
   */
  private async startVNCServer(session: VNCSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const vncArgs = [
        `-display`, `:${session.displayNumber}`,
        `-rfbport`, session.vncPort.toString(),
        '-shared',
        '-forever',
        '-loop',
        '-noxdamage'
      ];

      // ✅ SECURITY: Add authentication with secure password generation
      if (this.config.enableAuth) {
        const sessionPassword = this.generateSecurePassword(session.id);
        const passwdFile = join('/tmp', `vnc_passwd_${session.id}`);
        writeFileSync(passwdFile, sessionPassword);
        vncArgs.push('-passwd', passwdFile);
        
        // Store password hash for validation (don't store plaintext)
        const crypto = require('crypto');
        (session as any).passwordHash = crypto.createHash('sha256').update(sessionPassword).digest('hex');
        
        this.log(`🔐 VNC authentication enabled for session ${session.id}`);
      } else {
        vncArgs.push('-nopw');
        this.log(`⚠️  VNC authentication disabled for session ${session.id}`);
      }

      session.vncProcess = spawn('x11vnc', vncArgs);

      session.vncProcess.on('error', (error) => {
        this.log(`❌ VNC server failed for session ${session.id}:`, error);
        reject(error);
      });

      session.vncProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('PORT=')) {
          this.log(`✅ VNC server started for session ${session.id} on port ${session.vncPort}`);
          resolve();
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (session.vncProcess && !session.vncProcess.killed) {
          resolve(); // Assume it started if process is still running
        } else {
          reject(new Error('VNC server failed to start'));
        }
      }, 10000);
    });
  }

  /**
   * Start WebSocket proxy for web-based VNC access
   */
  private async startWebSocketProxy(session: VNCSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const websockifyArgs = [
        session.webSocketPort.toString(),
        `localhost:${session.vncPort}`
      ];

      session.websockifyProcess = spawn('websockify', websockifyArgs);

      session.websockifyProcess.on('error', (error) => {
        this.log(`❌ WebSocket proxy failed for session ${session.id}:`, error);
        reject(error);
      });

      session.websockifyProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Listen on')) {
          this.log(`✅ WebSocket proxy started for session ${session.id} on port ${session.webSocketPort}`);
          resolve();
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (session.websockifyProcess && !session.websockifyProcess.killed) {
          resolve(); // Assume it started if process is still running
        } else {
          reject(new Error('WebSocket proxy failed to start'));
        }
      }, 5000);
    });
  }

  /**
   * Close a VNC session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.log(`🔄 Closing VNC session: ${sessionId}`);
    await this.cleanupSession(session);
    this.sessions.delete(sessionId);
    this.emit('sessionClosed', sessionId);
  }

  /**
   * Cleanup session processes
   */
  private async cleanupSession(session: VNCSession): Promise<void> {
    session.isActive = false;

    // Kill processes in reverse order
    if (session.websockifyProcess) {
      session.websockifyProcess.kill('SIGTERM');
      session.websockifyProcess = undefined;
    }

    if (session.vncProcess) {
      session.vncProcess.kill('SIGTERM');
      session.vncProcess = undefined;
    }

    if (session.xvfbProcess) {
      session.xvfbProcess.kill('SIGTERM');
      session.xvfbProcess = undefined;
    }

    // Clean up temp files
    try {
      const passwdFile = join('/tmp', `vnc_passwd_${session.id}`);
      if (existsSync(passwdFile)) {
        require('fs').unlinkSync(passwdFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Close all sessions and cleanup
   */
  async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up all VNC sessions...');
    
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
    
    this.log('✅ VNC manager cleanup completed');
  }

  /**
   * Get DISPLAY environment variable for the session
   */
  getDisplayEnv(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return null;
    
    return `:${session.displayNumber}`;
  }

  /**
   * List all active sessions
   */
  getActiveSessions(): VNCSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  /**
   * Get session statistics
   */
  getStats() {
    const activeSessions = this.getActiveSessions();
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      nextDisplayNumber: this.nextDisplayNumber,
      nextVNCPort: this.nextVNCPort,
      nextWSPort: this.nextWSPort
    };
  }

  /**
   * ✅ SECURITY: Validate VNC authentication token
   * Verifies JWT token for WebSocket VNC access
   */
  validateVNCToken(token: string, sessionId: string): { valid: boolean; error?: string; payload?: any } {
    try {
      if (!token || !sessionId) {
        return { valid: false, error: 'Missing token or session ID' };
      }

      // Validate JWT token structure and signature
      const tokenValidation = validateJWTToken(token);
      if (!tokenValidation.valid) {
        this.log(`🚨 SECURITY: VNC token validation failed: ${tokenValidation.error}`, { sessionId });
        return { valid: false, error: tokenValidation.error };
      }

      const payload = tokenValidation.payload;

      // Verify token is for VNC access
      if (payload.type !== 'vnc_access') {
        this.log(`🚨 SECURITY: Invalid token type for VNC access: ${payload.type}`, { sessionId });
        return { valid: false, error: 'Invalid token type' };
      }

      // Verify session ID matches
      if (payload.sessionId !== sessionId) {
        this.log(`🚨 SECURITY: Session ID mismatch in VNC token`, { 
          tokenSessionId: payload.sessionId, 
          requestSessionId: sessionId 
        });
        return { valid: false, error: 'Session ID mismatch' };
      }

      // Check if session exists and is active
      const session = this.sessions.get(sessionId);
      if (!session || !session.isActive) {
        this.log(`🚨 SECURITY: VNC access denied - session not found or inactive`, { sessionId });
        return { valid: false, error: 'Session not found or inactive' };
      }

      this.log(`✅ SECURITY: VNC token validated successfully`, { 
        sessionId,
        agentId: payload.agentId,
        tokenExpiration: new Date(payload.exp * 1000).toISOString()
      });

      return { valid: true, payload };
    } catch (error: any) {
      this.log(`❌ SECURITY: VNC token validation error: ${error.message}`, { sessionId });
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * ✅ SECURITY: Generate secure password for VNC session
   * Creates session-specific password for VNC authentication
   */
  generateSecurePassword(sessionId: string): string {
    try {
      // Generate session-specific password using sessionId and secret
      const passwordData = `${sessionId}:${DEFAULT_SECURITY_CONFIG.jwtSecret}:${Date.now()}`;
      const crypto = require('crypto');
      const password = crypto.createHash('sha256').update(passwordData).digest('hex').substring(0, 16);
      
      this.log(`🔐 Generated secure VNC password for session`, { sessionId });
      return password;
    } catch (error: any) {
      this.log(`❌ Failed to generate VNC password: ${error.message}`, { sessionId });
      // Fallback to simple session-based password
      return sessionId.substring(0, 12);
    }
  }

  /**
   * ✅ SECURITY: Create authenticated WebSocket URL
   * Generates VNC WebSocket URL with authentication parameters
   */
  createAuthenticatedWebSocketURL(sessionId: string, token: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return '';

    // In Replit, VNC is accessible via the built-in interface with auth
    if (process.env.REPL_ID) {
      const baseURL = `${process.env.REPL_SLUG || 'vnc'}.${process.env.REPL_OWNER}.repl.co`;
      return `wss://${baseURL}/vnc?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
    }

    // For other environments, use local WebSocket with auth
    return `ws://localhost:${session.webSocketPort}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
  }

  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: 'VNCManager',
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }
}