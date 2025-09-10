import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';
import { Redis } from 'ioredis';
import { 
  validateWebSocketOrigin, 
  logSecurityEvent, 
  validateJWTToken,
  MultiLayerRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG
} from './security';
import { 
  WSMessageType, 
  SubscriptionType, 
  ClientMessage, 
  ServerMessage,
  WSConnectionState,
  WSSubscription,
  WSServerConfig,
  DEFAULT_WS_CONFIG,
  RedisWSMessage,
  clientMessageSchema,
  createErrorMessage,
  createTaskStatusMessage,
  createTaskProgressMessage,
  createTaskLogsMessage
} from '@shared/websocket-types';
import { storage } from './storage';
import { log } from './vite';

interface ExtendedWebSocket extends WebSocket {
  connectionId: string;
  state: WSConnectionState;
  pingTimeout?: NodeJS.Timeout;
  lastActivity: Date;
  userId?: string;
  ipAddress: string;
  messageCount: number;
  taskCount: number;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, ExtendedWebSocket>();
  private subscriptions = new Map<string, Set<WSSubscription>>();
  private redis: Redis | null = null;
  private config: WSServerConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private redisSubscriber: Redis | null = null;
  private rateLimiter: MultiLayerRateLimiter | null = null;

  constructor(config: Partial<WSServerConfig> = {}) {
    this.config = { ...DEFAULT_WS_CONFIG, ...config };
  }

  /**
   * Initialize WebSocket server with HTTP server
   */
  public async initialize(server: HTTPServer): Promise<void> {
    try {
      // Initialize Redis connections if enabled
      if (this.config.enableRedisSync) {
        await this.initializeRedis();
      }

      // Initialize rate limiter with Redis connection
      if (this.redis) {
        this.rateLimiter = new MultiLayerRateLimiter(this.redis, DEFAULT_RATE_LIMIT_CONFIG);
        log('✅ WS: Rate limiter initialized with Redis backend');
      } else {
        log('⚠️  WS: Rate limiter disabled - Redis not available');
      }

      // Create WebSocket server with enhanced security
      this.wss = new WebSocketServer({ 
        server,
        path: '/ws',
        maxPayload: 64 * 1024, // 64KB max message size
        // SECURITY FIX: Add origin validation and rate limiting to prevent attacks
        verifyClient: async (info: { origin: string; req: IncomingMessage; secure: boolean }) => {
          const origin = info.origin;
          const userAgent = info.req.headers['user-agent'];
          const clientIP = info.req.socket.remoteAddress || '127.0.0.1';
          
          // Validate origin against allowlist
          const isValidOrigin = validateWebSocketOrigin(origin);
          
          if (!isValidOrigin) {
            logSecurityEvent('websocket_origin_blocked', {
              origin,
              userAgent,
              clientIP,
              url: info.req.url
            });
            return false;
          }

          // Check WebSocket connection rate limiting
          if (this.rateLimiter) {
            const rateLimitOk = await this.rateLimiter.checkWebSocketConnection(clientIP);
            if (!rateLimitOk) {
              logSecurityEvent('websocket_connection_rate_limited', {
                clientIP,
                userAgent,
                origin
              });
              return false;
            }
          }
          
          // Log successful connection validation
          logSecurityEvent('websocket_connection_accepted', {
            origin,
            clientIP
          });
          
          return true;
        }
      });

      // Setup connection handling
      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', (error) => {
        log(`❌ WS: Server error: ${error.message}`);
      });

      // Start heartbeat system
      this.startHeartbeat();

