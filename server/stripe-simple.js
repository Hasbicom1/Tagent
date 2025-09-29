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
  
  if (!secretKey) {
    console.error('❌ SIMPLE STRIPE: STRIPE_SECRET_KEY is missing');
    return false;
  }
  
  try {
    stripe = new Stripe(secretKey);
    console.log('✅ SIMPLE STRIPE: Initialized successfully');
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
    return res.status(501).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: 'Payment gateway not initialized'
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
  
  // Header is case-insensitive; prefer canonical name
  const sig = req.get('Stripe-Signature') || req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('❌ SIMPLE STRIPE: Webhook secret missing');
    return res.status(400).json({
      error: 'WEBHOOK_ERROR',
      message: 'Webhook secret not configured'
    });
  }
  
  // Diagnostic: verify raw body presence
  const isBuffer = Buffer.isBuffer(req.body);
  if (!isBuffer) {
    console.error('❌ SIMPLE STRIPE: Raw body not a Buffer. Ensure express.raw() is used before any JSON parsers.');
  }

  try {
    // Stripe expects the exact raw payload (Buffer or string)
    const rawPayload = isBuffer ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');
    const event = stripe.webhooks.constructEvent(rawPayload, sig, webhookSecret);
    console.log('✅ SIMPLE STRIPE: Webhook verified:', event.type);
    
    return res.json({
      received: true,
      eventType: event.type
    });
    
  } catch (error) {
    console.error('❌ SIMPLE STRIPE: Webhook failed:', error.message);
    console.error('   Hint: Verify STRIPE_WEBHOOK_SECRET matches your configured endpoint (whsec_...).');
    console.error('   Signature header present:', !!sig);
    console.error('   Raw body is Buffer:', isBuffer);
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
