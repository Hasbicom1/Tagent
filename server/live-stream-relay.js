import { WebSocketServer } from 'ws';
import { verifyWebSocketToken } from './jwt-utils.js';
import { getRedis } from './redis-simple.js';

export class LiveStreamRelay {
  constructor(server) {
    // WebSocket server for worker connections
    this.wss = new WebSocketServer({ noServer: true });
    
    // Store frontend connections by sessionId
    this.frontendConnections = new Map();
    
    // Redis subscriber for frames
    this.redisSubscriber = null;
    
    this.setupWorkerRelay();
    // Setup Redis subscriber asynchronously
    this.setupRedisSubscriber().catch(error => {
      console.error('❌ Failed to setup Redis subscriber:', error);
    });
  }
  
  setupWorkerRelay() {
    this.wss.on('connection', (ws, request) => {
      // Extract sessionId and token from URL
      const url = new URL(request.url, 'ws://localhost');
      const sessionId = url.pathname.split('/').pop();
      const token = url.searchParams.get('token');
      
      console.log(`📹 WebSocket connection attempt for session: ${sessionId}, hasToken: ${!!token}`);
      
      // Validate JWT token for frontend connections
      if (token) {
        try {
          const payload = verifyWebSocketToken(token);
          if (payload.sessionId !== sessionId) {
            console.error('❌ Session ID mismatch in JWT token');
            ws.close(4003, 'Invalid session');
            return;
          }
          console.log('✅ JWT token validated successfully for session:', sessionId);
        } catch (error) {
          console.error('❌ JWT token validation failed:', error.message);
          ws.close(4002, 'Invalid token');
          return;
        }
      } else {
        console.log('📹 Worker connection (no token required)');
      }
      
      ws.on('message', (data) => {
        try {
          const frame = JSON.parse(data.toString());
          
          // Forward frame to all frontend clients watching this session
          const frontendWs = this.frontendConnections.get(sessionId);
          if (frontendWs && frontendWs.readyState === 1) { // WebSocket.OPEN = 1
            frontendWs.send(data); // Forward raw frame data
            console.log(`📸 Frame forwarded to frontend for session: ${sessionId}`);
          }
        } catch (err) {
          console.error('❌ Frame relay error:', err);
        }
      });
      
      ws.on('close', () => {
        console.log(`📹 WebSocket disconnected: ${sessionId}`);
      });
      
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for session ${sessionId}:`, error);
      });
    });
  }
  
  // Handle frontend WebSocket connection
  addFrontendConnection(sessionId, ws) {
    this.frontendConnections.set(sessionId, ws);
    console.log(`👁️ Frontend connected to stream: ${sessionId}`);
    
    ws.on('close', () => {
      this.frontendConnections.delete(sessionId);
      console.log(`👁️ Frontend disconnected: ${sessionId}`);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Frontend WebSocket error for session ${sessionId}:`, error);
    });
  }
  
  // Handle HTTP upgrade for worker WebSocket
  handleUpgrade(request, socket, head) {
    if (request.url.startsWith('/ws/stream/')) {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
      return true;
    }
    
    // Handle frontend viewer connections
    if (request.url.startsWith('/ws/view/')) {
      const url = new URL(request.url, 'ws://localhost');
      const sessionId = url.pathname.split('/').pop();
      const token = url.searchParams.get('token');
      
      console.log(`👁️ Frontend viewer connection attempt for session: ${sessionId}, hasToken: ${!!token}`);
      
      // Validate JWT token for frontend connections
      if (token) {
        try {
          const payload = verifyWebSocketToken(token);
          if (payload.sessionId !== sessionId) {
            console.error('❌ Session ID mismatch in JWT token for frontend');
            socket.destroy();
            return true;
          }
          console.log('✅ Frontend JWT token validated successfully for session:', sessionId);
        } catch (error) {
          console.error('❌ Frontend JWT token validation failed:', error.message);
          socket.destroy();
          return true;
        }
      } else {
        console.error('❌ No JWT token provided for frontend connection');
        socket.destroy();
        return true;
      }
      
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.addFrontendConnection(sessionId, ws);
      });
      return true;
    }
    
    return false;
  }
  
  // CRITICAL FIX: Setup Redis subscriber for frame forwarding
  async setupRedisSubscriber() {
    try {
      const redis = await getRedis();
      if (!redis) {
        console.warn('⚠️ Redis not available, skipping subscriber setup');
        return;
      }
      
      this.redisSubscriber = redis.duplicate();
      
      this.redisSubscriber.on('message', (channel, message) => {
        try {
          // Extract session ID from channel name
          const sessionId = channel.split(':')[2];
          
          // Get frontend WebSocket connection for this session
          const frontendWs = this.frontendConnections.get(sessionId);
          
          if (frontendWs && frontendWs.readyState === 1) { // WebSocket.OPEN = 1
            // Forward frame to frontend
            frontendWs.send(message);
            console.log(`📸 Frame forwarded to frontend for session: ${sessionId}`);
          } else {
            console.log(`⚠️ No frontend connection for session: ${sessionId}`);
          }
        } catch (error) {
          console.error('❌ Redis frame forwarding error:', error);
        }
      });
      
      // Subscribe to all browser frame channels
      await this.redisSubscriber.psubscribe('browser:frames:*');
      console.log('✅ Redis subscriber ready for browser frames');
      
    } catch (error) {
      console.error('❌ Failed to setup Redis subscriber:', error);
    }
  }
}
