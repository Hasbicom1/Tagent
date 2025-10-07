/**
 * REAL BROWSER AUTOMATION AGENT
 * Using Chrome DevTools Protocol (CDP) instead of VNC
 * 
 * Based on TheAgenticBrowser architecture:
 * - No Xvfb needed
 * - No VNC needed
 * - Direct CDP connection for live view
 * - Screenshot streaming for frontend
 */

import puppeteer from 'puppeteer';
import { Queue, Worker } from 'bullmq';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

// ==========================================
// CONFIGURATION
// ==========================================
const config = {
  redisUrl: process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL || 'redis://localhost:6379',
  port: parseInt(process.env.PORT || '8080'),
  workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`,
  screenshotInterval: 500, // ms - how often to send screenshots
};

console.log('==========================================');
console.log('🤖 BROWSER AGENT STARTING');
console.log('==========================================');
console.log('Redis URL:', config.redisUrl);
console.log('Port:', config.port);
console.log('Worker ID:', config.workerId);
console.log('==========================================');

// ==========================================
// BROWSER SESSION MANAGEMENT
// ==========================================
const browserSessions = new Map();

class BrowserSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.browser = null;
    this.page = null;
    this.isActive = false;
    this.streamingClients = new Set();
    this.streamInterval = null;
    this.createdAt = new Date().toISOString();
  }

  async launch() {
    console.log(`🚀 Launching browser for session: ${this.sessionId}`);
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });
    
    this.isActive = true;
    console.log(`✅ Browser launched for session: ${this.sessionId}`);
    
    return this;
  }

  async startStreaming() {
    if (this.streamInterval) return;
    
    console.log(`📺 Starting screenshot streaming for: ${this.sessionId}`);
    
    this.streamInterval = setInterval(async () => {
      if (!this.page || this.streamingClients.size === 0) return;
      
      try {
        const screenshot = await this.page.screenshot({ 
          type: 'jpeg', 
          quality: 60,
          encoding: 'base64'
        });
        
        const data = JSON.stringify({
          type: 'screenshot',
          sessionId: this.sessionId,
          data: screenshot,
          timestamp: Date.now()
        });
        
        this.streamingClients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(data);
          }
        });
      } catch (error) {
        console.error(`Error capturing screenshot for ${this.sessionId}:`, error.message);
      }
    }, config.screenshotInterval);
  }

  stopStreaming() {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
      console.log(`🛑 Stopped streaming for: ${this.sessionId}`);
    }
  }

  addClient(ws) {
    this.streamingClients.add(ws);
    console.log(`➕ Client added to session ${this.sessionId}. Total clients: ${this.streamingClients.size}`);
    
    if (this.streamingClients.size === 1) {
      this.startStreaming();
    }
  }

  removeClient(ws) {
    this.streamingClients.delete(ws);
    console.log(`➖ Client removed from session ${this.sessionId}. Total clients: ${this.streamingClients.size}`);
    
    if (this.streamingClients.size === 0) {
      this.stopStreaming();
    }
  }

  async executeTask(task) {
    console.log(`🎯 Executing task for ${this.sessionId}:`, task);
    
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    const { action, params } = task;

    switch (action) {
      case 'navigate':
        await this.page.goto(params.url, { waitUntil: 'networkidle2' });
        return { success: true, url: this.page.url() };

      case 'click':
        await this.page.click(params.selector);
        return { success: true };

      case 'type':
        await this.page.type(params.selector, params.text);
        return { success: true };

      case 'screenshot':
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        return { success: true, screenshot };

      case 'evaluate':
        const result = await this.page.evaluate(params.script);
        return { success: true, result };

      case 'getContent':
        const content = await this.page.content();
        return { success: true, content };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async close() {
    console.log(`🔒 Closing browser session: ${this.sessionId}`);
    
    this.stopStreaming();
    this.streamingClients.clear();
    
    if (this.page) {
      await this.page.close().catch(console.error);
    }
    
    if (this.browser) {
      await this.browser.close().catch(console.error);
    }
    
    this.isActive = false;
    browserSessions.delete(this.sessionId);
    
    console.log(`✅ Browser session closed: ${this.sessionId}`);
  }
}

// ==========================================
// HTTP + WEBSOCKET SERVER
// ==========================================
const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/browser-stream' });

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    workerId: config.workerId,
    activeSessions: browserSessions.size,
    timestamp: new Date().toISOString()
  });
});

// Get or create browser session
app.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    let session = browserSessions.get(sessionId);
    
    if (!session) {
      session = new BrowserSession(sessionId);
      await session.launch();
      browserSessions.set(sessionId, session);
    }
    
    res.json({
      sessionId: session.sessionId,
      isActive: session.isActive,
      createdAt: session.createdAt,
      streamUrl: `/browser-stream?sessionId=${sessionId}`,
      cdpUrl: session.browser?.wsEndpoint() || null
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute task on session
app.post('/session/:sessionId/execute', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const task = req.body;
    
    let session = browserSessions.get(sessionId);
    
    if (!session) {
      session = new BrowserSession(sessionId);
      await session.launch();
      browserSessions.set(sessionId, session);
    }
    
    const result = await session.executeTask(task);
    
    res.json({
      success: true,
      sessionId,
      result
    });
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection for live streaming
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  
  console.log(`🔌 WebSocket connection for session: ${sessionId}`);
  
  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }
  
  const session = browserSessions.get(sessionId);
  
  if (!session) {
    ws.close(1008, 'Session not found');
    return;
  }
  
  session.addClient(ws);
  
  ws.on('close', () => {
    session.removeClient(ws);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
    session.removeClient(ws);
  });
});

// ==========================================
// BULLMQ TASK WORKER
// ==========================================
const worker = new Worker(
  'browser-automation',
  async (job) => {
    const { sessionId, task } = job.data;
    
    console.log(`📥 Processing job ${job.id} for session ${sessionId}`);
    
    let session = browserSessions.get(sessionId);
    
    if (!session) {
      session = new BrowserSession(sessionId);
      await session.launch();
      browserSessions.set(sessionId, session);
    }
    
    const result = await session.executeTask(task);
    
    return {
      success: true,
      sessionId,
      result,
      completedAt: new Date().toISOString()
    };
  },
  {
    connection: {
      host: config.redisUrl.includes('@') 
        ? config.redisUrl.split('@')[1].split(':')[0]
        : 'localhost',
      port: config.redisUrl.includes(':') 
        ? parseInt(config.redisUrl.split(':').pop())
        : 6379,
    },
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

// ==========================================
// START SERVER
// ==========================================
server.listen(config.port, '0.0.0.0', () => {
  console.log('==========================================');
  console.log('✅ BROWSER AGENT READY');
  console.log(`🌐 HTTP Server: http://0.0.0.0:${config.port}`);
  console.log(`🔌 WebSocket: ws://0.0.0.0:${config.port}/browser-stream`);
  console.log('==========================================');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing gracefully...');
  
  for (const [sessionId, session] of browserSessions) {
    await session.close();
  }
  
  await worker.close();
  server.close();
  
  process.exit(0);
});

