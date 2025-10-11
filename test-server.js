/**
 * MINIMAL TEST SERVER - Railway Health Check Test
 * 
 * This is a minimal HTTP server to test Railway deployment
 * without any complex dependencies or Redis connections.
 */

import http from 'http';

console.log('🚀 MINIMAL TEST: Starting basic HTTP server...');
console.log('🚀 MINIMAL TEST: Environment:', process.env.NODE_ENV);
console.log('🚀 MINIMAL TEST: Port:', process.env.PORT || '5000');
console.log('🚀 MINIMAL TEST: Railway Environment:', process.env.RAILWAY_ENVIRONMENT);

const server = http.createServer((req, res) => {
  console.log('📥 MINIMAL TEST: Request received:', req.method, req.url);
  console.log('📥 MINIMAL TEST: Request headers:', req.headers);
  console.log('📥 MINIMAL TEST: Request IP:', req.connection.remoteAddress);
  
  // Handle health check endpoint
  if (req.url === '/health') {
    console.log('🏥 MINIMAL TEST: Health check requested');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '5000',
      railway: true,
      test: 'minimal-server'
    }));
    console.log('🏥 MINIMAL TEST: Health check response sent');
    return;
  }
  
  // Handle root endpoint
  if (req.url === '/') {
    console.log('🏠 MINIMAL TEST: Root endpoint requested');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'running',
      timestamp: new Date().toISOString(),
      message: 'Minimal test server is running',
      endpoints: ['/health', '/']
    }));
    console.log('🏠 MINIMAL TEST: Root response sent');
    return;
  }
  
  // Handle all other requests
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end('OK - Minimal Test Server');
  console.log('📤 MINIMAL TEST: Generic response sent');
});

const port = parseInt(process.env.PORT || '5000', 10);
const host = '0.0.0.0';

server.listen(port, host, () => {
  console.log('🌐 MINIMAL TEST: Server listening on port', port);
  console.log('🌐 MINIMAL TEST: Server listening on host', host);
  console.log('🌐 MINIMAL TEST: Server ready for Railway health checks');
  console.log('🌐 MINIMAL TEST: Health endpoint: http://localhost:' + port + '/health');
  console.log('🌐 MINIMAL TEST: Root endpoint: http://localhost:' + port + '/');
  console.log('✅ MINIMAL TEST: Server started successfully');
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ MINIMAL TEST: Server error:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('🔄 MINIMAL TEST: SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ MINIMAL TEST: Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 MINIMAL TEST: SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ MINIMAL TEST: Server closed');
    process.exit(0);
  });
});

console.log('🚀 MINIMAL TEST: Server setup complete');
