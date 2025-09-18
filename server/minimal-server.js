// Minimal server for Replit preview access
// This bypasses TypeScript issues and implements essential fixes

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// CRITICAL FIX 1: CORS headers for Replit preview
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin) {
    // Allow Replit domains
    const replitPatterns = [
      /^https?:\/\/.*\.replit\.app$/,
      /^https?:\/\/.*\.replit\.dev$/,
      /^https?:\/\/.*\.repl\.co$/
    ];
    
    const isReplitDomain = replitPatterns.some(pattern => pattern.test(origin));
    const isLocalhost = /^https?:\/\/(?:localhost|127\.0\.0\.1)/.test(origin);
    const isProductionDomain = origin.includes('onedollaragent.ai');
    
    if (isReplitDomain || isLocalhost || isProductionDomain) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      console.log('✅ CORS: Allowing origin:', origin);
    }
  }
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// CRITICAL FIX 2: Security headers that allow Replit iframe embedding
app.use((req, res, next) => {
  // Allow iframe embedding for Replit preview
  if (process.env.REPL_ID) {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "frame-ancestors 'self' https://*.replit.app https://*.replit.dev https://*.replit.com https://replit.com;"
    );
    console.log('🔧 REPLIT: Security headers configured for preview access');
  }
  
  next();
});

// Serve static files from client/dist
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Basic API health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server running for Replit preview',
    replit_domain: process.env.REPLIT_DOMAINS || 'not-set',
    timestamp: new Date().toISOString()
  });
});

// Catch-all handler for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Frontend not built. Run: npm run build');
    }
  });
});

const server = createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log('🚀 MINIMAL SERVER STARTED');
  console.log(`📍 Server running on port ${port}`);
  console.log(`🌐 Frontend accessible at: http://localhost:${port}`);
  console.log(`🔧 REPLIT DOMAIN: ${process.env.REPLIT_DOMAINS || 'not-set'}`);
  console.log('✅ REPLIT PREVIEW ACCESS ENABLED');
});

// Handle cleanup
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});