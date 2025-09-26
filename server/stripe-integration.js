/**
 * STRIPE INTEGRATION - Production Server
 * 
 * Complete Stripe payment gateway integration for the production server.
 * This provides the actual payment functionality that was missing.
 */

import Stripe from 'stripe';

// Initialize Stripe with environment validation
let stripe = null;
let stripeInitialized = false;

/**
 * Initialize Stripe payment gateway
 */
export function initializeStripe() {
  console.log('🔧 STRIPE: Initializing payment gateway...');
  
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    console.error('❌ STRIPE: STRIPE_SECRET_KEY is missing');
    console.error('   Add STRIPE_SECRET_KEY to Railway environment variables');
    return {
      success: false,
      error: 'STRIPE_SECRET_KEY is missing'
    };
  }
  
  if (!stripeSecretKey.startsWith('sk_')) {
    console.error('❌ STRIPE: Invalid Stripe secret key format');
    console.error('   Key must start with "sk_"');
    return {
      success: false,
      error: 'Invalid Stripe secret key format'
    };
  }
  
  try {
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      timeout: 10000
    });
    
    stripeInitialized = true;
    console.log('✅ STRIPE: Payment gateway initialized successfully');
    
    return {
      success: true,
      message: 'Stripe payment gateway initialized'
    };
  } catch (error) {
    console.error('❌ STRIPE: Initialization failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get Stripe instance
 */
export function getStripe() {
  if (!stripeInitialized) {
    console.warn('⚠️ STRIPE: Payment gateway not initialized');
    return null;
  }
  return stripe;
}

/**
 * Check if Stripe is available
 */
export function isStripeAvailable() {
  return stripeInitialized && stripe !== null;
}

/**
 * Create checkout session
 */
export async function createCheckoutSession(req, res) {
  console.log('💳 STRIPE: Creating checkout session...');
  
  if (!isStripeAvailable()) {
    console.error('❌ STRIPE: Payment gateway not available');
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
    
    console.log('🔗 STRIPE: Base URL:', baseUrl);
    
    // Create checkout session
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
      metadata: {
        product: 'agent-for-all-1-dollar'
      }
    });
    
    console.log('✅ STRIPE: Checkout session created:', session.id);
    console.log('🔗 STRIPE: Success URL:', `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`);
    console.log('🔗 STRIPE: Cancel URL:', `${baseUrl}/cancel`);
    
    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
    
  } catch (error) {
    console.error('❌ STRIPE: Checkout session creation failed:', error.message);
    return res.status(500).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: 'Failed to create checkout session',
      details: error.message
    });
  }
}

/**
 * Handle Stripe webhook
 */
export async function handleStripeWebhook(req, res) {
  console.log('🔔 STRIPE: Webhook received');
  
  if (!isStripeAvailable()) {
    console.error('❌ STRIPE: Payment gateway not available for webhook');
    return res.status(501).json({
      error: 'PAYMENT_GATEWAY_ERROR',
      message: 'Payment gateway not initialized'
    });
  }
  
  const sig = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('❌ STRIPE: STRIPE_WEBHOOK_SECRET is missing');
    return res.status(400).json({
      error: 'WEBHOOK_ERROR',
      message: 'Webhook secret not configured'
    });
  }
  
  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    console.log('✅ STRIPE: Webhook signature verified:', event.type);
    
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('💰 STRIPE: Payment succeeded:', event.data.object.id);
        break;
        
      case 'checkout.session.completed':
        console.log('✅ STRIPE: Checkout session completed:', event.data.object.id);
        break;
        
      default:
        console.log('ℹ️ STRIPE: Unhandled event type:', event.type);
    }
    
    return res.json({
      received: true,
      eventType: event.type
    });
    
  } catch (error) {
    console.error('❌ STRIPE: Webhook verification failed:', error.message);
    return res.status(400).json({
      error: 'WEBHOOK_ERROR',
      message: 'Webhook verification failed',
      details: error.message
    });
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(sessionId) {
  if (!isStripeAvailable()) {
    return {
      success: false,
      error: 'Payment gateway not available'
    };
  }
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return {
      success: true,
      session: {
        id: session.id,
        status: session.payment_status,
        amount: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_email
      }
    };
  } catch (error) {
    console.error('❌ STRIPE: Failed to retrieve session:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
