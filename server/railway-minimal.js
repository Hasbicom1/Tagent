/**
 * RAILWAY MINIMAL SERVER
 * 
 * Minimal Express server for Railway deployment
 * No Redis, no complex dependencies - just basic functionality
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public')));

// Health check endpoint (required by Railway)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Basic API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    message: 'Server is operational',
    timestamp: new Date().toISOString()
  });
});

// Simple chat endpoint (no AI processing yet)
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  // Simple echo response for now
  res.json({
    success: true,
    response: `Echo: ${message}`,
    timestamp: new Date().toISOString()
  });
});

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RAILWAY MINIMAL: Server running on port ${PORT}`);
  console.log(`🌐 RAILWAY MINIMAL: Health check: http://localhost:${PORT}/health`);
  console.log(`📱 RAILWAY MINIMAL: Frontend: http://localhost:${PORT}/`);
  console.log(`✅ RAILWAY MINIMAL: Ready for Railway deployment`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 RAILWAY MINIMAL: Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 RAILWAY MINIMAL: Received SIGINT, shutting down gracefully');
  process.exit(0);
});
