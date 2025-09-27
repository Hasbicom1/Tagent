/**
 * SIMPLE STRIPE INTEGRATION - Production Server
 * 
 * Simplified Stripe integration without complex imports.
 * This provides basic payment functionality for Railway deployment.
 */

import Stripe from 'stripe';

// Simple Stripe instance
let stripe = null;

/**
 * Initialize Stripe
 */
export function initStripe() {
  console.log('🔧 SIMPLE STRIPE: Initializing...');
  
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publicKey = process.env.VITE_STRIPE_PUBLIC_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // Check for required environment variables
  const missingVars = [];
  if (!secretKey) missingVars.push('STRIPE_SECRET_KEY');
  if (!publicKey) missingVars.push('VITE_STRIPE_PUBLIC_KEY');
  if (!webhookSecret) missingVars.push('STRIPE_WEBHOOK_SECRET');
  
  if (missingVars.length > 0) {
    console.error('❌ SIMPLE STRIPE: Missing environment variables:', missingVars);
    console.error('❌ SIMPLE STRIPE: Please set the following in Railway dashboard:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}: Your Stripe ${varName.includes('SECRET') ? 'secret' : 'public'} key`);
    });
    return false;
  }
  
  try {
    stripe = new Stripe(secretKey);
    console.log('✅ SIMPLE STRIPE: Initialized successfully');
    console.log('🔑 SIMPLE STRIPE: Secret key configured');
    console.log('🔑 SIMPLE STRIPE: Public key configured');
    console.log('🔑 SIMPLE STRIPE: Webhook secret configured');
    return true;
  } catch (error) {
    console.error('❌ SIMPLE STRIPE: Initialization failed:', error.message);
    return false;
  }
}

/**
 * Check if Stripe is available
 */
export function isStripeReady() {
  return stripe !== null;
}

/**
 * Create checkout session
 */
export async function createSession(req, res) {
  console.log('💳 SIMPLE STRIPE: Creating checkout session...');
  
  if (!isStripeReady()) {
    console.error('❌ SIMPLE STRIPE: Not initialized');
    
    // Check what's missing
    const missingVars = [];
    if (!process.env.STRIPE_SECRET_KEY) missingVars.push('STRIPE_SECRET_KEY');
    if (!process.env.VITE_STRIPE_PUBLIC_KEY) missingVars.push('VITE_STRIPE_PUBLIC_KEY');
    if (!process.env.STRIPE_WEBHOOK_SECRET) missingVars.push('STRIPE_WEBHOOK_SECRET');
    
    return res.status(501).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: 'Payment gateway not initialized',
      details: `Missing environment variables: ${missingVars.join(', ')}`,
      solution: 'Please configure Stripe environment variables in Railway dashboard'
    });
  }
  
  try {
    // Get base URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    
    console.log('🔗 SIMPLE STRIPE: Base URL:', baseUrl);
    
    // Create session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Agent For All - $1 AI Agent',
              description: 'Full autonomous AI agent access with unlimited task execution',
            },
            unit_amount: 100, // $1.00 in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });
    
    console.log('✅ SIMPLE STRIPE: Session created:', session.id);
    
    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
    
  } catch (error) {
    console.error('❌ SIMPLE STRIPE: Session creation failed:', error.message);
    return res.status(500).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: 'Failed to create checkout session',
      details: error.message
    });
  }
}

/**
 * Handle webhook
 */
export async function handleWebhook(req, res) {
  console.log('🔔 SIMPLE STRIPE: Webhook received');
  
  if (!isStripeReady()) {
    console.error('❌ SIMPLE STRIPE: Not initialized');
    return res.status(501).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: 'Payment gateway not initialized'
    });
  }
  
  const sig = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('❌ SIMPLE STRIPE: Webhook secret missing');
    return res.status(400).json({
      error: 'WEBHOOK_ERROR',
      message: 'Webhook secret not configured'
    });
  }
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ SIMPLE STRIPE: Webhook verified:', event.type);
    
    return res.json({
      received: true,
      eventType: event.type
    });
    
  } catch (error) {
    console.error('❌ SIMPLE STRIPE: Webhook failed:', error.message);
    return res.status(400).json({
      error: 'WEBHOOK_ERROR',
      message: 'Webhook verification failed',
      details: error.message
    });
  }
}

/**
 * Get status
 */
export function getStatus() {
  return {
    initialized: isStripeReady(),
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasPublicKey: !!process.env.VITE_STRIPE_PUBLIC_KEY
  };
}
