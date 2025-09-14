import { 
  WSMessageType,
  SubscriptionType,
  ClientMessage,
  ServerMessage,
  TaskStatusMessage,
  TaskProgressMessage,
  TaskLogsMessage,
  TaskErrorMessage,
  SessionStatusMessage,
  ConnectionStatusMessage,
  clientMessageSchema,
  serverMessageSchema
} from '@shared/websocket-types';

// Re-export shared types for use in components
export { 
  WSMessageType,
  SubscriptionType,
  type TaskStatusMessage,
  type TaskProgressMessage,
  type TaskLogsMessage,
  type TaskErrorMessage,
  type SessionStatusMessage,
  type ConnectionStatusMessage
} from '@shared/websocket-types';

// Event types for WebSocket client
export interface WSEventMap {
  connected: { connectionId: string };
  disconnected: { reason: string };
  authenticated: { agentId: string };
  subscribed: { type: SubscriptionType; targetId: string };
  unsubscribed: { type: SubscriptionType; targetId: string };
  taskStatus: TaskStatusMessage;
  taskProgress: TaskProgressMessage;
  taskLogs: TaskLogsMessage;
  taskError: TaskErrorMessage;
  sessionStatus: SessionStatusMessage;
  connectionStatus: ConnectionStatusMessage;
  error: { error: string; code?: string; details?: any };
}

export type WSEventHandler<T extends keyof WSEventMap> = (data: WSEventMap[T]) => void;

// Connection states
export enum WSConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  AUTHENTICATED = 'AUTHENTICATED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

// WebSocket client configuration
export interface WSClientConfig {
  url?: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  timeout: number;
  debug: boolean;
}

