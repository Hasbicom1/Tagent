/**
 * Enhanced Browser Engine with VNC Live View Integration
 * 
 * Wraps the existing BrowserEngine to support live visual streaming
 * via VNC while maintaining all existing automation capabilities
 */

import { BrowserEngine, BrowserTask, BrowserTaskResult, ExecutionStep } from './browser-engine';
import { VNCManager, VNCSession } from './vnc-manager';
import { EventEmitter } from 'events';

export interface LiveViewConfig {
  enableLiveView: boolean;
  autoStartVNC: boolean;
  resolution: string;
  frameRate: number;
}

export interface LiveBrowserSession {
  sessionId: string;
  vncSession?: VNCSession;
  displayEnv?: string;
  webSocketURL?: string;
  isLiveViewActive: boolean;
}

export class BrowserEngineWithVNC extends EventEmitter {
  private browserEngine: BrowserEngine;
  private vncManager: VNCManager;
  private liveViewConfig: LiveViewConfig;
  private liveSessions = new Map<string, LiveBrowserSession>();

  constructor(config: any, liveViewConfig: Partial<LiveViewConfig> = {}) {
    super();
    
    this.browserEngine = new BrowserEngine(config);
    
    this.liveViewConfig = {
      enableLiveView: true,
      autoStartVNC: true,
      resolution: '1280x720',
      frameRate: 30,
      ...liveViewConfig
    };

    this.vncManager = new VNCManager({
      resolution: this.liveViewConfig.resolution,
      enableAuth: false // Use WebSocket auth instead
    });

    // Forward VNC events
    this.vncManager.on('sessionCreated', (vncSession) => {
      this.emit('liveViewStarted', vncSession);
    });

    this.vncManager.on('sessionClosed', (sessionId) => {
      this.emit('liveViewStopped', sessionId);
    });
  }

  /**
   * Initialize the enhanced browser engine with VNC capabilities
   */
  async initialize(): Promise<void> {
    await this.browserEngine.initialize();
    this.log('✅ Enhanced browser engine with VNC initialized');
  }

  /**
   * Start live view for a browser session
   */
  async startLiveView(sessionId: string): Promise<VNCSession | null> {
    if (!this.liveViewConfig.enableLiveView) {
      return null;
    }

    try {
      this.log(`🎥 Starting live view for session: ${sessionId}`);
      
      // Create VNC session
      const vncSession = await this.vncManager.createSession(sessionId);
      const webSocketURL = this.vncManager.getWebSocketURL(sessionId);
      const displayEnv = this.vncManager.getDisplayEnv(sessionId);

      // Set display environment for browser processes
      if (displayEnv) {
        process.env.DISPLAY = displayEnv;
        this.log(`🖥️  Set DISPLAY environment to ${displayEnv}`);
      }

      // Store live session info
      const liveSession: LiveBrowserSession = {
        sessionId,
        vncSession,
        displayEnv: displayEnv || undefined,
        webSocketURL: webSocketURL || undefined,
        isLiveViewActive: true
      };

      this.liveSessions.set(sessionId, liveSession);
      
      this.log(`✅ Live view started for session ${sessionId}`, {
        vncPort: vncSession.vncPort,
        webSocketPort: vncSession.webSocketPort,
        webSocketURL
      });

      return vncSession;
    } catch (error) {
      this.log(`❌ Failed to start live view for session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Stop live view for a browser session
   */
  async stopLiveView(sessionId: string): Promise<void> {
    const liveSession = this.liveSessions.get(sessionId);
    if (!liveSession) return;

    try {
      this.log(`🔄 Stopping live view for session: ${sessionId}`);
      
      await this.vncManager.closeSession(sessionId);
      
      liveSession.isLiveViewActive = false;
      this.liveSessions.delete(sessionId);
      
      this.log(`✅ Live view stopped for session ${sessionId}`);
    } catch (error) {
      this.log(`❌ Failed to stop live view for session ${sessionId}:`, error);
    }
  }

  /**
   * Get live view connection details for a session
   */
  getLiveViewDetails(sessionId: string): LiveBrowserSession | null {
    return this.liveSessions.get(sessionId) || null;
  }

  /**
   * Delegate to browser engine while updating VNC activity
   */
  async executeTask(task: BrowserTask): Promise<BrowserTaskResult> {
    // Start live view if enabled and not already active
    if (this.liveViewConfig.enableLiveView && this.liveViewConfig.autoStartVNC) {
      const liveSession = this.getLiveViewDetails(task.sessionId);
      if (!liveSession || !liveSession.isLiveViewActive) {
        await this.startLiveView(task.sessionId);
      }
    }

    // Update VNC session activity
    if (this.liveViewConfig.enableLiveView) {
      this.vncManager.updateActivity(task.sessionId);
    }

    // Execute task with browser engine
    const result = await this.browserEngine.executeTask(task);

    // Add live view metadata to result
    const liveSession = this.getLiveViewDetails(task.sessionId);
    if (liveSession && liveSession.isLiveViewActive) {
      (result as any).liveView = {
        webSocketURL: liveSession.webSocketURL,
        isActive: liveSession.isLiveViewActive,
        vncPort: liveSession.vncSession?.vncPort,
        displayNumber: liveSession.vncSession?.displayNumber
      };
    }

    return result;
  }

  /**
   * Close session with VNC cleanup
   */
  async closeSession(sessionId: string): Promise<void> {
    // Stop live view (browser engine will handle its own cleanup)
    await this.stopLiveView(sessionId);
    this.log(`✅ VNC session closed: ${sessionId}`);
  }

  /**
   * Get all active VNC live sessions
   */
  getActiveLiveSessions(): LiveBrowserSession[] {
    return Array.from(this.liveSessions.values()).filter(session => session.isLiveViewActive);
  }

  /**
   * Enhanced cleanup to include VNC manager
   */
  async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up browser engine with VNC...');
    
    // Stop all live view sessions
    const sessionIds = Array.from(this.liveSessions.keys());
    await Promise.all(sessionIds.map(id => this.stopLiveView(id)));
    
    // Cleanup VNC manager
    await this.vncManager.cleanup();
    
    // Cleanup browser engine (let it handle its own sessions)
    await this.browserEngine.cleanup();
    
    this.log('✅ Browser engine with VNC cleanup completed');
  }

  /**
   * Get live view statistics
   */
  getLiveViewStats() {
    const vncStats = this.vncManager.getStats();
    const liveSessions = Array.from(this.liveSessions.values());
    
    return {
      ...vncStats,
      liveSessionsCount: liveSessions.length,
      activeLiveViews: liveSessions.filter(s => s.isLiveViewActive).length,
      liveViewEnabled: this.liveViewConfig.enableLiveView
    };
  }

  /**
   * Toggle live view for a session
   */
  async toggleLiveView(sessionId: string, enable: boolean): Promise<boolean> {
    const liveSession = this.getLiveViewDetails(sessionId);
    
    if (enable && !liveSession?.isLiveViewActive) {
      const vncSession = await this.startLiveView(sessionId);
      return vncSession !== null;
    } else if (!enable && liveSession?.isLiveViewActive) {
      await this.stopLiveView(sessionId);
      return true;
    }
    
    return liveSession?.isLiveViewActive || false;
  }

  /**
   * Logging helper
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: 'BrowserEngineWithVNC',
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }
}