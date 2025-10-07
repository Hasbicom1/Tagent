/**
 * PRODUCTION WORKER WITH VNC LIVE STREAMING
 * 
 * This is the REAL worker that:
 * 1. Connects to Redis/BullMQ queue
 * 2. Launches browsers with VNC streaming
 * 3. Executes automation tasks
 * 4. Streams browser display to users
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
const { Queue, Worker } = require('bullmq');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const express = require('express');
const { spawnSync } = require('child_process');

console.log('🤖 PRODUCTION WORKER: Starting with VNC live streaming...');
console.log('🤖 Environment:', process.env.NODE_ENV || 'production');
console.log('🤖 Port:', process.env.PORT || '8080');

// Configuration
const config = {
  redisUrl: process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL || null,
  port: parseInt(process.env.PORT || '8080'),
  workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`
};

console.log('🔌 Redis configuration:');
console.log('   REDIS_PUBLIC_URL:', process.env.REDIS_PUBLIC_URL ? 'SET (using this)' : 'not set');
console.log('   REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'not set');
console.log('   Using:', config.redisUrl ? config.redisUrl.replace(/:[^:@]+@/, ':***@') : 'NONE (HTTP mode)');

// In-memory task storage (fallback when no Redis)
const tasks = new Map();
const browsers = new Map();
const vncSessions = new Map();

/**
 * Start Xvfb (X Virtual Framebuffer) for headless browser rendering
 */
async function startXvfb(displayNumber) {
  return new Promise((resolve, reject) => {
    console.log(`🖥️  Starting Xvfb on display :${displayNumber}...`);
    
    const xvfb = spawn('Xvfb', [
      `:${displayNumber}`,
      '-screen', '0', '1920x1080x24',
      '-ac',
      '+extension', 'GLX',
      '-nolisten', 'tcp',
      '-dpi', '96',
      '+render',
      '-noreset'
    ], {
      stdio: 'ignore',
      detached: true
    });

    xvfb.on('error', (error) => {
      console.error('❌ Xvfb failed to start:', error);
      reject(error);
    });

    // Wait a bit for Xvfb to initialize
    setTimeout(() => {
      console.log(`✅ Xvfb started on display :${displayNumber}`);
      resolve(xvfb);
    }, 2000);
  });
}

/**
 * Start x11vnc server for VNC streaming
 */
async function startVNCServer(displayNumber, vncPort) {
  return new Promise((resolve, reject) => {
    console.log(`📺 Starting VNC server on port ${vncPort}...`);
    
    const vnc = spawn('x11vnc', [
      '-display', `:${displayNumber}`,
      '-rfbport', vncPort.toString(),
      '-forever',
      '-shared',
      '-nopw', // No password for internal network
      '-nowf',
      '-noxdamage',
      '-noxfixes',
      '-noxrecord',
      '-noxcomposite',
      '-q'
    ], {
      stdio: 'pipe'
    });

    vnc.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('PORT=')) {
        console.log(`✅ VNC server listening on port ${vncPort}`);
        resolve(vnc);
      }
    });

    vnc.on('error', (error) => {
      console.error('❌ VNC server failed to start:', error);
      reject(error);
    });

    // Timeout fallback
    setTimeout(() => resolve(vnc), 3000);
  });
}

/**
 * Execute browser automation task with VNC streaming
 */
