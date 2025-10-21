/**
 * VNC WebSocket Proxy - ZERO-COST Solution
 * Bridges frontend noVNC clients to worker VNC server
 */

import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

export class VNCWebSocketProxy {
  constructor(workerVncHost = 'worker.railway.internal', workerVncPort = 6080) {
    this.workerVncHost = workerVncHost;
    this.workerVncPort = workerVncPort;
    this.wss = new WebSocketServer({ noServer: true });
    this.setupProxy();
    console.log(`🔧 VNC Proxy initialized: ${workerVncHost}:${workerVncPort}`);
  }

  setupProxy() {
    this.wss.on('connection', (frontendWs, request) => {
      const url = new URL(request.url, 'ws://localhost');
      const sessionId = url.pathname.split('/').pop();
      const token = url.searchParams.get('token');

      console.log(`[VNC-PROXY] New connection for session: ${sessionId}`);

      // Validate JWT token
      if (!token) {
        console.error('[VNC-PROXY] Missing token');
        frontendWs.close(4001, 'Missing authentication token');
        return;
      }

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        if (payload.sessionId !== sessionId) {
          console.error('[VNC-PROXY] Session ID mismatch');
          frontendWs.close(4003, 'Invalid session');
          return;
        }
        console.log(`[VNC-PROXY] JWT validated for session: ${sessionId}`);
      } catch (error) {
        console.error('[VNC-PROXY] JWT verification failed:', error.message);
        frontendWs.close(4002, 'Invalid token');
        return;
      }

      // Connect to worker VNC server
      const workerWsUrl = `ws://${this.workerVncHost}:${this.workerVncPort}/${sessionId}`;
      console.log(`[VNC-PROXY] Connecting to worker: ${workerWsUrl}`);
      
      let workerWs;
      try {
        workerWs = new WebSocket(workerWsUrl);
      } catch (error) {
        console.error('[VNC-PROXY] Failed to create worker connection:', error);
        frontendWs.close(4004, 'Worker unreachable');
        return;
      }

      // Track connection state
      let isConnected = false;

      workerWs.on('open', () => {
        console.log(`[VNC-PROXY] Connected to worker VNC for session: ${sessionId}`);
        isConnected = true;
      });

      // Relay binary VNC data from worker to frontend
      workerWs.on('message', (data) => {
        if (frontendWs.readyState === WebSocket.OPEN) {
          frontendWs.send(data, { binary: true });
        }
      });

      // Relay binary VNC data from frontend to worker
      frontendWs.on('message', (data) => {
        if (workerWs.readyState === WebSocket.OPEN) {
          workerWs.send(data, { binary: true });
        }
      });

      // Handle worker connection close
      workerWs.on('close', (code, reason) => {
        console.log(`[VNC-PROXY] Worker closed: ${code} ${reason}`);
        if (frontendWs.readyState === WebSocket.OPEN) {
          frontendWs.close(1000, 'Worker disconnected');
        }
      });

      // Handle frontend connection close
      frontendWs.on('close', (code, reason) => {
        console.log(`[VNC-PROXY] Frontend closed: ${code} ${reason}`);
        if (workerWs.readyState === WebSocket.OPEN) {
          workerWs.close(1000, 'Frontend disconnected');
        }
      });

      // Handle worker errors
      workerWs.on('error', (error) => {
        console.error('[VNC-PROXY] Worker error:', error.message);
        if (frontendWs.readyState === WebSocket.OPEN) {
          frontendWs.close(4005, 'Worker error');
        }
      });

      // Handle frontend errors
      frontendWs.on('error', (error) => {
        console.error('[VNC-PROXY] Frontend error:', error.message);
        if (workerWs.readyState === WebSocket.OPEN) {
          workerWs.close(1000, 'Frontend error');
        }
      });
    });
  }

  handleUpgrade(request, socket, head) {
    if (request.url.startsWith('/ws/vnc/')) {
      console.log(`[VNC-PROXY] Handling upgrade for: ${request.url}`);
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
      return true;
    }
    return false;
  }
}
