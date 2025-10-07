/**
 * SIMPLE BROWSER AUTOMATION WORKER
 *
 * Just runs browser automation tasks - no streaming, no VNC, no complexity
 * Users see mouse moving and Google surfing - that's it.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const http = require('http');
const express = require('express');

console.log('🤖 SIMPLE WORKER: Starting browser automation worker...');
console.log('🤖 Environment:', process.env.NODE_ENV || 'production');
console.log('🤖 Port:', process.env.PORT || '8080');

// Simple in-memory task storage
const tasks = new Map();
const browsers = new Map();

// Express app for health check
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tasks: tasks.size,
    browsers: browsers.size
  });
});

// Task endpoint - receives automation tasks
app.post('/task', async (req, res) => {
  try {
    const { instruction, sessionId, agentId } = req.body;
    console.log('📋 SIMPLE WORKER: Received task:', instruction);

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    tasks.set(taskId, {
      id: taskId,
      instruction,
      sessionId,
      agentId,
      status: 'processing',
      startTime: new Date().toISOString()
    });

    // Execute the browser automation
    executeBrowserTask(taskId, instruction).catch(error => {
      console.error('❌ Browser task failed:', error);
      tasks.set(taskId, {
        ...tasks.get(taskId),
        status: 'failed',
        error: error.message
      });
    });

    res.json({ taskId, status: 'started' });
  } catch (error) {
    console.error('❌ Task endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Task status endpoint
app.get('/task/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// Start server
const server = app.listen(process.env.PORT || 8080, () => {
  console.log('🌐 SIMPLE WORKER: HTTP server listening on port', process.env.PORT || 8080);
  console.log('✅ SIMPLE WORKER: Ready to receive browser automation tasks');
});

// Browser automation function
async function executeBrowserTask(taskId, instruction) {
  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log('🌐 Starting browser for task:', taskId);

    // Launch browser
    browser = await chromium.launch({
      headless: true, // No VNC needed
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    browsers.set(taskId, browser);
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();

    // Update task status
    tasks.set(taskId, {
      ...tasks.get(taskId),
      status: 'running',
      browserStarted: new Date().toISOString()
    });

    // Execute the instruction
    const result = await executeInstruction(page, instruction);

    // Update task status
    tasks.set(taskId, {
      ...tasks.get(taskId),
      status: 'completed',
      result,
      completedAt: new Date().toISOString()
    });

    console.log('✅ Task completed:', taskId);

  } catch (error) {
    console.error('❌ Browser automation failed:', error);
    tasks.set(taskId, {
      ...tasks.get(taskId),
      status: 'failed',
      error: error.message,
      failedAt: new Date().toISOString()
    });
  } finally {
    // Cleanup
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
      browsers.delete(taskId);
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup error:', cleanupError.message);
    }
  }
}

// Execute specific instructions
async function executeInstruction(page, instruction) {
  const lowerInstruction = instruction.toLowerCase();

  try {
    // Navigate to Google
    if (lowerInstruction.includes('google') || lowerInstruction.includes('search')) {
      await page.goto('https://google.com');
      await page.waitForLoadState('networkidle');

      if (lowerInstruction.includes('search for')) {
        const searchTerm = instruction.replace(/.*search for\s+/i, '');
        await page.fill('textarea[name="q"], input[name="q"]', searchTerm);
        await page.press('textarea[name="q"], input[name="q"]', 'Enter');
        await page.waitForLoadState('networkidle');
      }

      return { action: 'navigated', url: page.url() };
    }

    // Navigate to specific URL
    if (lowerInstruction.includes('navigate') || lowerInstruction.includes('go to')) {
      const urlMatch = instruction.match(/(?:navigate|go)\s+to\s+([^\s]+)/i);
      if (urlMatch) {
        const url = urlMatch[1];
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        return { action: 'navigated', url: page.url() };
      }
    }

    // Click on element
    if (lowerInstruction.includes('click')) {
      const clickTarget = instruction.replace(/.*click\s+/i, '').replace(/on\s+/i, '');
      try {
        await page.click(clickTarget);
        return { action: 'clicked', target: clickTarget };
      } catch (clickError) {
        console.warn('⚠️ Click failed:', clickError.message);
        return { action: 'click_failed', target: clickTarget, error: clickError.message };
      }
    }

    // Type text
    if (lowerInstruction.includes('type') || lowerInstruction.includes('fill')) {
      const typeMatch = instruction.match(/(?:type|fill)\s+(.+)/i);
      if (typeMatch) {
        const text = typeMatch[1].replace(/["']/g, '');
        await page.keyboard.type(text, { delay: 100 });
        return { action: 'typed', text };
      }
    }

    // Take screenshot
    if (lowerInstruction.includes('screenshot')) {
      const screenshot = await page.screenshot({ fullPage: true });
      return { action: 'screenshot_taken', size: screenshot.length };
    }

    // Default: just navigate to Google
    await page.goto('https://google.com');
    return { action: 'default_navigation', url: 'https://google.com' };

  } catch (error) {
    console.error('❌ Instruction execution failed:', error);
    return { action: 'failed', error: error.message };
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIMPLE WORKER: SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ SIMPLE WORKER: HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIMPLE WORKER: SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ SIMPLE WORKER: HTTP server closed');
    process.exit(0);
  });
});
