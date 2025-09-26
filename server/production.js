/**
 * PRODUCTION ENTRY POINT - Railway Deployment
 * 
 * This combines the working patterns from test-server.js with the actual application.
 * Follows the exact successful configuration that passed Railway health checks.
 */

import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
// import { getSharedRedis, waitForRedis } from './redis-singleton.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 PRODUCTION: Starting application with proven Railway patterns...');
console.log('🚀 PRODUCTION: Environment:', process.env.NODE_ENV);
console.log('🚀 PRODUCTION: Port:', process.env.PORT || '8080');
console.log('🚀 PRODUCTION: Railway Environment:', process.env.RAILWAY_ENVIRONMENT);

// STEP 1: Environment variable validation
const requiredEnvVars = ['NODE_ENV', 'PORT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn('⚠️ PRODUCTION: Missing environment variables:', missingVars);
}

// STEP 2: Port configuration (using proven pattern)
const port = parseInt(process.env.PORT || '8080', 10);
const host = '0.0.0.0';

// STEP 3: Create Express app
const app = express();

// STEP 4: CORS configuration (Railway-compatible)
app.use(cors({
  origin: [
    'https://onedollaragent.ai',
    'https://www.onedollaragent.ai',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  credentials: true
}));

// STEP 5: Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// STEP 5.5: Serve static files from dist/public
const staticPath = path.join(__dirname, '..', 'dist', 'public');
console.log('📁 PRODUCTION: Serving static files from:', staticPath);
app.use(express.static(staticPath));

// STEP 6: Health endpoints setup (IMMEDIATE AVAILABILITY - proven pattern)
app.get('/health', async (req, res) => {
  console.log('🏥 PRODUCTION: Health check requested');
  
  try {
    // Simple health check without Redis for now
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: 'not_configured',
      environment: process.env.NODE_ENV || 'development',
      port: port,
      railway: true,
      endpoints: ['/health', '/', '/api/health']
    });
    
    console.log('🏥 PRODUCTION: Health check response sent');
  } catch (error) {
    console.error('❌ PRODUCTION: Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// STEP 7: Root endpoint - Serve React application
app.get('/', (req, res) => {
  console.log('🏠 PRODUCTION: Root endpoint requested - serving React app');
  res.sendFile(path.join(staticPath, 'index.html'));
  console.log('🏠 PRODUCTION: React application served');
});

// STEP 8: API health endpoint
app.get('/api/health', async (req, res) => {
  console.log('🔍 PRODUCTION: API health check requested');
  
  try {
    // Simple API health check without Redis for now
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: 'not_configured',
      environment: process.env.NODE_ENV || 'development',
      services: {
        express: 'running',
        redis: 'not_configured',
        server: 'listening'
      }
    });
    
    console.log('🔍 PRODUCTION: API health response sent');
  } catch (error) {
    console.error('❌ PRODUCTION: API health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// STEP 9: Initialize Redis singleton (NON-BLOCKING) - DISABLED FOR NOW
console.log('🔧 PRODUCTION: Redis initialization disabled for minimal test');
let redisConnected = false;
console.log('⚠️ PRODUCTION: Redis not configured - using minimal setup');

// STEP 10: Initialize other services (NON-BLOCKING) - DISABLED FOR NOW
console.log('🔧 PRODUCTION: Other services initialization disabled for minimal test');
console.log('⚠️ PRODUCTION: Using minimal setup without complex services');

// STEP 11: Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ PRODUCTION: Express error:', err);
  res.status(500).json({
    status: 'error',
    timestamp: new Date().toISOString(),
    error: err.message
  });
});

// STEP 12: Catch-all handler for React Router (SPA routing)
app.get('*', (req, res) => {
  console.log('🔄 PRODUCTION: SPA route requested:', req.originalUrl);
  // Serve React app for all non-API routes
  if (!req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/health')) {
    res.sendFile(path.join(staticPath, 'index.html'));
    console.log('🔄 PRODUCTION: SPA route served');
  } else {
    // API routes that don't exist
    console.log('❓ PRODUCTION: API route not found:', req.method, req.originalUrl);
    res.status(404).json({
      status: 'not_found',
      timestamp: new Date().toISOString(),
      message: 'API route not found',
      path: req.originalUrl
    });
  }
});

// STEP 13: Create HTTP server
const server = http.createServer(app);

// STEP 14: Server listening (proven pattern)
server.listen(port, host, () => {
  console.log('🌐 PRODUCTION: Server listening on port', port);
  console.log('🌐 PRODUCTION: Server listening on host', host);
  console.log('🌐 PRODUCTION: Server ready for Railway health checks');
  console.log('🌐 PRODUCTION: Health endpoint: http://localhost:' + port + '/health');
  console.log('🌐 PRODUCTION: Root endpoint: http://localhost:' + port + '/');
  console.log('🌐 PRODUCTION: API health endpoint: http://localhost:' + port + '/api/health');
  console.log('✅ PRODUCTION: Server started successfully');
  console.log('✅ PRODUCTION: Redis status:', redisConnected ? 'connected' : 'disconnected');
});

// STEP 15: Handle server errors
server.on('error', (error) => {
  console.error('❌ PRODUCTION: Server error:', error);
  process.exit(1);
});

// STEP 16: Handle process termination (proven pattern)
process.on('SIGTERM', () => {
  console.log('🔄 PRODUCTION: SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ PRODUCTION: Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 PRODUCTION: SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ PRODUCTION: Server closed');
    process.exit(0);
  });
});

console.log('🚀 PRODUCTION: Application setup complete');
