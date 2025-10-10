import WebSocket from 'ws';

export class LiveStreamRelay {
  constructor(server) {
    // WebSocket server for worker connections
    this.wss = new WebSocket.Server({ noServer: true });
    
    // Store frontend connections by sessionId
    this.frontendConnections = new Map();
    
    this.setupWorkerRelay();
  }
  
  setupWorkerRelay() {
    this.wss.on('connection', (ws, request) => {
      // Extract sessionId from URL
      const url = new URL(request.url, 'ws://localhost');
      const sessionId = url.pathname.split('/').pop();
      
      console.log(`📹 Worker streaming for session: ${sessionId}`);
      
      ws.on('message', (data) => {
        try {
          const frame = JSON.parse(data.toString());
          
          // Forward frame to all frontend clients watching this session
          const frontendWs = this.frontendConnections.get(sessionId);
          if (frontendWs && frontendWs.readyState === WebSocket.OPEN) {
            frontendWs.send(data); // Forward raw frame data
          }
        } catch (err) {
          console.error('❌ Frame relay error:', err);
        }
      });
      
      ws.on('close', () => {
        console.log(`📹 Worker disconnected: ${sessionId}`);
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
  }
  
  // Handle HTTP upgrade for worker WebSocket
  handleUpgrade(request, socket, head) {
    if (request.url.startsWith('/ws/stream/')) {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
      return true;
    }
    return false;
  }
}