const DEFAULT_CONFIG: WSClientConfig = {
  reconnectInterval: 3000,    // 3 seconds (faster reconnection)
  maxReconnectAttempts: 15,   // More attempts for reliability
  heartbeatInterval: 30000,   // 30 seconds
  timeout: 30000,             // 30 seconds (more time for authentication)
  debug: import.meta.env.DEV
};

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WSClientConfig;
  private state: WSConnectionState = WSConnectionState.DISCONNECTED;
  private eventListeners = new Map<keyof WSEventMap, Set<WSEventHandler<any>>>();
  private subscriptions = new Set<string>();
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  private lastPingTime: number = 0;
  private messageQueue: ClientMessage[] = [];
  private authenticatedAgentId: string | null = null;
  private sessionToken: string | null = null;
  private tokenRefreshCallback: (() => Promise<string>) | null = null;

  constructor(config: Partial<WSClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Auto-detect WebSocket URL if not provided
    if (!this.config.url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.config.url = `${protocol}//${host}/ws`;
    }
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === WSConnectionState.CONNECTED || this.state === WSConnectionState.AUTHENTICATED) {
        resolve();
        return;
      }

      this.setState(WSConnectionState.CONNECTING);
      this.log('Connecting to WebSocket...');

      try {
        this.ws = new WebSocket(this.config.url!);
        
        // Setup event handlers
        this.ws.onopen = () => {
          this.setState(WSConnectionState.CONNECTED);
          this.reconnectAttempts = 0;
          this.processMessageQueue();
          this.emit('connected', { connectionId: 'connected' });
          this.log('WebSocket connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.handleDisconnection(event.code, event.reason);
        };

        this.ws.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.setState(WSConnectionState.ERROR);
          reject(new Error('WebSocket connection failed'));
        };

        // Connection timeout
        setTimeout(() => {
          if (this.state === WSConnectionState.CONNECTING) {
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.config.timeout);

      } catch (error) {
        this.setState(WSConnectionState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Authenticate with the server using stored or provided token
   */
  public async authenticate(sessionToken: string, agentId: string, tokenRefreshCallback?: () => Promise<string>): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔐 [WS-AUTH] Starting authentication with:', {
        hasToken: !!sessionToken,
        tokenLength: sessionToken?.length || 0,
        agentId,
        state: this.state
      });
      
      if (this.state !== WSConnectionState.CONNECTED) {
        console.error('❌ [WS-AUTH] Cannot authenticate - WebSocket not connected, state:', this.state);
        reject(new Error('Not connected to WebSocket server'));
        return;
      }

      // Store token and callback for reconnection
      this.sessionToken = sessionToken;
      this.authenticatedAgentId = agentId;
      if (tokenRefreshCallback) {
        this.tokenRefreshCallback = tokenRefreshCallback;
      }

      // Validate token is present
      if (!sessionToken || sessionToken.trim() === '') {
        console.error('❌ [WS-AUTH] Authentication failed - empty or missing token');
        reject(new Error('Valid session token required for authentication'));
        return;
      }

      const authMessage: ClientMessage = {
        type: WSMessageType.AUTHENTICATE,
        sessionToken,
        agentId,
        timestamp: new Date().toISOString(),
        messageId: `auth-${Date.now()}`
      };
      
      console.log('📤 [WS-AUTH] Sending authentication message:', {
        type: authMessage.type,
        hasToken: !!authMessage.sessionToken,
        tokenLength: authMessage.sessionToken?.length || 0,
        agentId: authMessage.agentId,
        messageId: authMessage.messageId
      });

      // Setup one-time listeners for auth response
      const handleAuthenticated = () => {
        console.log('✅ [WS-AUTH] Authentication successful');
        this.off('authenticated', handleAuthenticated);
        this.off('error', handleError);
        this.setState(WSConnectionState.AUTHENTICATED);
        this.startHeartbeat(); // Start heartbeat only after authentication
        resolve();
      };

      const handleError = (errorData: WSEventMap['error']) => {
        console.error('❌ [WS-AUTH] Authentication error:', errorData);
        this.off('authenticated', handleAuthenticated);
        this.off('error', handleError);
        
        // If token is invalid, clear stored token
        if (errorData.code === 'INVALID_TOKEN' || errorData.code === 'MISSING_TOKEN') {
          console.log('🗑️ [WS-AUTH] Clearing invalid token');
          this.sessionToken = null;
        }
        
        reject(new Error(errorData.error));
      };

      this.on('authenticated', handleAuthenticated);
      this.on('error', handleError);

      this.sendMessage(authMessage);

      // Authentication timeout
      setTimeout(() => {
        console.error('⏰ [WS-AUTH] Authentication timeout');
        this.off('authenticated', handleAuthenticated);
        this.off('error', handleError);
        reject(new Error('Authentication timeout'));
      }, this.config.timeout);
    });
  }

  /**
   * Subscribe to updates for a specific target
   */
  public async subscribe(type: SubscriptionType, targetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== WSConnectionState.AUTHENTICATED) {
        reject(new Error('Must be authenticated to subscribe'));
        return;
      }

      const subscriptionKey = `${type}:${targetId}`;
      if (this.subscriptions.has(subscriptionKey)) {
        resolve(); // Already subscribed
        return;
      }

      const subscribeMessage: ClientMessage = {
        type: WSMessageType.SUBSCRIBE,
        subscriptionType: type,
        targetId,
        timestamp: new Date().toISOString(),
        messageId: `sub-${Date.now()}`
      };

      // Setup one-time listeners for subscription response
      const handleSubscribed = (data: WSEventMap['subscribed']) => {
        if (data.type === type && data.targetId === targetId) {
          this.off('subscribed', handleSubscribed);
          this.off('error', handleError);
          this.subscriptions.add(subscriptionKey);
          resolve();
        }
      };

      const handleError = (errorData: WSEventMap['error']) => {
        this.off('subscribed', handleSubscribed);
        this.off('error', handleError);
        reject(new Error(errorData.error));
      };

      this.on('subscribed', handleSubscribed);
      this.on('error', handleError);

      this.sendMessage(subscribeMessage);

      // Subscription timeout
      setTimeout(() => {
        this.off('subscribed', handleSubscribed);
        this.off('error', handleError);
        reject(new Error('Subscription timeout'));
      }, this.config.timeout);
    });
  }

  /**
   * Unsubscribe from updates
   */
  public async unsubscribe(type: SubscriptionType, targetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscriptionKey = `${type}:${targetId}`;
      if (!this.subscriptions.has(subscriptionKey)) {
        resolve(); // Not subscribed
        return;
      }

      const unsubscribeMessage: ClientMessage = {
        type: WSMessageType.UNSUBSCRIBE,
        subscriptionType: type,
        targetId,
        timestamp: new Date().toISOString(),
        messageId: `unsub-${Date.now()}`
      };

      // Setup one-time listeners for unsubscription response
      const handleUnsubscribed = (data: WSEventMap['unsubscribed']) => {
        if (data.type === type && data.targetId === targetId) {
          this.off('unsubscribed', handleUnsubscribed);
          this.off('error', handleError);
          this.subscriptions.delete(subscriptionKey);
          resolve();
        }
      };

      const handleError = (errorData: WSEventMap['error']) => {
        this.off('unsubscribed', handleUnsubscribed);
        this.off('error', handleError);
        reject(new Error(errorData.error));
      };

      this.on('unsubscribed', handleUnsubscribed);
      this.on('error', handleError);

      this.sendMessage(unsubscribeMessage);

      // Unsubscription timeout
      setTimeout(() => {
        this.off('unsubscribed', handleUnsubscribed);
        this.off('error', handleError);
        reject(new Error('Unsubscription timeout'));
      }, this.config.timeout);
    });
  }

  /**
   * Graceful disconnect (preserves authentication state for reconnection)
   */
  public disconnect(): void {
    this.log('🔌 [DISCONNECT] Graceful disconnect - preserving auth state');
    this.stopReconnecting();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setState(WSConnectionState.DISCONNECTED);
    this.subscriptions.clear();
    this.messageQueue = [];
    // NOTE: Preserving authenticatedAgentId, sessionToken, tokenRefreshCallback for reconnection
  }

  /**
   * Force disconnect (clears all authentication state)
   */
  public forceDisconnect(): void {
    this.log('💥 [FORCE-DISCONNECT] Force disconnect - clearing all auth state');
    this.stopReconnecting();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Force disconnect');
      this.ws = null;
    }
    
    this.setState(WSConnectionState.DISCONNECTED);
    this.subscriptions.clear();
    this.authenticatedAgentId = null;
    this.sessionToken = null;
    this.tokenRefreshCallback = null;
    this.messageQueue = [];
  }

  /**
   * Get current connection state
   */
  public getState(): WSConnectionState {
    return this.state;
  }

  /**
   * Get subscriptions
   */
  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Check if connected and authenticated
   */
  public isReady(): boolean {
    return this.state === WSConnectionState.AUTHENTICATED;
  }

  /**
   * Add event listener
   */
  public on<T extends keyof WSEventMap>(event: T, handler: WSEventHandler<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  public off<T extends keyof WSEventMap>(event: T, handler: WSEventHandler<T>): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Send ping to server
   */
  public ping(): void {
    const pingMessage: ClientMessage = {
      type: WSMessageType.PING,
      timestamp: new Date().toISOString(),
      messageId: `ping-${Date.now()}`
    };
    this.sendMessage(pingMessage);
    this.lastPingTime = Date.now();
  }

  // Private methods

  private setState(newState: WSConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.log(`State changed to: ${newState}`);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const validatedMessage = serverMessageSchema.parse(message);

      this.log('Received message:', validatedMessage.type);

      switch (validatedMessage.type) {
        case WSMessageType.PONG:
          this.log(`Pong received (RTT: ${Date.now() - this.lastPingTime}ms)`);
          break;

        case WSMessageType.AUTHENTICATED:
          this.emit('authenticated', { agentId: this.authenticatedAgentId! });
          break;

        case WSMessageType.SUBSCRIBED:
          this.emit('subscribed', {
            type: validatedMessage.subscriptionType,
            targetId: validatedMessage.targetId
          });
          break;

        case WSMessageType.UNSUBSCRIBED:
          this.emit('unsubscribed', {
            type: validatedMessage.subscriptionType,
            targetId: validatedMessage.targetId
          });
          break;

        case WSMessageType.TASK_STATUS:
          this.emit('taskStatus', validatedMessage as TaskStatusMessage);
          break;

        case WSMessageType.TASK_PROGRESS:
          this.emit('taskProgress', validatedMessage as TaskProgressMessage);
          break;

        case WSMessageType.TASK_LOGS:
          this.emit('taskLogs', validatedMessage as TaskLogsMessage);
          break;

        case WSMessageType.TASK_ERROR:
          this.emit('taskError', validatedMessage as TaskErrorMessage);
          break;

        case WSMessageType.SESSION_STATUS:
          this.emit('sessionStatus', validatedMessage as SessionStatusMessage);
          break;

        case WSMessageType.CONNECTION_STATUS:
          this.emit('connectionStatus', validatedMessage as ConnectionStatusMessage);
          break;

        case WSMessageType.ERROR:
          this.emit('error', {
            error: validatedMessage.error,
            code: validatedMessage.code,
            details: validatedMessage.details
          });
          break;

        default:
          this.log('Unknown message type:', message.type);
      }
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  private handleDisconnection(code: number, reason: string): void {
    this.log(`WebSocket disconnected: ${code} - ${reason}`);
    this.stopHeartbeat();
    this.ws = null;
    this.setState(WSConnectionState.DISCONNECTED);
    this.emit('disconnected', { reason: reason || 'Connection closed' });

    // Preserve authentication state across network disconnections (not intentional disconnects)
    // Only clear auth state for force disconnects
    if (code === 1000 && reason === 'Force disconnect') {
      this.log('🗑️ [DISCONNECT] Clearing auth state due to force disconnect');
      this.authenticatedAgentId = null;
      this.sessionToken = null;
      this.tokenRefreshCallback = null;
    } else {
      this.log('🔄 [DISCONNECT] Preserving auth state for reconnection');
    }
    
    // Clear subscriptions and message queue on any disconnect
    this.subscriptions.clear();
    this.messageQueue = [];
    
    // Attempt reconnection if not an intentional force disconnect
    if ((code !== 1000 || reason !== 'Force disconnect') && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectTimeout) return;

    this.setState(WSConnectionState.RECONNECTING);
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = window.setTimeout(async () => {
      this.reconnectTimeout = null;
      
      try {
        // Connect to WebSocket
        await this.connect();
        
        // Re-authenticate if we were previously authenticated
        this.log('🔄 [RECONNECT] Checking authentication state:', {
          hasAgentId: !!this.authenticatedAgentId,
          agentId: this.authenticatedAgentId,
          hasToken: !!this.sessionToken,
          tokenLength: this.sessionToken?.length || 0,
          hasRefreshCallback: !!this.tokenRefreshCallback
        });

        if (this.authenticatedAgentId) {
          let token = this.sessionToken;
          
          // If no stored token or token was invalidated, try to refresh
          if (!token && this.tokenRefreshCallback) {
            try {
              this.log('🔄 [RECONNECT] Refreshing token via callback...');
              token = await this.tokenRefreshCallback();
              this.log('✅ [RECONNECT] Token refreshed for reconnection, length:', token?.length || 0);
            } catch (refreshError) {
              this.log('❌ [RECONNECT] Token refresh failed:', refreshError);
              throw new Error('Failed to refresh authentication token');
            }
          }
          
          if (!token) {
            this.log('❌ [RECONNECT] No valid authentication token available');
            throw new Error('No valid authentication token available for reconnection');
          }
          
          this.log('🔐 [RECONNECT] Re-authenticating with stored credentials...');
          await this.authenticate(token, this.authenticatedAgentId);
          this.log('✅ [RECONNECT] Re-authentication completed successfully');
        } else {
          this.log('⚠️ [RECONNECT] No stored agent ID - skipping automatic re-authentication');
        }
        
        // Re-establish subscriptions
        const subscriptions = Array.from(this.subscriptions);
        this.subscriptions.clear();
        
        await Promise.all(
          subscriptions.map(sub => {
            const [type, targetId] = sub.split(':');
            return this.subscribe(type as SubscriptionType, targetId);
          })
        );
        
        this.log('Reconnection successful');
      } catch (error) {
        this.log('Reconnect failed:', error);
        
        // If we've exceeded max attempts, stop trying
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
          this.log('Max reconnect attempts reached, stopping reconnection');
          this.setState(WSConnectionState.ERROR);
          this.emit('error', { 
            error: 'Failed to reconnect after maximum attempts', 
            code: 'MAX_RECONNECT_ATTEMPTS_EXCEEDED' 
          });
          return;
        }
        
        // Schedule next reconnect attempt
        this.scheduleReconnect();
      }
    }, delay);
  }

  private stopReconnecting(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.state === WSConnectionState.CONNECTED || this.state === WSConnectionState.AUTHENTICATED) {
        this.ping();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendMessage(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log('Sent message:', message.type);
    } else {
      // Queue message for later if not connected
      this.messageQueue.push(message);
      this.log('Queued message:', message.type);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.sendMessage(message);
    }
  }

  private emit<T extends keyof WSEventMap>(event: T, data: WSEventMap[T]): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// Singleton instance for global use
export const wsClient = new WebSocketClient();

// React integration helpers
export const useWebSocket = () => {
  return {
    client: wsClient,
    connect: wsClient.connect.bind(wsClient),
    disconnect: wsClient.disconnect.bind(wsClient),
    authenticate: wsClient.authenticate.bind(wsClient),
    subscribe: wsClient.subscribe.bind(wsClient),
    unsubscribe: wsClient.unsubscribe.bind(wsClient),
    isReady: wsClient.isReady.bind(wsClient),
    getState: wsClient.getState.bind(wsClient)
  };
};