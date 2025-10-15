import { Server } from 'socket.io';
import { RealBrowserEngine } from '../automation/real-browser-engine.js';
import { RealAIEngine } from '../ai/real-ai-engine.js';
import { verifyWebSocketToken } from '../jwt-utils.js';

/**
 * REAL-TIME AUTOMATION WEBSOCKET
 * Stream actual browser automation to frontend
 */
export class RealTimeAutomationSocket {
  constructor(server, options = {}) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      ...options
    });
    
    this.browserEngine = new RealBrowserEngine();
    this.aiEngine = new RealAIEngine();
    this.activeSessions = new Map();
    
    this.setupEventHandlers();
  }
  
  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 REAL-TIME: Client connected: ${socket.id}`);
      
      // Initialize session
      this.activeSessions.set(socket.id, {
        socket,
        isActive: false,
        lastActivity: new Date()
      });
      
      // Send connection confirmation
      socket.emit('automationStatus', {
        status: 'connected',
        message: 'Connected to real-time automation system'
      });
      // Unified typed protocol: expose connection status for client
      socket.emit('message', {
        type: 'CONNECTION_STATUS',
        status: 'connected',
        timestamp: new Date().toISOString(),
        messageId: `conn-${Date.now()}`
      });
      
      // Handle automation requests
      socket.on('requestAutomation', async (data) => {
        await this.handleAutomationRequest(socket, data);
      });
      
      // Handle browser control requests
      socket.on('browserControl', async (data) => {
        await this.handleBrowserControl(socket, data);
      });
      
      // Handle AI processing requests
      socket.on('aiProcess', async (data) => {
        await this.handleAIProcessing(socket, data);
      });
      
      // Handle screenshot requests
      socket.on('requestScreenshot', async () => {
        await this.handleScreenshotRequest(socket);
      });
      
      // Handle navigation requests
      socket.on('navigateTo', async (data) => {
        await this.handleNavigationRequest(socket, data);
      });

      // Handle unified typed WebSocket protocol over Socket.IO
      socket.on('message', (data) => {
        const msg = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
        if (!msg || typeof msg !== 'object') {
          console.warn('⚠️ REAL-TIME: Invalid typed message payload:', data);
          socket.emit('message', {
            type: 'ERROR',
            error: 'INVALID_JSON',
            code: 'INVALID_JSON',
            timestamp: new Date().toISOString(),
            messageId: `err-${Date.now()}`
          });
          return;
        }

        const type = msg.type;
        switch (type) {
          case 'AUTHENTICATE': {
            const token = msg.sessionToken;
            const agentId = msg.agentId;
            console.log('🔐 REAL-TIME: AUTHENTICATE received', { hasToken: !!token, agentId });

            if (!token || !agentId) {
              socket.emit('message', {
                type: 'ERROR',
                error: 'Valid session token required for authentication',
                code: !token ? 'MISSING_TOKEN' : 'MISSING_AGENT_ID',
                timestamp: new Date().toISOString(),
                messageId: `err-${Date.now()}`
              });
              return;
            }

            try {
              const payload = verifyWebSocketToken(token);
              if (!payload || payload.agentId !== agentId) {
                console.warn('🚫 REAL-TIME: JWT agentId mismatch:', { tokenAgentId: payload?.agentId, agentId });
                socket.emit('message', {
                  type: 'ERROR',
                  error: 'SESSION_PROTOCOL_BREACH: JWT agent validation failed',
                  code: 'INVALID_TOKEN',
                  timestamp: new Date().toISOString(),
                  messageId: `err-${Date.now()}`
                });
                return;
              }

              // Track auth state on socket
              socket.data = socket.data || {};
              socket.data.authenticatedAgentId = agentId;
              socket.data.sessionId = payload.sessionId;
              socket.data.subscriptions = socket.data.subscriptions || new Set();

              console.log('✅ REAL-TIME: Client authenticated', { socketId: socket.id, agentId, sessionId: payload.sessionId });

              socket.emit('message', {
                type: 'AUTHENTICATED',
                timestamp: new Date().toISOString(),
                messageId: `auth-${Date.now()}`
              });
            } catch (err) {
              console.error('❌ REAL-TIME: JWT verification failed:', err?.message || err);
              socket.emit('message', {
                type: 'ERROR',
                error: 'NEURAL_AUTHENTICATION_FAILED: Liberation protocol access denied',
                code: 'AUTH_ERROR',
                details: { message: err?.message },
                timestamp: new Date().toISOString(),
                messageId: `err-${Date.now()}`
              });
            }
            break;
          }

          case 'PING': {
            socket.emit('message', {
              type: 'PONG',
              timestamp: new Date().toISOString(),
              messageId: `pong-${Date.now()}`
            });
            break;
          }

          case 'SUBSCRIBE': {
            const { subscriptionType, targetId } = msg || {};
            console.log('📥 REAL-TIME: SUBSCRIBE', { subscriptionType, targetId });

            socket.data = socket.data || {};
            socket.data.subscriptions = socket.data.subscriptions || new Set();
            if (subscriptionType && targetId) {
              socket.data.subscriptions.add(`${subscriptionType}:${targetId}`);
            }

            socket.emit('message', {
              type: 'SUBSCRIBED',
              subscriptionType,
              targetId,
              timestamp: new Date().toISOString(),
              messageId: `sub-${Date.now()}`
            });
            break;
          }

          case 'UNSUBSCRIBE': {
            const { subscriptionType, targetId } = msg || {};
            console.log('📥 REAL-TIME: UNSUBSCRIBE', { subscriptionType, targetId });

            try {
              socket.data = socket.data || {};
              if (socket.data.subscriptions && subscriptionType && targetId) {
                socket.data.subscriptions.delete(`${subscriptionType}:${targetId}`);
              }
            } catch (_) {}

            socket.emit('message', {
              type: 'UNSUBSCRIBED',
              subscriptionType,
              targetId,
              timestamp: new Date().toISOString(),
              messageId: `unsub-${Date.now()}`
            });
            break;
          }

          default: {
            console.warn('⚠️ REAL-TIME: Unknown typed message type:', type);
            socket.emit('message', {
              type: 'ERROR',
              error: 'Unknown message type',
              code: 'UNKNOWN_MESSAGE_TYPE',
              details: { type },
              timestamp: new Date().toISOString(),
              messageId: `err-${Date.now()}`
            });
          }
        }
      });

      // NEW: Handle automation session events
      socket.on('automation:session:start', (data) => {
        console.log('🚀 Automation session started:', data);
        this.activeSessions.set(socket.id, {
          ...this.activeSessions.get(socket.id),
          isActive: true,
          sessionData: data,
          startTime: new Date()
        });
        
        socket.emit('automation:start', data);
      });

      socket.on('automation:session:stop', (data) => {
        console.log('🛑 Automation session stopped:', data);
        this.activeSessions.set(socket.id, {
          ...this.activeSessions.get(socket.id),
          isActive: false,
          endTime: new Date()
        });
        
        socket.emit('automation:stop', data);
      });

      // Handle automation results from client
      socket.on('automation:result', (result) => {
        console.log('📊 Automation result:', result);
        this.handleAutomationResult(socket, result);
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`🔌 REAL-TIME: Client disconnected: ${socket.id}`);
        this.activeSessions.delete(socket.id);
        // Unified typed protocol: notify disconnection
        try {
          socket.emit('message', {
            type: 'CONNECTION_STATUS',
            status: 'disconnected',
            timestamp: new Date().toISOString(),
            messageId: `conn-${Date.now()}`
          });
        } catch (e) {}
      });
    });
    
    // Setup browser engine event listeners
    this.setupBrowserEngineListeners();
    
    // Setup AI engine event listeners
    this.setupAIEngineListeners();
  }
  
  /**
   * Handle automation result from client
   */
  handleAutomationResult(socket, result) {
    console.log('📊 Processing automation result:', result);
    
    // Log the result
    if (result.status === 'success') {
      console.log('✅ Automation command successful:', result.command?.action);
    } else if (result.status === 'error') {
      console.error('❌ Automation command failed:', result.error);
    }
    
    // Update session with result
    const session = this.activeSessions.get(socket.id);
    if (session) {
      session.lastActivity = new Date();
      session.lastResult = result;
    }
    
    // Emit result to other connected clients if needed
    socket.broadcast.emit('automation:update', {
      type: 'result',
      result,
      timestamp: new Date()
    });
  }

  /**
   * Send automation command to client
   */
  sendAutomationCommand(socket, command) {
    console.log('📤 Sending automation command:', command);
    socket.emit('automation:command', command);
  }

  /**
   * Send batch automation commands to client
   */
  sendAutomationBatch(socket, commands) {
    console.log('📦 Sending automation batch:', commands);
    socket.emit('automation:batch', commands);
  }

  /**
   * Handle automation request
   */
  async handleAutomationRequest(socket, data) {
    try {
      const { command, userId } = data;
      
      console.log(`🎯 REAL-TIME: Processing automation request: "${command}"`);
      
      // Send processing status
      socket.emit('automationUpdate', {
        type: 'processing',
        message: 'Processing your request...',
        timestamp: new Date()
      });
      
      // Initialize engines if needed
      if (!this.browserEngine.isActive) {
        await this.browserEngine.initialize();
      }
      
      if (!this.aiEngine.isInitialized) {
        await this.aiEngine.initialize();
      }
      
      // Process with AI
      const aiResponse = await this.aiEngine.processUserInput(command);
      
      // Send AI analysis
      socket.emit('automationUpdate', {
        type: 'aiAnalysis',
        analysis: aiResponse.analysis,
        steps: aiResponse.steps,
        response: aiResponse.response,
        timestamp: new Date()
      });
      
      // Execute browser automation
      const browserResult = await this.browserEngine.executeCommand(command);
      
      // Send execution result
      socket.emit('automationUpdate', {
        type: 'executionComplete',
        command,
        result: browserResult,
        screenshot: browserResult.screenshot,
        timestamp: new Date()
      });
      
      // Update session
      const session = this.activeSessions.get(socket.id);
      if (session) {
        session.isActive = true;
        session.lastActivity = new Date();
      }
      
    } catch (error) {
      console.error('❌ REAL-TIME: Automation request failed:', error);
      
      socket.emit('automationUpdate', {
        type: 'error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Handle browser control request
   */
  async handleBrowserControl(socket, data) {
    try {
      const { action, target, value } = data;
      
      console.log(`🎮 REAL-TIME: Browser control: ${action} ${target}`);
      
      if (!this.browserEngine.isActive) {
        await this.browserEngine.initialize();
      }
      
      let result;
      
      switch (action) {
        case 'navigate':
          result = await this.browserEngine.navigateTo(target);
          break;
        case 'click':
          result = await this.browserEngine.clickElement(target);
          break;
        case 'type':
          result = await this.browserEngine.typeText(target, value);
          break;
        case 'search':
          result = await this.browserEngine.performSearch(target);
          break;
        case 'screenshot':
          result = await this.browserEngine.takeScreenshot();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      // Send result
      socket.emit('automationUpdate', {
        type: 'browserControlComplete',
        action,
        target,
        result,
        screenshot: result.screenshot,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ REAL-TIME: Browser control failed:', error);
      
      socket.emit('automationUpdate', {
        type: 'error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Handle AI processing request
   */
  async handleAIProcessing(socket, data) {
    try {
      const { input } = data;
      
      console.log(`🧠 REAL-TIME: AI processing: "${input}"`);
      
      if (!this.aiEngine.isInitialized) {
        await this.aiEngine.initialize();
      }
      
      const result = await this.aiEngine.processUserInput(input);
      
      socket.emit('automationUpdate', {
        type: 'aiProcessingComplete',
        input,
        result,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ REAL-TIME: AI processing failed:', error);
      
      socket.emit('automationUpdate', {
        type: 'error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Handle screenshot request
   */
  async handleScreenshotRequest(socket) {
    try {
      console.log('📸 REAL-TIME: Screenshot request');
      
      if (!this.browserEngine.isActive) {
        await this.browserEngine.initialize();
      }
      
      const result = await this.browserEngine.takeScreenshot();
      
      socket.emit('automationUpdate', {
        type: 'screenshotComplete',
        screenshot: result.screenshot,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ REAL-TIME: Screenshot failed:', error);
      
      socket.emit('automationUpdate', {
        type: 'error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Handle navigation request
   */
  async handleNavigationRequest(socket, data) {
    try {
      const { url } = data;
      
      console.log(`🌐 REAL-TIME: Navigation request: ${url}`);
      
      if (!this.browserEngine.isActive) {
        await this.browserEngine.initialize();
      }
      
      const result = await this.browserEngine.navigateTo(url);
      
      socket.emit('automationUpdate', {
        type: 'navigationComplete',
        url,
        result,
        screenshot: result.screenshot,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ REAL-TIME: Navigation failed:', error);
      
      socket.emit('automationUpdate', {
        type: 'error',
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Setup browser engine event listeners
   */
  setupBrowserEngineListeners() {
    this.browserEngine.on('browserReady', () => {
      console.log('✅ REAL-TIME: Browser ready');
      this.io.emit('automationStatus', {
        status: 'browserReady',
        message: 'Browser is ready for automation'
      });
    });
    
    this.browserEngine.on('commandExecuted', (data) => {
      console.log('✅ REAL-TIME: Command executed:', data.command);
      this.io.emit('automationUpdate', {
        type: 'commandExecuted',
        command: data.command,
        result: data.result,
        timestamp: new Date()
      });
    });
    
    this.browserEngine.on('commandError', (data) => {
      console.error('❌ REAL-TIME: Command error:', data.command);
      this.io.emit('automationUpdate', {
        type: 'commandError',
        command: data.command,
        error: data.error.message,
        timestamp: new Date()
      });
    });
  }
  
  /**
   * Setup AI engine event listeners
   */
  setupAIEngineListeners() {
    this.aiEngine.on('inputProcessed', (data) => {
      console.log('🧠 REAL-TIME: Input processed:', data.input);
      this.io.emit('automationUpdate', {
        type: 'inputProcessed',
        input: data.input,
        analysis: data.analysis,
        steps: data.steps,
        timestamp: new Date()
      });
    });
    
    this.aiEngine.on('processingError', (data) => {
      console.error('❌ REAL-TIME: AI processing error:', data.input);
      this.io.emit('automationUpdate', {
        type: 'processingError',
        input: data.input,
        error: data.error.message,
        timestamp: new Date()
      });
    });
  }
  
  /**
   * Broadcast to all connected clients
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }
  
  /**
   * Send to specific client
   */
  sendToClient(socketId, event, data) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }
  
  /**
   * Get active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
      id,
      isActive: session.isActive,
      lastActivity: session.lastActivity
    }));
  }
  
  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions() {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [id, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > timeout) {
        console.log(`🧹 REAL-TIME: Cleaning up inactive session: ${id}`);
        this.activeSessions.delete(id);
      }
    }
  }
  
  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}
