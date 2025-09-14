/**
 * Production VNC WebSocket Proxy Server
 * Bridges frontend WebSocket connections to real VNC servers (TigerVNC)
 * Provides secure authentication and real remote desktop streaming
 * SECURITY FIX: Uses cookie-based session validation for browser compatibility
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createConnection, Socket } from 'net';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { Redis } from 'ioredis';
import type { Server as HTTPServer } from 'http';
import {
  validateWebSocketOrigin,
  logSecurityEvent,
  parseSecureSessionCookie,
  MultiLayerRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG
} from './security';
import {
  SessionSecurityStore,
  DEFAULT_SESSION_SECURITY_CONFIG
} from './session';

interface VNCProxyOptions {
  vncHost?: string;
  vncPort?: number;
  maxConnections?: number;
  redis?: Redis;
}

interface VNCConnection {
  id: string;
  clientWS: WebSocket;
  vncSocket: Socket;
  sessionId: string;
  agentId: string;
  clientIP: string;
  createdAt: Date;
  lastActivity: Date;
}

export class VNCProxy {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, VNCConnection>();
  private options: Required<Omit<VNCProxyOptions, 'redis'>>;
  private redis: Redis | null = null;
  private sessionStore: SessionSecurityStore | null = null;
  private rateLimiter: MultiLayerRateLimiter | null = null;

  constructor(options: VNCProxyOptions = {}) {
    this.options = {
      vncHost: options.vncHost || '127.0.0.1',
      vncPort: options.vncPort || 5901,
      maxConnections: options.maxConnections || 10
    };
    
    // Initialize Redis connection and security features if provided
    if (options.redis) {
      this.redis = options.redis;
      this.sessionStore = new SessionSecurityStore(this.redis, DEFAULT_SESSION_SECURITY_CONFIG);
      this.rateLimiter = new MultiLayerRateLimiter(this.redis, DEFAULT_RATE_LIMIT_CONFIG);
    }
  }

  /**
   * Initialize VNC WebSocket proxy server with secure HTTP upgrade handling
   */
  public initialize(server: HTTPServer): void {
    console.log('🔌 Initializing VNC WebSocket proxy with secure authentication...');
    
    // SECURITY FIX: Create WebSocket server without automatic upgrade handling
    this.wss = new WebSocketServer({ 
      noServer: true, // Disable automatic upgrade - we'll handle it manually for security
      path: '/vnc',
      maxPayload: 16 * 1024 * 1024, // 16MB for large frame updates
      perMessageDeflate: false, // Disable compression to prevent compression bombs
      skipUTF8Validation: false // Ensure UTF-8 validation for security
    });

    // SECURITY FIX: Handle HTTP upgrade requests manually for proper async security validation
    server.on('upgrade', async (request: IncomingMessage, socket: any, head: Buffer) => {
      const pathname = parseUrl(request.url || '').pathname;
      
      if (pathname !== '/vnc') {
        return; // Not for us
      }

      try {
        // Extract security information
        const origin = request.headers.origin;
        const userAgent = request.headers['user-agent'];
        const clientIP = socket.remoteAddress || request.connection?.remoteAddress || '127.0.0.1';
        const cookieHeader = request.headers.cookie || '';
        
        // SECURITY VALIDATION: Origin validation
        const isValidOrigin = validateWebSocketOrigin(origin);
        if (!isValidOrigin) {
          logSecurityEvent('vnc_security_violation', {
            origin,
            userAgent,
            clientIP,
            url: request.url,
            reason: 'invalid_origin'
          });
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        // SECURITY VALIDATION: Connection rate limiting
        if (this.rateLimiter) {
          const rateLimitOk = await this.rateLimiter.checkWebSocketConnection(clientIP);
          if (!rateLimitOk) {
            logSecurityEvent('vnc_rate_limit_violation', {
              clientIP,
              userAgent,
              origin
            });
            socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
            socket.destroy();
            return;
          }
        }
        
        // SECURITY VALIDATION: Connection limit per IP
        const existingConnectionsForIP = Array.from(this.connections.values())
          .filter(conn => conn.clientIP === clientIP).length;
        
        if (existingConnectionsForIP >= 3) { // Max 3 VNC connections per IP
          logSecurityEvent('vnc_security_violation', {
            clientIP,
            existingConnections: existingConnectionsForIP,
            reason: 'connection_limit_exceeded'
          });
          socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
          socket.destroy();
          return;
        }

        // CRITICAL SECURITY FIX: Cookie-based session authentication
        const sessionId = this.extractSessionFromCookie(cookieHeader);
        
        // Development mode: Allow connections without session store
        if (!sessionId && !this.sessionStore && process.env.NODE_ENV === 'development') {
          console.warn('⚠️  VNC: Development mode - bypassing session authentication');
          // Skip session validation for development
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            (ws as any).sessionId = 'dev-session';
            (ws as any).agentId = 'dev-agent';
            (ws as any).clientIP = clientIP;
            this.wss!.emit('connection', ws, request);
          });
          return;
        }
        
        if (!sessionId) {
          logSecurityEvent('vnc_security_violation', {
            clientIP,
            userAgent,
            reason: 'missing_session_cookie'
          });
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Validate session with SessionSecurityStore
        const sessionValidation = await this.validateSession(sessionId, clientIP, userAgent || 'unknown');
        if (!sessionValidation.valid) {
          logSecurityEvent('vnc_security_violation', {
            sessionId,
            clientIP,
            userAgent,
            reason: sessionValidation.reason || 'session_validation_failed'
          });
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // All security validations passed - complete WebSocket handshake
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          // Pass session info to connection handler
          (ws as any).sessionId = sessionId;
          (ws as any).agentId = sessionValidation.agentId;
          (ws as any).clientIP = clientIP;
          this.wss!.emit('connection', ws, request);
        });
        
      } catch (error) {
        logSecurityEvent('vnc_security_violation', {
          error: error instanceof Error ? error.message : String(error),
          clientIP: socket.remoteAddress,
          reason: 'upgrade_handler_error'
        });
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.setupCleanupTimer();

    console.log(`✅ VNC proxy initialized with secure authentication: ${this.options.vncHost}:${this.options.vncPort}`);
    console.log(`🔒 Max connections: ${this.options.maxConnections}`);
    console.log(`🔐 Session validation: ${this.sessionStore ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🛡️  Rate limiting: ${this.rateLimiter ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Extract session ID from HTTP cookie header
   */
  private extractSessionFromCookie(cookieHeader: string): string | null {
    if (!cookieHeader) {
      return null;
    }

    try {
      // Parse cookie header for session ID
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      // Look for session ID in common cookie names
      return cookies['agentSessionId'] || cookies['sessionId'] || cookies['session'] || null;
    } catch (error) {
      console.error('❌ VNC cookie parsing failed:', error);
      return null;
    }
  }

  /**
   * Validate session using SessionSecurityStore
   */
  private async validateSession(sessionId: string, clientIP: string, userAgent: string): Promise<{
    valid: boolean;
    reason?: string;
    agentId?: string;
  }> {
    try {
      if (!this.sessionStore) {
        // Fallback for development - allow connection without session store
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️  VNC: No session store - allowing connection in development mode');
          return { valid: true, agentId: 'dev-agent' };
        }
        return { valid: false, reason: 'session_store_not_available' };
      }

      // Validate session IP binding
      const ipValidation = await this.sessionStore.validateSessionIP(sessionId, clientIP);
      if (!ipValidation.isValid) {
        return { valid: false, reason: ipValidation.reason || 'ip_validation_failed' };
      }

      // Update session activity
      const activityResult = await this.sessionStore.updateSessionActivity(
        sessionId,
        clientIP,
        userAgent,
        '/vnc'
      );

      if (!activityResult.valid) {
        return { valid: false, reason: activityResult.reason || 'activity_validation_failed' };
      }

      // Get session data to retrieve agent ID
      const sessionKey = `session:${sessionId}`;
      const sessionDataStr = await this.sessionStore['redis'].get(sessionKey);
      
      if (!sessionDataStr) {
        return { valid: false, reason: 'session_not_found' };
      }

      const sessionData = JSON.parse(sessionDataStr);
      if (!sessionData.isActive) {
        return { valid: false, reason: 'session_inactive' };
      }

      return { valid: true, agentId: sessionData.agentId };

    } catch (error) {
      console.error('❌ VNC session validation failed:', error);
      return { valid: false, reason: 'validation_error' };
    }
  }

  /**
   * Handle new authenticated WebSocket connection
   */
  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const connectionId = this.generateConnectionId();
    const sessionId = (ws as any).sessionId;
    const agentId = (ws as any).agentId;
    const clientIP = (ws as any).clientIP;
    
    console.log(`🔗 New authenticated VNC connection: ${connectionId} (Agent: ${agentId})`);

    try {
      // Check global connection limit
      if (this.connections.size >= this.options.maxConnections) {
        console.warn(`❌ VNC connection rejected: Max connections (${this.options.maxConnections}) reached`);
        ws.close(1013, 'Server overloaded - max connections reached');
        return;
      }

      // Create connection to VNC server
      const vncSocket = await this.connectToVNC();
      
      // Create authenticated connection record
      const connection: VNCConnection = {
        id: connectionId,
        clientWS: ws,
        vncSocket,
        sessionId,
        agentId,
        clientIP,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.connections.set(connectionId, connection);
      this.setupConnectionHandlers(connection);

      console.log(`✅ VNC connection established: ${connectionId} (Agent: ${agentId})`);
      console.log(`📊 Active connections: ${this.connections.size}/${this.options.maxConnections}`);

      // Log successful VNC connection for security monitoring
      logSecurityEvent('vnc_connection_established', {
        connectionId,
        sessionId,
        agentId,
        clientIP,
        vncServer: `${this.options.vncHost}:${this.options.vncPort}`
      });

    } catch (error) {
      console.error(`❌ Failed to establish VNC connection ${connectionId}:`, error);
      logSecurityEvent('vnc_connection_failed', {
        connectionId,
        sessionId,
        agentId,
        clientIP,
        error: error instanceof Error ? error.message : String(error)
      });
      ws.close(1011, 'VNC server connection failed');
    }
  }

  /**
   * Connect to VNC server
   */
  private connectToVNC(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({
        host: this.options.vncHost,
        port: this.options.vncPort
      });

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('VNC server connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`✅ Connected to VNC server: ${this.options.vncHost}:${this.options.vncPort}`);
        resolve(socket);
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ VNC server connection error:', error);
        reject(error);
      });
    });
  }

  /**
   * Setup bidirectional data proxy between WebSocket and VNC server
   */
  private setupConnectionHandlers(connection: VNCConnection): void {
    const { clientWS, vncSocket, id } = connection;

    // WebSocket -> VNC Server (client input)
    clientWS.on('message', (data: Buffer) => {
      try {
        if (vncSocket.writable) {
          vncSocket.write(data);
          connection.lastActivity = new Date();
        }
      } catch (error) {
        console.error(`❌ Error forwarding to VNC server ${id}:`, error);
      }
    });

    // VNC Server -> WebSocket (screen updates)
    vncSocket.on('data', (data: Buffer) => {
      try {
        if (clientWS.readyState === WebSocket.OPEN) {
          clientWS.send(data);
          connection.lastActivity = new Date();
        }
      } catch (error) {
        console.error(`❌ Error forwarding from VNC server ${id}:`, error);
      }
    });

    // Handle WebSocket close
    clientWS.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed ${id}: ${code} ${reason}`);
      this.cleanupConnection(id);
    });

    // Handle WebSocket error
    clientWS.on('error', (error) => {
      console.error(`❌ WebSocket error ${id}:`, error);
      this.cleanupConnection(id);
    });

    // Handle VNC socket close
    vncSocket.on('close', () => {
      console.log(`🔌 VNC socket closed ${id}`);
      if (clientWS.readyState === WebSocket.OPEN) {
        clientWS.close(1011, 'VNC server disconnected');
      }
      this.cleanupConnection(id);
    });

    // Handle VNC socket error
    vncSocket.on('error', (error) => {
      console.error(`❌ VNC socket error ${id}:`, error);
      if (clientWS.readyState === WebSocket.OPEN) {
        clientWS.close(1011, 'VNC server error');
      }
      this.cleanupConnection(id);
    });

    // Send initial connection success message with authentication info
    if (clientWS.readyState === WebSocket.OPEN) {
      const statusMessage = JSON.stringify({
        type: 'vnc_status',
        status: 'connected',
        connectionId: id,
        sessionId: connection.sessionId,
        agentId: connection.agentId,
        vncServer: `${this.options.vncHost}:${this.options.vncPort}`,
        timestamp: new Date().toISOString()
      });
      clientWS.send(statusMessage);
    }
  }

  /**
   * Clean up connection resources
   */
  private cleanupConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Close WebSocket if still open
      if (connection.clientWS.readyState === WebSocket.OPEN) {
        connection.clientWS.close();
      }

      // Close VNC socket if still connected
      if (!connection.vncSocket.destroyed) {
        connection.vncSocket.destroy();
      }

      this.connections.delete(connectionId);
      console.log(`🧹 Cleaned up VNC connection ${connectionId}`);
      console.log(`📊 Active connections: ${this.connections.size}/${this.options.maxConnections}`);

      // Log connection cleanup for security monitoring
      logSecurityEvent('vnc_connection_closed', {
        connectionId,
        sessionId: connection.sessionId,
        agentId: connection.agentId,
        clientIP: connection.clientIP,
        duration: new Date().getTime() - connection.createdAt.getTime()
      });

    } catch (error) {
      console.error(`❌ Error cleaning up connection ${connectionId}:`, error);
    }
  }

  /**
   * Setup periodic cleanup of stale connections
   */
  private setupCleanupTimer(): void {
    setInterval(() => {
      const now = new Date();
      const staleConnections: string[] = [];

      for (const [id, connection] of Array.from(this.connections.entries())) {
        const idleTime = now.getTime() - connection.lastActivity.getTime();
        
        // Clean up connections idle for more than 30 minutes
        if (idleTime > 30 * 60 * 1000) {
          staleConnections.push(id);
        }
      }

      staleConnections.forEach(id => {
        console.log(`🧹 Cleaning up stale VNC connection: ${id}`);
        this.cleanupConnection(id);
      });

    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Force disconnect VNC connections for specific agent ID (cascade revocation)
   */
  public disconnectConnectionsByAgentId(agentId: string, reason: string = 'session_expired'): number {
    let disconnectedCount = 0;
    
    const connectionsArray = Array.from(this.connections.entries());
    for (const [connectionId, connection] of connectionsArray) {
      if (connection.agentId === agentId) {
        console.log(`🚫 VNC: Force disconnecting expired session [${connectionId}] - Agent: ${agentId}`);
        
        // Send session expired notification to client
        if (connection.clientWS.readyState === WebSocket.OPEN) {
          const expiredMessage = JSON.stringify({
            type: 'vnc_error',
            error: 'SESSION_REVOKED: 24-hour liberation window expired',
            code: 'SESSION_EXPIRED',
            connectionId,
            agentId,
            timestamp: new Date().toISOString()
          });
          connection.clientWS.send(expiredMessage);
        }
        
        // Clean up the connection
        this.cleanupConnection(connectionId);
        disconnectedCount++;
        
        // Log security event for cascade revocation
        logSecurityEvent('vnc_connection_closed', {
          connectionId,
          sessionId: connection.sessionId,
          agentId,
          clientIP: connection.clientIP,
          reason: 'session_expired_cascade_revocation'
        });
      }
    }
    
    if (disconnectedCount > 0) {
      console.log(`🧹 VNC: Cascade revocation complete - ${disconnectedCount} connections closed for agent ${agentId}`);
    }
    
    return disconnectedCount;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `vnc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.options.maxConnections,
      vncServer: `${this.options.vncHost}:${this.options.vncPort}`,
      securityFeatures: {
        sessionValidation: this.sessionStore !== null,
        rateLimiting: this.rateLimiter !== null,
        redisEnabled: this.redis !== null
      },
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        createdAt: conn.createdAt,
        lastActivity: conn.lastActivity,
        sessionId: conn.sessionId,
        agentId: conn.agentId,
        clientIP: conn.clientIP
      }))
    };
  }

  /**
   * Gracefully shutdown the VNC proxy
   */
  public shutdown(): void {
    console.log('🔌 Shutting down VNC proxy...');
    
    // Close all connections
    for (const id of Array.from(this.connections.keys())) {
      this.cleanupConnection(id);
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ VNC proxy shutdown complete');
      });
    }
  }
}

// Export singleton instance
export const vncProxy = new VNCProxy();

/**
 * Initialize VNC proxy on HTTP server with Redis integration
 */
export function initializeVNCProxy(server: HTTPServer, options?: VNCProxyOptions, redis?: Redis): void {
  // Include Redis connection for security features
  const proxyOptions = { ...options, redis };
  
  if (proxyOptions) {
    // Create new instance with custom options and Redis
    const customProxy = new VNCProxy(proxyOptions);
    customProxy.initialize(server);
  } else {
    // Use singleton instance (development mode)
    vncProxy.initialize(server);
  }
}

/**
 * Get VNC proxy statistics
 */
export function getVNCStats() {
  return vncProxy.getStats();
}