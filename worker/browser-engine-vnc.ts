/**
 * Enhanced Browser Engine with VNC Live View Integration
 * 
 * Extends the existing BrowserEngine to support live visual streaming
 * via VNC while maintaining all existing automation capabilities
 */

import { BrowserEngine, BrowserTask, BrowserTaskResult, ExecutionStep } from './browser-engine';
import { VNCManager, VNCSession } from './vnc-manager';
import { chromium, firefox, webkit, Browser, BrowserContext, Page, LaunchOptions } from 'playwright';

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

export class BrowserEngineWithVNC extends BrowserEngine {
  private vncManager: VNCManager;
  private liveViewConfig: LiveViewConfig;
  private liveSessions = new Map<string, LiveBrowserSession>();

  constructor(config: any, liveViewConfig: Partial<LiveViewConfig> = {}) {
    super(config);
    
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
   * Override browser launch to use VNC display when live view is enabled
   */
  protected async launchBrowser(sessionId: string): Promise<Browser> {
    let browser: Browser;
    
    if (this.liveViewConfig.enableLiveView) {
      // Start VNC session for live view
      const vncSession = await this.startLiveView(sessionId);
      
      // Configure browser to use VNC display
      const launchOptions = await this.getLiveViewLaunchOptions(vncSession);
      
      switch (this.config.browserType) {
        case 'firefox':
          browser = await firefox.launch(launchOptions);
          break;
        case 'webkit':
          browser = await webkit.launch(launchOptions);
          break;
        default:
          browser = await chromium.launch(launchOptions);
      }
      
      this.log(`🎥 Browser launched with live view on display ${vncSession?.displayNumber}`);
    } else {
      // Fall back to standard headless mode
      browser = await super.launchBrowser(sessionId);
    }

    return browser;
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

      // Store live session info
      const liveSession: LiveBrowserSession = {
        sessionId,
        vncSession,
        displayEnv,
        webSocketURL,
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
   * Get browser launch options configured for VNC display
   */
  private async getLiveViewLaunchOptions(vncSession: VNCSession | null): Promise<LaunchOptions> {
    const baseOptions: LaunchOptions = {
      headless: false, // Must be headed for VNC
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    // Configure display environment for VNC
    if (vncSession && vncSession.displayNumber) {
      process.env.DISPLAY = `:${vncSession.displayNumber}`;
      this.log(`🖥️  Set DISPLAY environment to :${vncSession.displayNumber}`);
    } else if (process.env.REPL_ID) {
      // In Replit, VNC is handled automatically
      this.log(`🖥️  Using Replit's built-in VNC display`);
    }

    return baseOptions;
  }

  /**
   * Override task execution to update VNC activity
   */
  async executeTask(task: BrowserTask): Promise<BrowserTaskResult> {
    // Update VNC session activity
    if (this.liveViewConfig.enableLiveView) {
      this.vncManager.updateActivity(task.sessionId);
    }

    // Execute task with standard engine
    const result = await super.executeTask(task);

    // Add live view metadata to result
    const liveSession = this.getLiveViewDetails(task.sessionId);
    if (liveSession) {
      (result as any).liveView = {
        webSocketURL: liveSession.webSocketURL,
        isActive: liveSession.isLiveViewActive
      };
    }

    return result;
  }

  /**
   * Override session cleanup to stop VNC
   */
  async closeSession(sessionId: string): Promise<void> {
    // Stop live view first
    await this.stopLiveView(sessionId);
    
    // Then close browser session
    await super.closeSession(sessionId);
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
    
    // Cleanup browser engine
    await super.cleanup();
    
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
}