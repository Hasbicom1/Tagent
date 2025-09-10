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
  TaskStatusMessage,
  TaskProgressMessage,
  TaskLogsMessage,
  TaskErrorMessage,
  SessionStatusMessage,
  ConnectionStatusMessage
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
  reconnectInterval: 5000,    // 5 seconds
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,   // 30 seconds
  timeout: 10000,             // 10 seconds
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
          this.startHeartbeat();
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
   * Authenticate with the server
   */
  public async authenticate(sessionToken: string, agentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== WSConnectionState.CONNECTED) {
        reject(new Error('Not connected to WebSocket server'));
        return;
      }

      const authMessage: ClientMessage = {
        type: WSMessageType.AUTHENTICATE,
        sessionToken,
        agentId,
        timestamp: new Date().toISOString(),
        messageId: `auth-${Date.now()}`
      };

      // Setup one-time listeners for auth response
      const handleAuthenticated = () => {
        this.off('authenticated', handleAuthenticated);
        this.off('error', handleError);
        this.authenticatedAgentId = agentId;
        this.setState(WSConnectionState.AUTHENTICATED);
        resolve();
      };

      const handleError = (errorData: WSEventMap['error']) => {
        this.off('authenticated', handleAuthenticated);
        this.off('error', handleError);
        reject(new Error(errorData.error));
      };

      this.on('authenticated', handleAuthenticated);
      this.on('error', handleError);

      this.sendMessage(authMessage);

      // Authentication timeout
      setTimeout(() => {
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
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.stopReconnecting();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setState(WSConnectionState.DISCONNECTED);
    this.subscriptions.clear();
    this.authenticatedAgentId = null;
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

    // Attempt reconnection if not a normal closure
    if (code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.setState(WSConnectionState.RECONNECTING);
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect()
        .then(() => {
          // Re-authenticate if we were previously authenticated
          if (this.authenticatedAgentId) {
            return this.authenticate('', this.authenticatedAgentId);
          }
        })
        .then(() => {
          // Re-establish subscriptions
          const subscriptions = Array.from(this.subscriptions);
          this.subscriptions.clear();
          
          return Promise.all(
            subscriptions.map(sub => {
              const [type, targetId] = sub.split(':');
              return this.subscribe(type as SubscriptionType, targetId);
            })
          );
        })
        .catch((error) => {
          this.log('Reconnect failed:', error);
          this.scheduleReconnect();
        });
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