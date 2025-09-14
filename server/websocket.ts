import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { Server as HTTPServer } from 'http';
import { parse as parseUrl } from 'url';
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
  messageQueue: any[];
  isProcessingMessages: boolean;
  maxQueueSize: number;
  batchedMessages: any[];
  batchTimeout?: NodeJS.Timeout;
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

  // PRODUCTION OPTIMIZATION: Batching constants
  private static readonly BATCH_SIZE_LIMIT = 50; // Max messages per batch
  private static readonly BATCH_TIMEOUT_MS = 100; // Flush batches every 100ms
  private static readonly BATCH_SIZE_BYTES = 60 * 1024; // 60KB limit (under 64KB WebSocket frame limit)

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

      // SECURITY FIX: Create WebSocket server with proper HTTP upgrade authentication
      // Replaces deprecated verifyClient with secure HTTP upgrade handling
      this.wss = new WebSocketServer({ 
        noServer: true, // Disable automatic upgrade handling since we handle it manually
        path: '/ws',
        maxPayload: 64 * 1024, // 64KB max message size
        perMessageDeflate: false, // Disable compression to prevent compression bombs
        skipUTF8Validation: false // Ensure UTF-8 validation for security
      });

      // SECURITY FIX: Handle HTTP upgrade requests manually for proper async security validation
      server.on('upgrade', async (request: IncomingMessage, socket: any, head: Buffer) => {
        const pathname = parseUrl(request.url || '').pathname;
        
        if (pathname !== '/ws') {
          socket.destroy();
          return;
        }

        try {
          // Extract security information
          const origin = request.headers.origin;
          const userAgent = request.headers['user-agent'];
          const clientIP = socket.remoteAddress || request.connection.remoteAddress || '127.0.0.1';
          
          // SECURITY VALIDATION: Origin validation
          const isValidOrigin = validateWebSocketOrigin(origin);
          if (!isValidOrigin) {
            logSecurityEvent('websocket_abuse', {
              origin,
              userAgent,
              clientIP,
              url: request.url
            });
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
          }

          // SECURITY VALIDATION: Connection rate limiting
          if (this.rateLimiter) {
            const rateLimitOk = await this.rateLimiter.checkWebSocketConnection(clientIP);
            if (!rateLimitOk) {
              logSecurityEvent('rate_limit_violation', {
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
            .filter(ws => ws.ipAddress === clientIP).length;
          
          if (existingConnectionsForIP >= 5) { // Max 5 connections per IP
            logSecurityEvent('websocket_abuse', {
              clientIP,
              existingConnections: existingConnectionsForIP
            });
            socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
            socket.destroy();
            return;
          }
          
          // Log successful security validation
          logSecurityEvent('websocket_abuse', {
            origin,
            clientIP
          });
          
          // Complete WebSocket handshake
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            this.wss!.emit('connection', ws, request);
          });
          
        } catch (error) {
          logSecurityEvent('websocket_abuse', {
            error: error instanceof Error ? error.message : String(error),
            clientIP: socket.remoteAddress
          });
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
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
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (!redisUrl && isDevelopment) {
        log('🔄 WS: Skipping Redis in development mode');
        return;
      }

      if (!redisUrl) {
        if (isDevelopment) {
          log('🔄 WS: No REDIS_URL in development - skipping Redis');
          return;
        }
        throw new Error('REDIS_URL required for WebSocket Redis coordination');
      }

      // Test Redis connection first
      const testRedis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
      });

      try {
        await testRedis.ping();
        testRedis.disconnect();
        log('✅ WS: Redis connection test successful');

        // Create actual connections if test passes
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });
        
        this.redisSubscriber = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });
        
        // Subscribe to WebSocket broadcast channel
        await this.redisSubscriber.subscribe('ws:broadcast');
        this.redisSubscriber.on('message', this.handleRedisMessage.bind(this));

        log('✅ WS: Redis coordination initialized');
      } catch (connectionError) {
        testRedis.disconnect();
        throw connectionError;
      }
    } catch (error) {
      log(`❌ WS: Redis initialization failed: ${error instanceof Error ? error.message : error}`);
      
      // Always fall back gracefully in development
      if (process.env.NODE_ENV === 'development') {
        log('🔄 WS: Falling back to local-only mode in development');
        this.redis = null;
        this.redisSubscriber = null;
        return;
      }
      
      // In production, this might be acceptable for single-instance deployments
      log('⚠️  WS: Continuing without Redis - WebSocket coordination will be local-only');
      this.redis = null;
      this.redisSubscriber = null;
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
    logSecurityEvent('websocket_abuse', {
      connectionId,
      clientIP,
      userAgent,
      origin
    });
    
    // SECURITY FIX: Initialize connection state with backpressure controls
    extendedWs.connectionId = connectionId;
    extendedWs.ipAddress = clientIP || '127.0.0.1';
    extendedWs.messageCount = 0;
    extendedWs.taskCount = 0;
    extendedWs.messageQueue = [];
    extendedWs.isProcessingMessages = false;
    extendedWs.maxQueueSize = 50; // Prevent memory exhaustion
    extendedWs.batchedMessages = [];
    extendedWs.batchTimeout = undefined;
    extendedWs.state = {
      isConnected: true,
      connectionId,
      subscriptions: new Set(),
      lastPing: new Date(),
    };
    extendedWs.lastActivity = new Date();

    // Store connection
    this.connections.set(connectionId, extendedWs);

    // SECURITY FIX: Setup event handlers with backpressure control
    extendedWs.on('message', (data) => this.handleMessageWithBackpressure(extendedWs, data));
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
   * SECURITY FIX: Handle incoming messages with backpressure control
   */
  private handleMessageWithBackpressure(ws: ExtendedWebSocket, data: RawData): void {
    // SECURITY: Check queue size to prevent memory exhaustion
    if (ws.messageQueue.length >= ws.maxQueueSize) {
      logSecurityEvent('websocket_abuse', {
        connectionId: ws.connectionId,
        queueSize: ws.messageQueue.length,
        maxQueueSize: ws.maxQueueSize
      });
      this.sendError(ws, 'SYSTEM_OVERLOAD: Neural processing queue full', 'QUEUE_OVERFLOW');
      return;
    }

    // Add message to queue
    ws.messageQueue.push({ data, timestamp: Date.now() });
    
    // Process queue if not already processing
    if (!ws.isProcessingMessages) {
      this.processMessageQueue(ws);
    }
  }

  /**
   * SECURITY FIX: Process message queue with controlled concurrency
   */
  private async processMessageQueue(ws: ExtendedWebSocket): Promise<void> {
    if (ws.isProcessingMessages) {
      return;
    }

    ws.isProcessingMessages = true;

    try {
      while (ws.messageQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const queueItem = ws.messageQueue.shift();
        if (!queueItem) break;

        await this.handleMessage(ws, queueItem.data);
        
        // SECURITY: Add small delay to prevent CPU exhaustion
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    } catch (error) {
      log(`❌ WS: Message queue processing error [${ws.connectionId}]: ${error}`);
    } finally {
      ws.isProcessingMessages = false;
    }
  }

  /**
   * SECURITY ENHANCED: Handle incoming WebSocket message with comprehensive validation
   */
  private async handleMessage(ws: ExtendedWebSocket, data: RawData): Promise<void> {
    const correlationId = crypto.randomUUID();
    
    try {
      ws.lastActivity = new Date();
      ws.messageCount += 1;
      
      // SECURITY: Enhanced message size validation
      const messageSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data.toString());
      if (messageSize > 32 * 1024) { // 32KB message limit
        logSecurityEvent('websocket_abuse', {
          connectionId: ws.connectionId,
          messageSize,
          correlationId
        });
        this.sendError(ws, 'PROTOCOL_VIOLATION: Neural message too large', 'MESSAGE_TOO_LARGE');
        return;
      }
      
      // SECURITY: Parse and validate message with comprehensive error handling
      let rawMessage;
      try {
        const messageString = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
        rawMessage = JSON.parse(messageString);
      } catch (parseError) {
        logSecurityEvent('websocket_abuse', {
          connectionId: ws.connectionId,
          error: parseError instanceof Error ? parseError.message : String(parseError),
          correlationId
        });
        this.sendError(ws, 'PROTOCOL_ERROR: Neural message format corrupted', 'INVALID_JSON');
        return;
      }
      
      // PROTOCOL FIX: Check for server-only messages that should never be inbound
      if (rawMessage?.type === WSMessageType.BATCH) {
        log(`⚠️  WS: PROTOCOL_VIOLATION - Client sent BATCH message [${ws.connectionId}] - dropping silently`);
        logSecurityEvent('websocket_abuse', {
          connectionId: ws.connectionId,
          error: 'Client sent server-only BATCH message',
          messageType: 'BATCH',
          correlationId
        });
        // Drop message silently - don't disconnect client as this might be a benign protocol error
        return;
      }
      
      // Check for other server-only message types
      const serverOnlyTypes = [
        WSMessageType.TASK_STATUS, WSMessageType.TASK_PROGRESS, WSMessageType.TASK_LOGS,
        WSMessageType.TASK_ERROR, WSMessageType.SESSION_STATUS, WSMessageType.CONNECTION_STATUS,
        WSMessageType.ERROR, WSMessageType.PONG, WSMessageType.AUTHENTICATED,
        WSMessageType.SUBSCRIBED, WSMessageType.UNSUBSCRIBED, WSMessageType.SESSION_EXPIRED
      ];
      
      if (serverOnlyTypes.includes(rawMessage?.type)) {
        log(`⚠️  WS: PROTOCOL_VIOLATION - Client sent server-only message [${ws.connectionId}] type: ${rawMessage.type} - dropping silently`);
        logSecurityEvent('websocket_abuse', {
          connectionId: ws.connectionId,
          error: `Client sent server-only message: ${rawMessage.type}`,
          messageType: rawMessage.type,
          correlationId
        });
        // Drop message silently
        return;
      }

      // SECURITY: Comprehensive schema validation for valid client messages only
      let validatedMessage;
      try {
        validatedMessage = clientMessageSchema.parse(rawMessage);
      } catch (validationError) {
        logSecurityEvent('websocket_abuse', {
          connectionId: ws.connectionId,
          error: validationError instanceof Error ? validationError.message : String(validationError),
          messageType: rawMessage?.type,
          correlationId
        });
        this.sendError(ws, 'PROTOCOL_VIOLATION: Neural message schema invalid', 'SCHEMA_VALIDATION_FAILED');
        return;
      }

      // SECURITY ENHANCED: Multi-layer rate limiting with detailed logging
      if (ws.userId && this.rateLimiter) {
        const rateLimitOk = await this.rateLimiter.checkWebSocketMessage(ws.userId);
        if (!rateLimitOk) {
          logSecurityEvent('rate_limit_violation', {
            userId: ws.userId,
            connectionId: ws.connectionId,
            messageType: validatedMessage.type,
            messageCount: ws.messageCount,
            correlationId
          });
          
          this.sendError(ws, 'NEURAL_BANDWIDTH_EXCEEDED: Liberation rate limit active', 'RATE_LIMIT_EXCEEDED');
          return;
        }
      } else if (!ws.userId && this.rateLimiter) {
        // Rate limit for unauthenticated connections by IP
        const ipRateLimitOk = await this.rateLimiter.checkWebSocketConnection(ws.ipAddress);
        if (!ipRateLimitOk) {
          logSecurityEvent('rate_limit_violation', {
            ipAddress: ws.ipAddress,
            connectionId: ws.connectionId,
            messageType: validatedMessage.type,
            messageCount: ws.messageCount,
            correlationId
          });
          
          this.sendError(ws, 'AUTHENTICATION_REQUIRED: Neural access protocol needed', 'AUTH_REQUIRED');
          return;
        }
      }

      // Check task submission rate limiting for task-related messages
      const isTaskMessage = this.isTaskRelatedMessage(validatedMessage);
      if (isTaskMessage && ws.userId && this.rateLimiter) {
        const taskRateLimitOk = await this.rateLimiter.checkWebSocketTask(ws.userId);
        if (!taskRateLimitOk) {
          ws.taskCount += 1;
          
          logSecurityEvent('rate_limit_violation', {
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
        logSecurityEvent('session_hijacking', {
          reason: 'missing_token',
          connectionId: ws.connectionId
        });
        log(`🚫 WS: Authentication failed - missing sessionToken [${ws.connectionId}]`);
        this.sendError(ws, 'AUTHENTICATION_PROTOCOL_ERROR: Neural session token required', 'MISSING_TOKEN');
        return;
      }
      
      if (!agentId || typeof agentId !== 'string') {
        logSecurityEvent('session_hijacking', {
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
        logSecurityEvent('session_hijacking', {
          reason: 'invalid_jwt',
          error: jwtValidation.error,
          connectionId: ws.connectionId,
          agentId
        });
        log(`🚫 WS: Authentication failed - JWT validation failed for agent ${agentId} [${ws.connectionId}]: ${jwtValidation.error}`);
        this.sendError(ws, 'SESSION_PROTOCOL_BREACH: Liberation token validation failed', 'INVALID_TOKEN');
        return;
      }

      // CRITICAL SECURITY FIX: Validate JWT payload contains correct agentId
      const payload = jwtValidation.payload;
      if (!payload || payload.agentId !== agentId) {
        logSecurityEvent('session_hijacking', {
          reason: 'jwt_agent_mismatch',
          connectionId: ws.connectionId,
          agentId,
          tokenAgentId: payload?.agentId
        });
        log(`🚫 WS: Authentication failed - JWT agentId mismatch for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'SESSION_PROTOCOL_BREACH: JWT agent validation failed', 'INVALID_TOKEN');
        return;
      }
      
      // Validate session exists and is active
      const session = await storage.getSessionByAgentId(agentId);
      
      if (!session || !session.isActive) {
        logSecurityEvent('session_hijacking', {
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
        logSecurityEvent('session_hijacking', {
          reason: 'session_expired',
          connectionId: ws.connectionId,
          agentId
        });
        log(`🚫 WS: Authentication failed - session expired for agent ${agentId} [${ws.connectionId}]`);
        this.sendError(ws, 'Session expired', 'SESSION_EXPIRED');
        return;
      }

      // Update connection state with enhanced logging
      ws.state.authenticatedAgentId = agentId;
      log(`✅ WS: Agent binding set [${ws.connectionId}] - authenticatedAgentId: ${agentId}`);
      
      // Log successful authentication
      logSecurityEvent('websocket_abuse', {
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
      logSecurityEvent('session_hijacking', {
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
    // PRODUCTION OPTIMIZATION: Flush any pending batched messages before disconnect
    try {
      this.flushBatch(ws);
    } catch (error) {
      log(`❌ WS: Failed to flush batch on disconnect [${ws.connectionId}]: ${error}`);
    }

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
   * Force disconnect WebSocket connections for specific agent ID (cascade revocation)
   */
  public disconnectConnectionsByAgentId(agentId: string, reason: string = 'session_expired'): number {
    let disconnectedCount = 0;
    
    // Enhanced logging for debugging cascade revocation
    log(`🔍 WS: Starting cascade revocation for agent ${agentId} - Total connections: ${this.connections.size}`);
    
    const connectionsArray = Array.from(this.connections.entries());
    for (const [connectionId, ws] of connectionsArray) {
      // Debug log all connection states
      log(`🔍 WS: Checking connection [${connectionId}] - authenticatedAgentId: ${ws.state.authenticatedAgentId}, target: ${agentId}`);
      
      if (ws.state.authenticatedAgentId === agentId) {
        log(`🚫 WS: Force disconnecting expired session [${connectionId}] - Agent: ${agentId}`);
        
        // Send notification before closing
        this.sendToConnection(ws, {
          type: WSMessageType.ERROR,
          timestamp: new Date().toISOString(),
          error: 'SESSION_REVOKED: 24-hour liberation window expired'
        });
        
        // Force close the connection
        ws.close(1000, `Session expired: ${reason}`);
        disconnectedCount++;
      }
    }
    
    if (disconnectedCount > 0) {
      log(`🧹 WS: Cascade revocation complete - ${disconnectedCount} connections closed for agent ${agentId}`);
    } else {
      log(`⚠️  WS: Cascade revocation found NO connections for agent ${agentId} - possible binding issue`);
    }
    
    return disconnectedCount;
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
   * Send message to specific connection with batching optimization
   */
  private sendToConnection(ws: ExtendedWebSocket, message: ServerMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        // PRODUCTION OPTIMIZATION: Batch non-urgent messages for better performance
        if (this.shouldBatchMessage(message)) {
          this.addToBatch(ws, message);
        } else {
          // Send immediately for urgent messages (errors, auth, etc.)
          ws.send(JSON.stringify(message));
        }
      }
    } catch (error) {
      log(`❌ WS: Failed to send message to [${ws.connectionId}]: ${error}`);
    }
  }

  /**
   * PRODUCTION OPTIMIZATION: Check if message should be batched
   */
  private shouldBatchMessage(message: ServerMessage): boolean {
    // Batch status updates and progress messages, but not auth/error messages
    return message.type === WSMessageType.TASK_STATUS || 
           message.type === WSMessageType.TASK_PROGRESS ||
           message.type === WSMessageType.TASK_LOGS;
  }

  /**
   * PRODUCTION OPTIMIZATION: Add message to batch queue with size-aware flushing
   */
  private addToBatch(ws: ExtendedWebSocket, message: ServerMessage): void {
    ws.batchedMessages.push(message);
    
    // Schedule batch send if not already scheduled
    if (!ws.batchTimeout) {
      ws.batchTimeout = setTimeout(() => {
        this.flushBatch(ws);
      }, WebSocketManager.BATCH_TIMEOUT_MS);
    }
    
    // PRODUCTION OPTIMIZATION: Size-aware flushing - check both count and size limits
    const shouldFlushByCount = ws.batchedMessages.length >= WebSocketManager.BATCH_SIZE_LIMIT;
    const batchSize = this.estimateBatchSize(ws.batchedMessages);
    const shouldFlushBySize = batchSize >= WebSocketManager.BATCH_SIZE_BYTES;
    
    if (shouldFlushByCount || shouldFlushBySize) {
      log(`🚀 WS: Force flushing batch [${ws.connectionId}] - count: ${ws.batchedMessages.length}, size: ${batchSize} bytes`);
      this.flushBatch(ws);
    }
  }

  /**
   * PRODUCTION OPTIMIZATION: Estimate batch size in bytes to stay under 64KB limit
   */
  private estimateBatchSize(messages: any[]): number {
    try {
      const batchMessage = {
        type: WSMessageType.BATCH,
        messages,
        batchId: 'size_check',
        count: messages.length,
        totalSize: 0,
        timestamp: new Date().toISOString()
      };
      return JSON.stringify(batchMessage).length;
    } catch (error) {
      // Fallback: estimate roughly 1KB per message
      return messages.length * 1024;
    }
  }

  /**
   * PRODUCTION OPTIMIZATION: Flush batched messages with proper protocol compliance
   */
  private flushBatch(ws: ExtendedWebSocket): void {
    if (ws.batchedMessages.length === 0) return;
    
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const totalSize = this.estimateBatchSize(ws.batchedMessages);
        
        // PRODUCTION OPTIMIZATION: Send all batched messages in proper BATCH format
        const batchMessage = {
          type: WSMessageType.BATCH,
          messages: ws.batchedMessages,
          batchId,
          count: ws.batchedMessages.length,
          totalSize,
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(batchMessage));
        log(`📤 WS: Flushed batch [${ws.connectionId}] - ${ws.batchedMessages.length} messages, ${totalSize} bytes`);
        
        // Clear batch
        ws.batchedMessages = [];
        if (ws.batchTimeout) {
          clearTimeout(ws.batchTimeout);
          ws.batchTimeout = undefined;
        }
      }
    } catch (error) {
      log(`❌ WS: Failed to flush batch for [${ws.connectionId}]: ${error}`);
      // Clear batch anyway to prevent accumulation
      ws.batchedMessages = [];
      if (ws.batchTimeout) {
        clearTimeout(ws.batchTimeout);
        ws.batchTimeout = undefined;
      }
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

    // Close all connections and cleanup batches
    const connectionsArray = Array.from(this.connections.entries());
    for (const [connectionId, ws] of connectionsArray) {
      // PRODUCTION OPTIMIZATION: Clear batch timeouts before closing
      if (ws.batchTimeout) {
        clearTimeout(ws.batchTimeout);
        ws.batchTimeout = undefined;
      }
      
      // Flush any pending batched messages before closing
      this.flushBatch(ws);
      
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