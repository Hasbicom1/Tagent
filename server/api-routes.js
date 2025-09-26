/**
 * API ROUTES - Production Server
 * 
 * Simplified API routes for the production server without complex dependencies.
 * Builds incrementally on the working foundation.
 */

import express from 'express';

const router = express.Router();

// Basic API health check
router.get('/health', (req, res) => {
  console.log('🔍 API: Health check requested');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic API status
router.get('/status', (req, res) => {
  console.log('📊 API: Status requested');
  res.status(200).json({
    status: 'running',
    timestamp: new Date().toISOString(),
    service: 'api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      '/api/health',
      '/api/status',
      '/api/test'
    ]
  });
});

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🧪 API: Test endpoint requested');
  res.status(200).json({
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    test: 'success'
  });
});

// Stripe status endpoint
router.get('/stripe/status', async (req, res) => {
  console.log('💳 API: Stripe status requested');
  
  try {
    const { debugStripeComprehensive } = await import('../stripe-debug.js');
    const stripeStatus = await debugStripeComprehensive();
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      stripe: stripeStatus
    });
  } catch (error) {
    console.error('❌ API: Stripe status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Basic error handling for API routes
router.use((err, req, res, next) => {
  console.error('❌ API: Error in API route:', err);
  res.status(500).json({
    status: 'error',
    timestamp: new Date().toISOString(),
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler for API routes
router.use('*', (req, res) => {
  console.log('❓ API: Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    status: 'not_found',
    timestamp: new Date().toISOString(),
    message: 'API route not found',
    path: req.originalUrl
  });
});

export default router;