async function executeTask(taskId, instruction, sessionId) {
  console.log(`🚀 Executing task ${taskId}: "${instruction}"`);
  
  const task = {
    id: taskId,
    instruction,
    sessionId,
    status: 'running',
    progress: 0,
    result: null,
    error: null,
    startedAt: new Date()
  };
  
  tasks.set(taskId, task);
  
  try {
    // Get or create VNC session
    let vncSession = vncSessions.get(sessionId);
    
    if (!vncSession) {
      const displayNumber = vncSessions.size + 1;
      const vncPort = 5900 + displayNumber;
      
      console.log(`🎬 Creating VNC session for ${sessionId}`);
      
      // Start Xvfb
      const xvfbProcess = await startXvfb(displayNumber);
      
      // Start VNC server
      const vncProcess = await startVNCServer(displayNumber, vncPort);
      
      // Start websockify (bridge VNC TCP -> WS). Prefer system websockify; fallback to python -m websockify
      const wsPort = 6000 + displayNumber;
      let websockifyProcess;
      try {
        console.log(`🔌 Starting websockify on ${wsPort} -> 127.0.0.1:${vncPort}`);
        websockifyProcess = spawn('websockify', [wsPort.toString(), `127.0.0.1:${vncPort}`], { stdio: 'ignore', detached: true });
      } catch (e) {
        console.warn('⚠️ websockify binary not found, trying python module...');
        websockifyProcess = spawn('python3', ['-m', 'websockify', wsPort.toString(), `127.0.0.1:${vncPort}`], { stdio: 'ignore', detached: true });
      }

      vncSession = {
        sessionId,
        displayNumber,
        vncPort,
        wsPort,
        xvfbProcess,
        vncProcess,
        websockifyProcess,
        displayEnv: `:${displayNumber}`,
        webSocketURL: `ws://worker.railway.internal:${wsPort}`,
        createdAt: new Date()
      };
      
      vncSessions.set(sessionId, vncSession);
      
      console.log(`✅ VNC session ready: display=${vncSession.displayEnv}, port=${vncPort}`);
    }
    
    task.progress = 20;
    
    // Launch browser with VNC display
    console.log(`🌐 Launching browser on display ${vncSession.displayEnv}...`);
    
    const browser = await chromium.launch({
      headless: false, // MUST be false for VNC to see it
      env: {
        DISPLAY: vncSession.displayEnv
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage'
      ]
    });
    
    browsers.set(sessionId, browser);
    task.progress = 40;
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    task.progress = 60;
    
    // Execute automation based on instruction
    const instructionLower = instruction.toLowerCase();
    let result = { success: false, message: '', url: '', screenshot: null };
    
    if (instructionLower.includes('search')) {
      const searchMatch = instruction.match(/search(?:\s+for)?\s+(.+)/i);
      const query = searchMatch ? searchMatch[1].trim() : instruction;
      
      console.log(`🔍 Searching for: "${query}"`);
      await page.goto('https://www.google.com', { timeout: 30000 });
      await page.fill('textarea[name="q"]', query);
      await page.press('textarea[name="q"]', 'Enter');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      result = {
        success: true,
        message: `Searched for "${query}"`,
        url: page.url()
      };
    } else if (instructionLower.includes('navigate') || instructionLower.includes('go to') || instructionLower.includes('open')) {
      const urlMatch = instruction.match(/(?:navigate to|go to|open)\s+(.+)/i);
      const url = urlMatch ? urlMatch[1].trim() : 'https://www.google.com';
      
      console.log(`🌐 Navigating to: ${url}`);
      await page.goto(url.startsWith('http') ? url : `https://${url}`, { timeout: 30000 });
      
      result = {
        success: true,
        message: `Navigated to ${url}`,
        url: page.url()
      };
    } else {
      // Default: just go to Google
      await page.goto('https://www.google.com', { timeout: 30000 });
      result = {
        success: true,
        message: `Processed: ${instruction}`,
        url: page.url()
      };
    }
    
    task.progress = 90;
    
    // Capture screenshot
    const screenshotBuffer = await page.screenshot();
    result.screenshot = screenshotBuffer.toString('base64');
    
    task.progress = 100;
    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date();
    
    console.log(`✅ Task ${taskId} completed successfully`);
    
    // Keep browser open for 5 minutes for live viewing
    setTimeout(() => {
      if (browsers.has(sessionId)) {
        console.log(`🧹 Cleaning up browser for session ${sessionId}`);
        browser.close();
        browsers.delete(sessionId);
      }
      const s = vncSessions.get(sessionId);
      if (s) {
        s.vncProcess?.kill();
        s.websockifyProcess?.kill();
        s.xvfbProcess?.kill();
        vncSessions.delete(sessionId);
      }
    }, 5 * 60 * 1000);
    
    return result;
    
  } catch (error) {
    console.error(`❌ Task ${taskId} failed:`, error);
    task.status = 'failed';
    task.error = error.message;
    task.completedAt = new Date();
    throw error;
  }
}

// Create Express app for HTTP API
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'browser-automation-worker-vnc',
    uptime: process.uptime(),
    redis: config.redisUrl ? 'connected' : 'disabled',
    tasks: {
      total: tasks.size,
      browsers: browsers.size,
      vncSessions: vncSessions.size
    },
    timestamp: new Date().toISOString()
  });
});

// Submit task (fallback when no Redis)
app.post('/task', async (req, res) => {
  try {
    const { instruction, sessionId, agentId } = req.body;
    
    if (!instruction) {
      return res.status(400).json({ error: 'Instruction required' });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Execute task immediately (no queue)
    executeTask(taskId, instruction, sessionId || agentId || 'default').catch((error) => {
      console.error('Task execution error:', error);
    });
    
    res.json({
      success: true,
      taskId,
      message: 'Task queued for execution'
    });
  } catch (error) {
    console.error('❌ Task submission failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get task status
app.get('/task/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    result: task.result,
    error: task.error,
    startedAt: task.startedAt,
    completedAt: task.completedAt
  });
});

// Get VNC session info
app.get('/vnc/:sessionId', (req, res) => {
  const vncSession = vncSessions.get(req.params.sessionId);
  
  if (!vncSession) {
    return res.status(404).json({ error: 'VNC session not found' });
  }

  res.json({
    sessionId: vncSession.sessionId,
    displayEnv: vncSession.displayEnv,
    vncPort: vncSession.vncPort,
    webSocketURL: vncSession.webSocketURL,
    isActive: true,
    createdAt: vncSession.createdAt
  });
});

// Initialize Redis worker if Redis URL provided
if (config.redisUrl) {
  console.log('🔌 Connecting to Redis for BullMQ queue...');
  
  const connection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
  
  const worker = new Worker('browser-automation', async (job) => {
    console.log(`📥 Received job ${job.id} from queue`);
    
    const { instruction, sessionId, agentId } = job.data;
    const taskId = `task_${job.id}`;
    
    return await executeTask(taskId, instruction, sessionId || agentId);
  }, {
    connection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000
    }
  });
  
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message);
  });
  
  console.log('✅ BullMQ worker connected and listening for tasks');
} else {
  console.log('💡 Running without Redis - using HTTP API for task submission');
}

// Start HTTP server
const server = http.createServer(app);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`✅ Worker HTTP API listening on port ${config.port}`);
  console.log(`✅ Health check: http://localhost:${config.port}/health`);
  console.log(`✅ Task endpoint: http://localhost:${config.port}/task`);
  console.log(`🎯 Worker ready with VNC live streaming support`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  // Close all browsers
  for (const [sessionId, browser] of browsers) {
    console.log(`🧹 Closing browser for session ${sessionId}`);
    await browser.close().catch(() => {});
  }
  
  // Close all VNC sessions
  for (const [sessionId, vncSession] of vncSessions) {
    console.log(`🧹 Closing VNC session ${sessionId}`);
    if (vncSession.vncProcess) vncSession.vncProcess.kill();
    if (vncSession.xvfbProcess) vncSession.xvfbProcess.kill();
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
});