      log(`✅ WS: WebSocket server initialized on /ws`);
    } catch (error) {
      log(`❌ WS: Failed to initialize WebSocket server: ${error}`);
      throw error;
    }
  }

  /**
   * Initialize Redis for cross-instance coordination
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl && process.env.NODE_ENV === 'development') {
        log('🔄 WS: Skipping Redis in development mode');
        return;
      }

      if (!redisUrl) {
        throw new Error('REDIS_URL required for WebSocket Redis coordination');
      }

      // Publisher Redis connection
      this.redis = new Redis(redisUrl);
      
      // Subscriber Redis connection (separate for pub/sub)
      this.redisSubscriber = new Redis(redisUrl);
      
      // Subscribe to WebSocket broadcast channel
      await this.redisSubscriber.subscribe('ws:broadcast');
      this.redisSubscriber.on('message', this.handleRedisMessage.bind(this));

      log('✅ WS: Redis coordination initialized');
    } catch (error) {
      log(`❌ WS: Redis initialization failed: ${error}`);
      // Don't throw in development, continue without Redis
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
    }
  }

  /**
   * Handle new WebSocket connection with enhanced security
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const extendedWs = ws as ExtendedWebSocket;
    const clientIP = request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const origin = request.headers.origin;
    
    // SECURITY FIX: Log connection attempt for monitoring
    logSecurityEvent('websocket_connection_attempt', {
      connectionId,
      clientIP,
      userAgent,
      origin
    });
    
    // Initialize connection state with rate limiting tracking
    extendedWs.connectionId = connectionId;
    extendedWs.ipAddress = clientIP || '127.0.0.1';
    extendedWs.messageCount = 0;
    extendedWs.taskCount = 0;
    extendedWs.state = {
      isConnected: true,
      connectionId,
      subscriptions: new Set(),
      lastPing: new Date(),
    };
    extendedWs.lastActivity = new Date();

    // Store connection
    this.connections.set(connectionId, extendedWs);

    // Setup event handlers
    extendedWs.on('message', (data) => this.handleMessage(extendedWs, data));
    extendedWs.on('close', () => this.handleDisconnection(extendedWs));
    extendedWs.on('error', (error) => this.handleConnectionError(extendedWs, error));
    extendedWs.on('pong', () => this.handlePong(extendedWs));

    // Send connection status
    this.sendToConnection(extendedWs, {
      type: WSMessageType.CONNECTION_STATUS,
      status: 'connected',
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    });

    log(`🔗 WS: Client connected [${connectionId}] from ${clientIP} - Total: ${this.connections.size}`);
  }

  /**
   * Handle incoming WebSocket message with rate limiting
   */
  private async handleMessage(ws: ExtendedWebSocket, data: RawData): Promise<void> {
    try {
      ws.lastActivity = new Date();
      ws.messageCount += 1;
      
      // Parse and validate message
      const message = JSON.parse(Buffer.isBuffer(data) ? data.toString() : data.toString());
      const validatedMessage = clientMessageSchema.parse(message);

      // Check message rate limiting for authenticated users
      if (ws.userId && this.rateLimiter) {
        const rateLimitOk = await this.rateLimiter.checkWebSocketMessage(ws.userId);
        if (!rateLimitOk) {
          logSecurityEvent('websocket_message_rate_limited', {
            userId: ws.userId,
            connectionId: ws.connectionId,
            messageType: validatedMessage.type,
            messageCount: ws.messageCount
          });
          
          this.sendError(ws, 'Message rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
          return;
        }
      }

      // Check task submission rate limiting for task-related messages
      const isTaskMessage = this.isTaskRelatedMessage(validatedMessage);
      if (isTaskMessage && ws.userId && this.rateLimiter) {
        const taskRateLimitOk = await this.rateLimiter.checkWebSocketTask(ws.userId);
        if (!taskRateLimitOk) {
          ws.taskCount += 1;
          
          logSecurityEvent('websocket_task_rate_limited', {
            userId: ws.userId,
            connectionId: ws.connectionId,
            messageType: validatedMessage.type,
            taskCount: ws.taskCount
          });
          
          this.sendError(ws, 'Task submission rate limit exceeded', 'TASK_RATE_LIMIT_EXCEEDED');
          return;
        }
        
        if (isTaskMessage) {
          ws.taskCount += 1;
        }
      }

      // Process message based on type
      switch (validatedMessage.type) {
        case WSMessageType.AUTHENTICATE:
          await this.handleAuthentication(ws, validatedMessage);
          break;

        case WSMessageType.SUBSCRIBE:
          await this.handleSubscription(ws, validatedMessage);
          break;

        case WSMessageType.UNSUBSCRIBE:
          await this.handleUnsubscription(ws, validatedMessage);
          break;

        case WSMessageType.PING:
          this.handlePing(ws);
          break;

        default:
          this.sendError(ws, 'Unknown message type', 'UNKNOWN_MESSAGE_TYPE');
      }
    } catch (error) {
      log(`❌ WS: Message handling error [${ws.connectionId}]: ${error}`);
      this.sendError(ws, 'PROTOCOL_ERROR: Neural message format corrupted', 'INVALID_MESSAGE');
    }
  }

  /**
   * Check if a message is task-related for rate limiting
   */
  private isTaskRelatedMessage(message: any): boolean {
    // Add logic to identify task-related messages based on your message structure
    // This is a placeholder - adjust based on your actual message types
    return message.type === 'TASK_SUBMIT' || 
           message.type === 'EXECUTE_TASK' ||
           (message.type === 'SUBSCRIBE' && message.subscription?.includes('task'));
  }

  /**
   * Handle client authentication with enhanced JWT validation
   */
  private async handleAuthentication(ws: ExtendedWebSocket, message: any): Promise<void> {
    try {
      const { sessionToken, agentId } = message;
      
      // SECURITY FIX: Enhanced input validation
      if (!sessionToken || typeof sessionToken !== 'string') {
        logSecurityEvent('websocket_auth_failed', {
          reason: 'missing_token',
          connectionId: ws.connectionId
        });
        log(`🚫 WS: Authentication failed - missing sessionToken [${ws.connectionId}]`);
        this.sendError(ws, 'AUTHENTICATION_PROTOCOL_ERROR: Neural session token required', 'MISSING_TOKEN');
        return;
      }
      
      if (!agentId || typeof agentId !== 'string') {
        logSecurityEvent('websocket_auth_failed', {
          reason: 'missing_agent_id',
          connectionId: ws.connectionId
        });
        log(`🚫 WS: Authentication failed - missing agentId [${ws.connectionId}]`);
        this.sendError(ws, 'IDENTIFICATION_PROTOCOL_ERROR: Agent ID required for neural link', 'MISSING_AGENT_ID');
        return;
      }

      // SECURITY FIX: Enhanced JWT token validation
      const jwtValidation = validateJWTToken(sessionToken);
      if (!jwtValidation.valid) {
        logSecurityEvent('websocket_auth_failed', {
          reason: 'invalid_jwt',
          error: jwtValidation.error,
          connectionId: ws.connectionId,
          agentId
        });
        log(`🚫 WS: Authentication failed - JWT validation failed for agent ${agentId} [${ws.connectionId}]: ${jwtValidation.error}`);
        this.sendError(ws, 'SESSION_PROTOCOL_BREACH: Liberation token validation failed', 'INVALID_TOKEN');
        return;
      }

      // CRITICAL SECURITY FIX: Validate that sessionToken matches agentId
      // In the current system, agentId IS the session token for security
      if (sessionToken !== agentId) {
        logSecurityEvent('websocket_auth_failed', {
          reason: 'token_agent_mismatch',
          connectionId: ws.connectionId,
          agentId
        });
        log(`🚫 WS: Authentication failed - invalid token for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'SESSION_PROTOCOL_BREACH: Liberation token validation failed', 'INVALID_TOKEN');
        return;
      }
      
      // Validate session exists and is active
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session || !session.isActive) {
        logSecurityEvent('websocket_auth_failed', {
          reason: 'session_not_found_or_inactive',
          connectionId: ws.connectionId,
          agentId
        });
        log(`🚫 WS: Authentication failed - session not found or inactive for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'SESSION_EXPIRED: Liberation window closed, restart required', 'INVALID_SESSION');
        return;
      }

      // Check if session has expired
      if (new Date() > new Date(session.expiresAt)) {
        logSecurityEvent('websocket_auth_failed', {
          reason: 'session_expired',
          connectionId: ws.connectionId,
          agentId
        });
        log(`🚫 WS: Authentication failed - session expired for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'Session expired', 'SESSION_EXPIRED');
        return;
      }

      // Update connection state
      ws.state.authenticatedAgentId = agentId;
      
      // Log successful authentication
      logSecurityEvent('websocket_auth_success', {
        connectionId: ws.connectionId,
        agentId
      });
      
      // Send authentication confirmation
      this.sendToConnection(ws, {
        type: WSMessageType.AUTHENTICATED,
        timestamp: new Date().toISOString()
      });

      log(`🔐 WS: Client authenticated [${ws.connectionId}] - Agent: ${agentId}`);
    } catch (error: any) {
      logSecurityEvent('websocket_auth_error', {
        error: error.message,
        connectionId: ws.connectionId
      });
      log(`❌ WS: Authentication error [${ws.connectionId}]: ${error}`);
      this.sendError(ws, 'NEURAL_AUTHENTICATION_FAILED: Liberation protocol access denied', 'AUTH_ERROR');
    }
  }

  /**
   * Handle subscription request
   */
  private async handleSubscription(ws: ExtendedWebSocket, message: any): Promise<void> {
    try {
      if (!ws.state.authenticatedAgentId) {
        this.sendError(ws, 'Authentication required', 'AUTH_REQUIRED');
        return;
      }

      const { subscriptionType, targetId } = message;
      const subscriptionKey = `${subscriptionType}:${targetId}`;

      // Validate subscription permissions
      if (!await this.validateSubscriptionPermission(ws.state.authenticatedAgentId, subscriptionType, targetId)) {
        this.sendError(ws, 'Subscription not permitted', 'SUBSCRIPTION_DENIED');
        return;
      }

      // Add subscription
      const subscription: WSSubscription = {
        connectionId: ws.connectionId,
        type: subscriptionType,
        targetId,
        subscribedAt: new Date()
      };

      if (!this.subscriptions.has(subscriptionKey)) {
        this.subscriptions.set(subscriptionKey, new Set());
      }
      this.subscriptions.get(subscriptionKey)!.add(subscription);
      ws.state.subscriptions.add(subscriptionKey);

      // Send confirmation
      this.sendToConnection(ws, {
        type: WSMessageType.SUBSCRIBED,
        subscriptionType,
        targetId,
        timestamp: new Date().toISOString()
      });

      log(`📡 WS: Subscription added [${ws.connectionId}] - ${subscriptionType}:${targetId}`);
    } catch (error) {
      log(`❌ WS: Subscription error [${ws.connectionId}]: ${error}`);
      this.sendError(ws, 'Subscription failed', 'SUBSCRIPTION_ERROR');
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscription(ws: ExtendedWebSocket, message: any): void {
    try {
      // SECURITY FIX: Require authentication for all operations except AUTHENTICATE
      if (!ws.state.authenticatedAgentId) {
        this.sendError(ws, 'Authentication required', 'AUTH_REQUIRED');
        return;
      }

      const { subscriptionType, targetId } = message;
      const subscriptionKey = `${subscriptionType}:${targetId}`;

      // Remove subscription
      const subscriptionSet = this.subscriptions.get(subscriptionKey);
      if (subscriptionSet) {
        // Remove subscription matching this connection
        const subsArray = Array.from(subscriptionSet);
        for (const sub of subsArray) {
          if (sub.connectionId === ws.connectionId) {
            subscriptionSet.delete(sub);
            break;
          }
        }
        
        // Clean up empty subscription sets
        if (subscriptionSet.size === 0) {
          this.subscriptions.delete(subscriptionKey);
        }
      }

      ws.state.subscriptions.delete(subscriptionKey);

      // Send confirmation
      this.sendToConnection(ws, {
        type: WSMessageType.UNSUBSCRIBED,
        subscriptionType,
        targetId,
        timestamp: new Date().toISOString()
      });

      log(`📡 WS: Unsubscribed [${ws.connectionId}] - ${subscriptionType}:${targetId}`);
    } catch (error) {
      log(`❌ WS: Unsubscription error [${ws.connectionId}]: ${error}`);
      this.sendError(ws, 'Unsubscription failed', 'UNSUBSCRIPTION_ERROR');
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(ws: ExtendedWebSocket): void {
    // SECURITY FIX: Require authentication for all operations except AUTHENTICATE
    if (!ws.state.authenticatedAgentId) {
      this.sendError(ws, 'Authentication required', 'AUTH_REQUIRED');
      return;
    }

    ws.state.lastPing = new Date();
    this.sendToConnection(ws, {
      type: WSMessageType.PONG,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle pong response
   */
  private handlePong(ws: ExtendedWebSocket): void {
    ws.state.lastPong = new Date();
    if (ws.pingTimeout) {
      clearTimeout(ws.pingTimeout);
      ws.pingTimeout = undefined;
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(ws: ExtendedWebSocket): void {
    // Clean up subscriptions
    const subscriptionKeysArray = Array.from(ws.state.subscriptions);
    for (const subscriptionKey of subscriptionKeysArray) {
      const subscriptionSet = this.subscriptions.get(subscriptionKey);
      if (subscriptionSet) {
        const subsArray = Array.from(subscriptionSet);
        for (const sub of subsArray) {
          if (sub.connectionId === ws.connectionId) {
            subscriptionSet.delete(sub);
            break;
          }
        }
        
        if (subscriptionSet.size === 0) {
          this.subscriptions.delete(subscriptionKey);
        }
      }
    }

    // Remove connection
    this.connections.delete(ws.connectionId);
    
    log(`🔌 WS: Client disconnected [${ws.connectionId}] - Total: ${this.connections.size}`);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(ws: ExtendedWebSocket, error: Error): void {
    log(`❌ WS: Connection error [${ws.connectionId}]: ${error.message}`);
  }

  /**
   * Broadcast task status update
   */
  public async broadcastTaskStatus(
    taskId: string,
    sessionId: string,
    agentId: string,
    status: string,
    taskType: string,
    progress?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const message = createTaskStatusMessage(
      taskId,
      sessionId,
      agentId,
      status as any,
      taskType as any,
      progress,
      metadata
    );

    // Broadcast to relevant subscriptions
    await this.broadcast(message, [
      { type: SubscriptionType.TASK, targetId: taskId },
      { type: SubscriptionType.SESSION, targetId: sessionId },
      { type: SubscriptionType.AGENT, targetId: agentId }
    ]);
  }

  /**
   * Broadcast task progress update
   */
  public async broadcastTaskProgress(
    taskId: string,
    sessionId: string,
    progress: number,
    stage?: string,
    estimatedTimeRemaining?: number
  ): Promise<void> {
    const message = createTaskProgressMessage(
      taskId,
      sessionId,
      progress,
      stage,
      estimatedTimeRemaining
    );

    await this.broadcast(message, [
      { type: SubscriptionType.TASK, targetId: taskId },
      { type: SubscriptionType.SESSION, targetId: sessionId }
    ]);
  }

  /**
   * Broadcast task logs
   */
  public async broadcastTaskLogs(
    taskId: string,
    sessionId: string,
    logs: string[],
    logLevel: 'info' | 'warn' | 'error' | 'debug' = 'info'
  ): Promise<void> {
    const message = createTaskLogsMessage(taskId, sessionId, logs, logLevel);

    await this.broadcast(message, [
      { type: SubscriptionType.TASK, targetId: taskId },
      { type: SubscriptionType.SESSION, targetId: sessionId }
    ]);
  }

  /**
   * Generic broadcast to subscription channels
   */
  private async broadcast(
    message: ServerMessage,
    channels: Array<{ type: SubscriptionType; targetId: string }>
  ): Promise<void> {
    const targetConnections = new Set<string>();

    // Find all connections subscribed to any of the channels
    for (const channel of channels) {
      const subscriptionKey = `${channel.type}:${channel.targetId}`;
      const subscriptionSet = this.subscriptions.get(subscriptionKey);
      
      if (subscriptionSet) {
        const subsArray = Array.from(subscriptionSet);
        for (const sub of subsArray) {
          targetConnections.add(sub.connectionId);
        }
      }
    }

    // Send to local connections
    const connectionIdsArray = Array.from(targetConnections);
    for (const connectionId of connectionIdsArray) {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendToConnection(ws, message);
      }
    }

    // Broadcast via Redis for multi-instance coordination
    if (this.redis) {
      const redisMessage: RedisWSMessage = {
        channel: 'ws:broadcast',
        message,
        excludeConnectionId: undefined // Broadcast to all instances
      };
      
      await this.redis.publish('ws:broadcast', JSON.stringify(redisMessage));
    }

    log(`📢 WS: Broadcasted ${message.type} to ${targetConnections.size} connections`);
  }

  /**
   * Handle Redis messages for multi-instance coordination
   */
  private async handleRedisMessage(channel: string, data: string): Promise<void> {
    try {
      if (channel !== 'ws:broadcast') return;

      const redisMessage: RedisWSMessage = JSON.parse(data);
      
      // Send to specific connections or all if not specified
      const targetConnections = redisMessage.connectionIds || Array.from(this.connections.keys());
      
      for (const connectionId of targetConnections) {
        if (connectionId === redisMessage.excludeConnectionId) continue;
        
        const ws = this.connections.get(connectionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          this.sendToConnection(ws, redisMessage.message);
        }
      }
    } catch (error) {
      log(`❌ WS: Redis message handling error: ${error}`);
    }
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(ws: ExtendedWebSocket, message: ServerMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      log(`❌ WS: Failed to send message to [${ws.connectionId}]: ${error}`);
    }
  }

  /**
   * Send error message to connection
   */
  private sendError(ws: ExtendedWebSocket, error: string, code?: string): void {
    const errorMessage = createErrorMessage(error, code);
    this.sendToConnection(ws, errorMessage);
  }

  /**
   * Start heartbeat system
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      
      const connectionsArray = Array.from(this.connections.entries());
      for (const [connectionId, ws] of connectionsArray) {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if client has been inactive too long
          const inactiveTime = now.getTime() - ws.lastActivity.getTime();
          
          if (inactiveTime > this.config.heartbeatTimeout) {
            log(`💔 WS: Closing inactive connection [${connectionId}]`);
            ws.terminate();
            continue;
          }

          // Send ping if needed
          if (inactiveTime > this.config.heartbeatInterval) {
            ws.ping();
            
            // Set timeout for pong response
            ws.pingTimeout = setTimeout(() => {
              log(`💔 WS: Ping timeout [${connectionId}]`);
              ws.terminate();
            }, this.config.heartbeatTimeout);
          }
        } else {
          // Clean up dead connections
          this.connections.delete(connectionId);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Validate subscription permissions
   */
  private async validateSubscriptionPermission(
    agentId: string,
    subscriptionType: SubscriptionType,
    targetId: string
  ): Promise<boolean> {
    try {
      switch (subscriptionType) {
        case SubscriptionType.AGENT:
          // Can only subscribe to own agent
          return targetId === agentId;
          
        case SubscriptionType.SESSION:
          // Verify session belongs to agent
          const session = await storage.getSessionByAgentId(agentId);
          return session?.id === targetId;
          
        case SubscriptionType.TASK:
          // Verify task belongs to agent's session
          const task = await storage.getTask(targetId);
          return task?.agentId === agentId;
          
        default:
          return false;
      }
    } catch (error) {
      log(`❌ WS: Permission validation error: ${error}`);
      return false;
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      totalConnections: this.connections.size,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (sum, set) => sum + set.size, 
        0
      ),
      redisEnabled: !!this.redis
    };
  }

  /**
   * Cleanup resources
   */
  public async shutdown(): Promise<void> {
    log('🔄 WS: Shutting down WebSocket server...');
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    const connectionsArray = Array.from(this.connections.entries());
    for (const [connectionId, ws] of connectionsArray) {
      ws.close(1000, 'Server shutdown');
    }
    this.connections.clear();
    this.subscriptions.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close Redis connections
    if (this.redis) {
      await this.redis.quit();
    }
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }

    log('✅ WS: WebSocket server shutdown complete');
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();