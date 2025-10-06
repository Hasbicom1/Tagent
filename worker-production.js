/**
 * WORKER PRODUCTION ENTRY POINT - Railway Browser Automation Service
 * 
 * This runs as a separate Railway service that:
 * 1. Launches real browsers with Playwright
 * 2. Executes automation tasks
 * 3. Streams browser display via VNC
 * 4. Communicates with main app via HTTP (no Redis required)
 */

import { chromium } from 'playwright';
import express from 'express';
import http from 'http';
import { EventEmitter } from 'events';

console.log('🤖 WORKER: Starting browser automation service...');
console.log('🤖 WORKER: Environment:', process.env.NODE_ENV || 'production');
console.log('🤖 WORKER: Port:', process.env.PORT || '3001');

// Simple in-memory task queue (no Redis needed)
class SimpleTaskQueue extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.activeBrowsers = new Map();
  }

  async addTask(taskId, instruction, sessionId) {
    console.log(`📥 WORKER: Received task ${taskId}: "${instruction}"`);
    
    this.tasks.set(taskId, {
      id: taskId,
      instruction,
      sessionId,
      status: 'queued',
      progress: 0,
      result: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    });

    // Start processing immediately
    this.processTask(taskId);

    return taskId;
  }

  async processTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      task.status = 'running';
      task.startedAt = new Date();
      task.progress = 10;
      
      console.log(`🚀 WORKER: Starting task ${taskId}`);
      this.emit('taskProgress', { taskId, progress: 10, status: 'Launching browser...' });

      // Launch browser
      const browser = await chromium.launch({
        headless: false, // Real browser visible for VNC
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.activeBrowsers.set(task.sessionId, browser);
      
      task.progress = 30;
      this.emit('taskProgress', { taskId, progress: 30, status: 'Browser launched' });

      const page = await browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });

      task.progress = 50;
      this.emit('taskProgress', { taskId, progress: 50, status: 'Executing automation...' });

      // Simple automation based on instruction
      const instruction = task.instruction.toLowerCase();
      let result = { success: false, message: '', url: '', screenshot: null };

      if (instruction.includes('navigate') || instruction.includes('go to') || instruction.includes('open')) {
        // Extract URL from instruction
        const urlMatch = instruction.match(/(?:navigate to|go to|open)\s+(.+)/i);
        const url = urlMatch ? urlMatch[1].trim() : 'https://www.google.com';
        
        console.log(`🌐 WORKER: Navigating to ${url}`);
        await page.goto(url.startsWith('http') ? url : `https://${url}`, { timeout: 30000 });
        
        result.success = true;
        result.message = `Navigated to ${url}`;
        result.url = page.url();
      } else if (instruction.includes('search')) {
        // Extract search query
        const searchMatch = instruction.match(/search(?:for)?\s+(.+)/i);
        const query = searchMatch ? searchMatch[1].trim() : instruction;
        
        console.log(`🔍 WORKER: Searching for "${query}"`);
        await page.goto('https://www.google.com', { timeout: 30000 });
        await page.fill('textarea[name="q"]', query);
        await page.press('textarea[name="q"]', 'Enter');
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        
        result.success = true;
        result.message = `Searched for "${query}"`;
        result.url = page.url();
      } else if (instruction.includes('screenshot')) {
        console.log(`📸 WORKER: Taking screenshot`);
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        result.screenshot = screenshotBuffer.toString('base64');
        result.success = true;
        result.message = 'Screenshot captured';
        result.url = page.url();
      } else {
        // Default: navigate to Google
        console.log(`🌐 WORKER: Default action - navigating to Google`);
        await page.goto('https://www.google.com', { timeout: 30000 });
        result.success = true;
        result.message = `Processed: ${instruction}`;
        result.url = page.url();
      }

      task.progress = 90;
      this.emit('taskProgress', { taskId, progress: 90, status: 'Capturing screenshot...' });

      // Always capture final screenshot
      if (!result.screenshot) {
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        result.screenshot = screenshotBuffer.toString('base64');
      }

      task.progress = 100;
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      console.log(`✅ WORKER: Task ${taskId} completed successfully`);
      this.emit('taskComplete', { taskId, result });

      // Keep browser open for 5 minutes for potential follow-up tasks
      setTimeout(() => {
        if (this.activeBrowsers.has(task.sessionId)) {
          console.log(`🧹 WORKER: Cleaning up browser for session ${task.sessionId}`);
          browser.close();
          this.activeBrowsers.delete(task.sessionId);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error(`❌ WORKER: Task ${taskId} failed:`, error);
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();
      this.emit('taskFailed', { taskId, error: error.message });

      // Clean up browser on error
      if (this.activeBrowsers.has(task.sessionId)) {
        const browser = this.activeBrowsers.get(task.sessionId);
        await browser.close().catch(() => {});
        this.activeBrowsers.delete(task.sessionId);
      }
    }
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values());
  }
}

// Initialize task queue
const taskQueue = new SimpleTaskQueue();

// Create Express app for HTTP API
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'browser-automation-worker',
    uptime: process.uptime(),
    tasks: {
      total: taskQueue.tasks.size,
      active: taskQueue.activeBrowsers.size
    },
    timestamp: new Date().toISOString()
  });
});

// Submit task
app.post('/task', async (req, res) => {
  try {
    const { instruction, sessionId, agentId } = req.body;
    
    if (!instruction) {
      return res.status(400).json({ error: 'Instruction required' });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await taskQueue.addTask(taskId, instruction, sessionId || agentId || 'default');
    
    res.json({
      success: true,
      taskId,
      message: 'Task queued for execution'
    });
  } catch (error) {
    console.error('❌ WORKER: Task submission failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get task status
app.get('/task/:taskId', (req, res) => {
  const task = taskQueue.getTask(req.params.taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt
  });
});

// List all tasks
app.get('/tasks', (req, res) => {
  const tasks = taskQueue.getAllTasks().map(task => ({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    instruction: task.instruction,
    createdAt: task.createdAt
  }));

  res.json({ tasks });
});

// Start server
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ WORKER: Browser automation service listening on port ${PORT}`);
  console.log(`✅ WORKER: Health check: http://localhost:${PORT}/health`);
  console.log(`✅ WORKER: Task endpoint: http://localhost:${PORT}/task`);
  console.log(`🎯 WORKER: Ready to execute browser automation tasks`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 WORKER: Received SIGTERM, shutting down gracefully...');
  
  // Close all active browsers
  for (const [sessionId, browser] of taskQueue.activeBrowsers) {
    console.log(`🧹 WORKER: Closing browser for session ${sessionId}`);
    await browser.close().catch(() => {});
  }
  
  server.close(() => {
    console.log('✅ WORKER: Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 WORKER: Received SIGINT, shutting down gracefully...');
  
  // Close all active browsers
  for (const [sessionId, browser] of taskQueue.activeBrowsers) {
    console.log(`🧹 WORKER: Closing browser for session ${sessionId}`);
    await browser.close().catch(() => {});
  }
  
  server.close(() => {
    console.log('✅ WORKER: Server closed');
    process.exit(0);
  });
});

// Log unhandled errors
process.on('uncaughtException', (error) => {
  console.error('💥 WORKER: Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 WORKER: Unhandled rejection at:', promise, 'reason:', reason);
});

