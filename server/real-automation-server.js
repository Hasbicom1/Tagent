/**
 * REAL AUTOMATION SERVER
 * 
 * Production server with actual AI browser automation
 * No simulations, no mocks - real functionality
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { RealTimeAutomationSocket } from './websocket/real-time-automation.js';
import { createAutomationRoutes } from './routes/real-automation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

console.log(`🚀 REAL AUTOMATION: Starting server on port ${PORT}`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public')));

// Initialize WebSocket for real-time automation
const automationSocket = new RealTimeAutomationSocket(server);

// Health check endpoint (required by Railway)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    automation: 'ready'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Real automation API routes
app.use('/api/automation', createAutomationRoutes(automationSocket.io));

// Basic API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    message: 'Real automation server is operational',
    automation: 'active',
    timestamp: new Date().toISOString()
  });
});

// Real chat endpoint with AI processing
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    console.log(`💬 REAL CHAT: Processing message: "${message}"`);
    
    // Import AI engine
    const { RealAIEngine } = await import('./ai/real-ai-engine.js');
    const aiEngine = new RealAIEngine();
    await aiEngine.initialize();
    
    // Process with real AI
    const result = await aiEngine.processUserInput(message);
    
    res.json({
      success: true,
      response: result.response,
      analysis: result.analysis,
      steps: result.steps,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ REAL CHAT: Processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Real automation execution endpoint
app.post('/api/execute', async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  try {
    console.log(`🎯 REAL EXECUTE: Executing command: "${command}"`);
    
    // Import browser engine
    const { RealBrowserEngine } = await import('./automation/real-browser-engine.js');
    const browserEngine = new RealBrowserEngine();
    await browserEngine.initialize();
    
    // Execute real browser automation
    const result = await browserEngine.executeCommand(command);
    
    res.json({
      success: true,
      command,
      result,
      screenshot: result.screenshot,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ REAL EXECUTE: Execution failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 REAL AUTOMATION: Server running on port ${PORT}`);
  console.log(`🌐 REAL AUTOMATION: Health check: http://localhost:${PORT}/health`);
  console.log(`📱 REAL AUTOMATION: Frontend: http://localhost:${PORT}/`);
  console.log(`🔌 REAL AUTOMATION: WebSocket ready for real-time automation`);
  console.log(`✅ REAL AUTOMATION: Ready for production deployment`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 REAL AUTOMATION: Received SIGTERM, shutting down gracefully');
  
  // Close browser engine if active
  try {
    const { RealBrowserEngine } = await import('./automation/real-browser-engine.js');
    // Note: In production, you'd want to properly close all browser instances
  } catch (error) {
    console.error('❌ REAL AUTOMATION: Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 REAL AUTOMATION: Received SIGINT, shutting down gracefully');
  
  // Close browser engine if active
  try {
    const { RealBrowserEngine } = await import('./automation/real-browser-engine.js');
    // Note: In production, you'd want to properly close all browser instances
  } catch (error) {
    console.error('❌ REAL AUTOMATION: Error during shutdown:', error);
  }
  
  process.exit(0);
});
