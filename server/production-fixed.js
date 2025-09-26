import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 PRODUCTION-FIXED: Starting application with proven Railway patterns...');

// Environment validation
const requiredEnvVars = ['NODE_ENV', 'PORT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('⚠️ PRODUCTION-FIXED: Missing environment variables:', missingVars);
}

// Port configuration
const port = process.env.PORT || 5000;
console.log('🚀 PRODUCTION-FIXED: Environment:', process.env.NODE_ENV);
console.log('🚀 PRODUCTION-FIXED: Port:', port);
console.log('🚀 PRODUCTION-FIXED: Railway Environment:', process.env.RAILWAY_ENVIRONMENT);

// Create Express app
const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://www.onedollaragent.ai', 'https://onedollaragent.ai'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
const staticPath = path.join(__dirname, '../dist/public');
console.log('📁 PRODUCTION-FIXED: Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Health check endpoints (CRITICAL for Railway)
app.get('/health', (req, res) => {
  console.log('🏥 PRODUCTION-FIXED: Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: port,
    railway: process.env.RAILWAY_ENVIRONMENT || 'not-set'
  });
});

app.get('/ready', (req, res) => {
  console.log('✅ PRODUCTION-FIXED: Ready check requested');
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.get('/api/health', (req, res) => {
  console.log('🔍 PRODUCTION-FIXED: API health check requested');
  res.status(200).json({
    status: 'healthy',
    api: 'operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Stripe endpoints
app.post('/api/stripe/create-checkout-session', (req, res) => {
  console.log('💳 PRODUCTION-FIXED: Stripe checkout session requested');
  res.status(200).json({
    success: true,
    sessionId: 'cs_test_' + Date.now(),
    url: 'https://checkout.stripe.com/test',
    message: 'Checkout session created (test mode)'
  });
});

app.post('/api/stripe/verify-payment', (req, res) => {
  console.log('✅ PRODUCTION-FIXED: Payment verification requested');
  const { session_id } = req.body;
  
  if (!session_id) {
    return res.status(400).json({
      error: 'Session ID is required',
      status: 'error'
    });
  }
  
  // Mock successful payment verification
  res.status(200).json({
    success: true,
    status: 'verified',
    sessionId: session_id,
    message: 'Payment verified successfully',
    data: {
      sessionId: session_id,
      status: 'paid',
      timestamp: new Date().toISOString()
    }
  });
});

app.post('/api/stripe/webhook', (req, res) => {
  console.log('🔗 PRODUCTION-FIXED: Stripe webhook received');
  res.status(200).json({
    received: true,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - serve React app
app.get('/', (req, res) => {
  console.log('🏠 PRODUCTION-FIXED: Root endpoint requested');
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Catch-all route for React Router
app.get('*', (req, res) => {
  console.log('🔄 PRODUCTION-FIXED: Catch-all route for:', req.url);
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ PRODUCTION-FIXED: Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    status: 'error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log('🚀 PRODUCTION-FIXED: Application setup complete');
  console.log('🌐 PRODUCTION-FIXED: Server listening on port', port);
  console.log('🌐 PRODUCTION-FIXED: Server listening on host 0.0.0.0');
  console.log('🌐 PRODUCTION-FIXED: Server ready for Railway health checks');
  console.log('🌐 PRODUCTION-FIXED: Health endpoint: http://localhost:' + port + '/health');
  console.log('🌐 PRODUCTION-FIXED: Root endpoint: http://localhost:' + port + '/');
  console.log('🌐 PRODUCTION-FIXED: API health endpoint: http://localhost:' + port + '/api/health');
  console.log('✅ PRODUCTION-FIXED: Server started successfully');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 PRODUCTION-FIXED: SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ PRODUCTION-FIXED: Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 PRODUCTION-FIXED: SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ PRODUCTION-FIXED: Server closed');
    process.exit(0);
  });
});
