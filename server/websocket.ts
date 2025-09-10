import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';
import { Redis } from 'ioredis';
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
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, ExtendedWebSocket>();
  private subscriptions = new Map<string, Set<WSSubscription>>();
  private redis: Redis | null = null;
  private config: WSServerConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private redisSubscriber: Redis | null = null;

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

      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        server,
        path: '/ws',
        maxPayload: 64 * 1024, // 64KB max message size
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
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const extendedWs = ws as ExtendedWebSocket;
    
    // Initialize connection state
    extendedWs.connectionId = connectionId;
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

    log(`🔗 WS: Client connected [${connectionId}] - Total: ${this.connections.size}`);
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(ws: ExtendedWebSocket, data: RawData): Promise<void> {
    try {
      ws.lastActivity = new Date();
      
      const message = JSON.parse(Buffer.isBuffer(data) ? data.toString() : data.toString());
      const validatedMessage = clientMessageSchema.parse(message);

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
      this.sendError(ws, 'Invalid message format', 'INVALID_MESSAGE');
    }
  }

  /**
   * Handle client authentication
   */
  private async handleAuthentication(ws: ExtendedWebSocket, message: any): Promise<void> {
    try {
      const { sessionToken, agentId } = message;
      
      // Validate input parameters
      if (!sessionToken || typeof sessionToken !== 'string') {
        log(`🚫 WS: Authentication failed - missing sessionToken [${ws.connectionId}]`);
        this.sendError(ws, 'Session token required', 'MISSING_TOKEN');
        return;
      }
      
      if (!agentId || typeof agentId !== 'string') {
        log(`🚫 WS: Authentication failed - missing agentId [${ws.connectionId}]`);
        this.sendError(ws, 'Agent ID required', 'MISSING_AGENT_ID');
        return;
      }

      // CRITICAL SECURITY FIX: Validate that sessionToken matches agentId
      // In the current system, agentId IS the session token for security
      if (sessionToken !== agentId) {
        log(`🚫 WS: Authentication failed - invalid token for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'Invalid session token', 'INVALID_TOKEN');
        return;
      }
      
      // Validate session exists and is active
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session || !session.isActive) {
        log(`🚫 WS: Authentication failed - session not found or inactive for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'Invalid or expired session', 'INVALID_SESSION');
        return;
      }

      // Check if session has expired
      if (new Date() > new Date(session.expiresAt)) {
        log(`🚫 WS: Authentication failed - session expired for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'Session expired', 'SESSION_EXPIRED');
        return;
      }

      // Update connection state
      ws.state.authenticatedAgentId = agentId;
      
      // Send authentication confirmation
      this.sendToConnection(ws, {
        type: WSMessageType.AUTHENTICATED,
        timestamp: new Date().toISOString()
      });

      log(`🔐 WS: Client authenticated [${ws.connectionId}] - Agent: ${agentId}`);
    } catch (error) {
      log(`❌ WS: Authentication error [${ws.connectionId}]: ${error}`);
      this.sendError(ws, 'Authentication failed', 'AUTH_ERROR');
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