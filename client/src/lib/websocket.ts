// client/src/lib/websocket.ts

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  sessionId?: string;
}

interface WebSocketConfig {
  onFrame?: (data: string) => void;
  onConnected?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

// WebSocket connection states
export enum WSConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

// WebSocket event map for type safety
export interface WSEventMap {
  connected: void;
  disconnected: void;
  authenticated: void;
  taskStatus: any;
  taskProgress: any;
  taskLogs: any;
  taskError: any;
  error: { error: string };
}

// WebSocket client class
export class WSClient {
  private ws: WebSocket | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private isConnecting = false;

  constructor() {
    // Initialize event listeners map
    this.eventListeners = new Map();
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    
    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/view/`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.emit('connected');
      };
      
      this.ws.onclose = () => {
        this.isConnecting = false;
        this.emit('disconnected');
      };
      
      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.emit('error', { error: 'WebSocket connection failed' });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  async authenticate(token: string, agentId: string, refreshToken: () => Promise<string>): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    // Send authentication message
    this.ws.send(JSON.stringify({
      type: 'authenticate',
      token,
      agentId
    }));
    
    this.emit('authenticated');
  }

  async subscribe(type: string, id: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      subscriptionType: type,
      id
    }));
  }

  isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  forceDisconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const wsClient = new WSClient();

export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private token: string;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(sessionId: string, config: WebSocketConfig = {}) {
    this.sessionId = sessionId;
    this.config = config;

    // Get token from localStorage
    const storedToken = localStorage.getItem('agent_token');
    if (!storedToken) {
      console.error('❌ No JWT token found in localStorage');
      throw new Error('Authentication token not found. Please complete payment first.');
    }

    this.token = storedToken;
    console.log('🔑 Token retrieved from localStorage');
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with token
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = import.meta.env.VITE_WS_URL || 
                      `${wsProtocol}//${window.location.host}`;
        const wsUrl = `${wsHost}/ws/view/${this.sessionId}?token=${this.token}`;

        console.log('🔌 Connecting to WebSocket:', {
          sessionId: this.sessionId,
          url: wsUrl.replace(/token=[^&]+/, 'token=***')
        });

        this.ws = new WebSocket(wsUrl);

        // Connection opened
        this.ws.onopen = () => {
          console.log('✅ WebSocket connected successfully');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        // Listen for messages
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        // Handle errors
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.config.onError?.('WebSocket connection error');
          reject(new Error('WebSocket connection failed'));
        };

        // Handle close
        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', {
            code: event.code,
            reason: event.reason
          });

          this.stopHeartbeat();
          this.config.onClose?.();

          // Handle different close codes
          switch (event.code) {
            case 4001:
              console.error('❌ Authentication required');
              this.config.onError?.('Authentication required. Please log in again.');
              break;
            case 4002:
              console.error('❌ Session mismatch');
              this.config.onError?.('Invalid session. Please restart.');
              break;
            case 4003:
              console.error('❌ Token expired or invalid');
              this.config.onError?.('Your session has expired. Please log in again.');
              break;
            case 1000:
              console.log('✅ Normal closure');
              break;
            default:
              // Attempt reconnection for unexpected closures
              if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnect();
              } else {
                this.config.onError?.('Connection lost. Please refresh the page.');
              }
          }
        };

      } catch (error) {
        console.error('❌ Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('📨 Received message:', message.type);

    switch (message.type) {
      case 'connected':
        console.log('✅ WebSocket authenticated:', message.sessionId);
        this.config.onConnected?.();
        break;

      case 'frame':
        // Forward frame data to handler
        if (message.data) {
          this.config.onFrame?.(message.data);
        }
        break;

      case 'pong':
        console.log('💓 Heartbeat received');
        break;

      case 'error':
        console.error('❌ Server error:', message.message);
        this.config.onError?.(message.message || 'Unknown error');
        break;

      default:
        console.warn('⚠️ Unknown message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
      });
    }, delay);
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('❌ WebSocket not connected');
    }
  }

  sendCommand(command: any): void {
    this.send({
      type: 'command',
      data: command
    });
  }

  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Convenience function for simple connections
export const connectToStream = (sessionId: string, config: WebSocketConfig = {}): AgentWebSocket => {
  const ws = new AgentWebSocket(sessionId, config);
  ws.connect().catch(error => {
    console.error('❌ Failed to connect:', error);
    config.onError?.(error.message);
  });
  return ws;
};

// Export singleton instance manager
const activeConnections = new Map<string, AgentWebSocket>();

export const getOrCreateConnection = (sessionId: string, config: WebSocketConfig = {}): AgentWebSocket => {
  if (activeConnections.has(sessionId)) {
    const existing = activeConnections.get(sessionId)!;
    if (existing.isConnected()) {
      return existing;
    } else {
      existing.disconnect();
      activeConnections.delete(sessionId);
    }
  }

  const ws = new AgentWebSocket(sessionId, config);
  activeConnections.set(sessionId, ws);
  
  ws.connect().catch(error => {
    console.error('❌ Failed to connect:', error);
    activeConnections.delete(sessionId);
    config.onError?.(error.message);
  });

  return ws;
};

export const disconnectAll = (): void => {
  activeConnections.forEach(ws => ws.disconnect());
  activeConnections.clear();
};