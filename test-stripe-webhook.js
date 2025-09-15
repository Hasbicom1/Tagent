#!/usr/bin/env node

/**
 * Comprehensive Stripe Webhook Integration Test Suite
 * Tests webhook endpoint functionality without requiring Stripe CLI
 */

import crypto from 'crypto';
import axios from 'axios';

// Test configuration
const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'http://localhost:5000/api/stripe/webhook';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_webhook_secret_for_testing';

console.log('🧪 Starting Stripe Webhook Integration Tests');
console.log(`📍 Testing endpoint: ${WEBHOOK_URL}`);
console.log(`🔑 Using webhook secret: ${WEBHOOK_SECRET.substring(0, 10)}...`);

/**
 * Generate a Stripe-compatible webhook signature
 * @param {string} payload - Raw JSON payload
 * @param {string} secret - Webhook secret
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Stripe signature header value
 */
function generateStripeSignature(payload, secret, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Create realistic Stripe webhook event payloads
 */
const createWebhookPayloads = () => {
  const baseTimestamp = Math.floor(Date.now() / 1000);
  
  return {
    payment_intent_succeeded: {
      id: `evt_test_${Date.now()}_1`,
      object: 'event',
      api_version: '2023-10-16',
      created: baseTimestamp,
      data: {
        object: {
          id: 'pi_test_payment_intent_123',
          object: 'payment_intent',
          amount: 100, // $1.00
          currency: 'usd',
          status: 'succeeded',
          customer: 'cus_test_customer_123',
          metadata: {
            agent_session_id: 'test_session_123',
            user_id: 'test_user_456'
          },
          payment_method: 'pm_test_card_visa',
          created: baseTimestamp - 60,
          description: 'One Dollar Agent - AI Session Access'
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_123',
        idempotency_key: null
      },
      type: 'payment_intent.succeeded'
    },

    payment_intent_failed: {
      id: `evt_test_${Date.now()}_2`,
      object: 'event',
      api_version: '2023-10-16',
      created: baseTimestamp,
      data: {
        object: {
          id: 'pi_test_payment_intent_failed_456',
          object: 'payment_intent',
          amount: 100,
          currency: 'usd',
          status: 'requires_payment_method',
          customer: 'cus_test_customer_789',
          metadata: {
            agent_session_id: 'test_session_failed_789'
          },
          last_payment_error: {
            code: 'card_declined',
            decline_code: 'insufficient_funds',
            message: 'Your card has insufficient funds.',
            type: 'card_error'
          },
          created: baseTimestamp - 30
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_456'
      },
      type: 'payment_intent.payment_failed'
    },

    checkout_session_completed: {
      id: `evt_test_${Date.now()}_3`,
      object: 'event',
      api_version: '2023-10-16',
      created: baseTimestamp,
      data: {
        object: {
          id: 'cs_test_checkout_session_completed_789',
          object: 'checkout.session',
          amount_total: 100,
          currency: 'usd',
          customer: 'cus_test_customer_completed_123',
          payment_intent: 'pi_test_payment_intent_checkout_789',
          payment_status: 'paid',
          status: 'complete',
          metadata: {
            agent_session_id: 'test_checkout_session_123',
            user_id: 'test_checkout_user_456'
          },
          mode: 'payment',
          success_url: 'https://onedollaragent.ai/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://onedollaragent.ai/cancel',
          created: baseTimestamp - 120
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_789'
      },
      type: 'checkout.session.completed'
    },

    invoice_payment_succeeded: {
      id: `evt_test_${Date.now()}_4`,
      object: 'event',
      api_version: '2023-10-16',
      created: baseTimestamp,
      data: {
        object: {
          id: 'in_test_invoice_123',
          object: 'invoice',
          amount_paid: 100,
          currency: 'usd',
          customer: 'cus_test_customer_invoice_123',
          subscription: 'sub_test_subscription_456',
          status: 'paid',
          payment_intent: 'pi_test_invoice_payment_789',
          created: baseTimestamp - 180
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_invoice_123'
      },
      type: 'invoice.payment_succeeded'
    },

    unknown_event_type: {
      id: `evt_test_${Date.now()}_5`,
      object: 'event',
      api_version: '2023-10-16',
      created: baseTimestamp,
      data: {
        object: {
          id: 'obj_test_unknown_123',
          object: 'unknown_object',
          test_field: 'test_value'
        }
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: 'req_test_unknown_123'
      },
      type: 'unknown.event.type'
    }
  };
};

/**
 * Test webhook endpoint with various scenarios
 */
async function runWebhookTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const payloads = createWebhookPayloads();
  const timestamp = Math.floor(Date.now() / 1000);

  console.log('\n🔬 Running Webhook Tests...\n');

  // Test 1: Valid payment_intent.succeeded webhook
  try {
    console.log('Test 1: Valid payment_intent.succeeded webhook');
    const payload = JSON.stringify(payloads.payment_intent_succeeded);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    if (response.status === 200 && response.data.received && response.data.eventType === 'payment_intent.succeeded') {
      console.log('✅ PASS: Payment success webhook processed correctly');
      console.log(`   Event ID: ${response.data.eventId}`);
      console.log(`   Processed: ${response.data.processed}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Unexpected response for payment success webhook');
      console.log('   Response:', response.data);
      results.failed++;
    }
    results.tests.push({ name: 'payment_intent.succeeded', status: 'passed' });
  } catch (error) {
    console.log('❌ FAIL: Payment success webhook test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'payment_intent.succeeded', status: 'failed', error: error.message });
  }

  // Test 2: Valid payment_intent.payment_failed webhook
  try {
    console.log('\nTest 2: Valid payment_intent.payment_failed webhook');
    const payload = JSON.stringify(payloads.payment_intent_failed);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp + 1);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    if (response.status === 200 && response.data.received && response.data.eventType === 'payment_intent.payment_failed') {
      console.log('✅ PASS: Payment failed webhook processed correctly');
      console.log(`   Event ID: ${response.data.eventId}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Unexpected response for payment failed webhook');
      results.failed++;
    }
    results.tests.push({ name: 'payment_intent.payment_failed', status: 'passed' });
  } catch (error) {
    console.log('❌ FAIL: Payment failed webhook test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'payment_intent.payment_failed', status: 'failed', error: error.message });
  }

  // Test 3: Valid checkout.session.completed webhook
  try {
    console.log('\nTest 3: Valid checkout.session.completed webhook');
    const payload = JSON.stringify(payloads.checkout_session_completed);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp + 2);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    if (response.status === 200 && response.data.received && response.data.eventType === 'checkout.session.completed') {
      console.log('✅ PASS: Checkout completed webhook processed correctly');
      console.log(`   Event ID: ${response.data.eventId}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Unexpected response for checkout completed webhook');
      results.failed++;
    }
    results.tests.push({ name: 'checkout.session.completed', status: 'passed' });
  } catch (error) {
    console.log('❌ FAIL: Checkout completed webhook test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'checkout.session.completed', status: 'failed', error: error.message });
  }

  // Test 4: Invalid signature (should fail)
  try {
    console.log('\nTest 4: Invalid signature verification');
    const payload = JSON.stringify(payloads.payment_intent_succeeded);
    const invalidSignature = generateStripeSignature(payload, 'wrong_secret', timestamp + 3);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': invalidSignature
      }
    });

    console.log('❌ FAIL: Invalid signature should have been rejected');
    console.log('   Response:', response.data);
    results.failed++;
    results.tests.push({ name: 'invalid_signature', status: 'failed', error: 'Should have rejected invalid signature' });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ PASS: Invalid signature correctly rejected with 400 status');
      console.log(`   Error message: ${error.response.data.error}`);
      results.passed++;
      results.tests.push({ name: 'invalid_signature', status: 'passed' });
    } else {
      console.log('❌ FAIL: Unexpected error for invalid signature test');
      console.log(`   Error: ${error.message}`);
      results.failed++;
      results.tests.push({ name: 'invalid_signature', status: 'failed', error: error.message });
    }
  }

  // Test 5: Missing signature (should fail)
  try {
    console.log('\nTest 5: Missing signature header');
    const payload = JSON.stringify(payloads.payment_intent_succeeded);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
        // No Stripe-Signature header
      }
    });

    console.log('❌ FAIL: Missing signature should have been rejected');
    results.failed++;
    results.tests.push({ name: 'missing_signature', status: 'failed', error: 'Should have rejected missing signature' });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ PASS: Missing signature correctly rejected with 400 status');
      console.log(`   Error message: ${error.response.data.error}`);
      results.passed++;
      results.tests.push({ name: 'missing_signature', status: 'passed' });
    } else {
      console.log('❌ FAIL: Unexpected error for missing signature test');
      results.failed++;
      results.tests.push({ name: 'missing_signature', status: 'failed', error: error.message });
    }
  }

  // Test 6: Unknown event type (should handle gracefully)
  try {
    console.log('\nTest 6: Unknown event type handling');
    const payload = JSON.stringify(payloads.unknown_event_type);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp + 4);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    if (response.status === 200 && response.data.received && response.data.eventType === 'unknown.event.type') {
      console.log('✅ PASS: Unknown event type handled gracefully');
      console.log(`   Event ID: ${response.data.eventId}`);
      console.log(`   Processed: ${response.data.processed} (expected: false)`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Unexpected response for unknown event type');
      results.failed++;
    }
    results.tests.push({ name: 'unknown_event_type', status: 'passed' });
  } catch (error) {
    console.log('❌ FAIL: Unknown event type test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'unknown_event_type', status: 'failed', error: error.message });
  }

  // Test 7: Malformed JSON (should fail gracefully)
  try {
    console.log('\nTest 7: Malformed JSON payload');
    const malformedPayload = '{"invalid": json}';
    const signature = generateStripeSignature(malformedPayload, WEBHOOK_SECRET, timestamp + 5);
    
    const response = await axios.post(WEBHOOK_URL, malformedPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    console.log('❌ FAIL: Malformed JSON should have been rejected');
    results.failed++;
    results.tests.push({ name: 'malformed_json', status: 'failed', error: 'Should have rejected malformed JSON' });
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ PASS: Malformed JSON correctly rejected');
      results.passed++;
      results.tests.push({ name: 'malformed_json', status: 'passed' });
    } else {
      console.log('❌ FAIL: Unexpected error for malformed JSON test');
      results.failed++;
      results.tests.push({ name: 'malformed_json', status: 'failed', error: error.message });
    }
  }

  // Test 8: Idempotency - First delivery should succeed
  try {
    console.log('\nTest 8: Idempotency Test - First delivery');
    const duplicateEventId = `evt_idempotency_test_duplicate_${timestamp}`; // Fixed ID for duplicate test
    const idempotencyTestPayload = {
      ...payloads.payment_intent_succeeded,
      id: duplicateEventId
    };
    const payload = JSON.stringify(idempotencyTestPayload);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp + 8);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    if (response.status === 200 && response.data.received && response.data.duplicate === false) {
      console.log('✅ PASS: First delivery processed successfully');
      console.log(`   Event ID: ${response.data.eventId}`);
      console.log(`   Duplicate: ${response.data.duplicate}`);
      console.log(`   Processed: ${response.data.processed}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: First delivery should have been processed as new event');
      console.log('   Response:', response.data);
      results.failed++;
    }
    results.tests.push({ name: 'idempotency_first_delivery', status: response.data.duplicate === false ? 'passed' : 'failed' });
  } catch (error) {
    console.log('❌ FAIL: Idempotency first delivery test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'idempotency_first_delivery', status: 'failed', error: error.message });
  }

  // Test 9: Idempotency - Duplicate delivery should be skipped
  try {
    console.log('\nTest 9: Idempotency Test - Duplicate delivery');
    // Use the exact same event ID as test 8 to simulate duplicate delivery
    const duplicateEventId = `evt_idempotency_test_duplicate_${timestamp}`; // Fixed ID for duplicate test
    const idempotencyTestPayload = {
      ...payloads.payment_intent_succeeded,
      id: duplicateEventId
    };
    const payload = JSON.stringify(idempotencyTestPayload);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp + 9);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });

    if (response.status === 200 && response.data.received && response.data.duplicate === true) {
      console.log('✅ PASS: Duplicate delivery correctly identified and skipped');
      console.log(`   Event ID: ${response.data.eventId}`);
      console.log(`   Duplicate: ${response.data.duplicate}`);
      console.log(`   Processed: ${response.data.processed}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Duplicate delivery should have been identified');
      console.log('   Response:', response.data);
      results.failed++;
    }
    results.tests.push({ name: 'idempotency_duplicate_detection', status: response.data.duplicate === true ? 'passed' : 'failed' });
  } catch (error) {
    console.log('❌ FAIL: Idempotency duplicate detection test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'idempotency_duplicate_detection', status: 'failed', error: error.message });
  }

  // Test 10: Rapid duplicate delivery simulation
  try {
    console.log('\nTest 10: Rapid duplicate delivery simulation');
    const rapidEventId = `evt_rapid_test_${Date.now()}`;
    const rapidPayload = {
      ...payloads.payment_intent_succeeded,
      id: rapidEventId
    };
    
    const payload = JSON.stringify(rapidPayload);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp + 10);
    
    // Send 3 identical webhooks rapidly
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        axios.post(WEBHOOK_URL, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': signature
          }
        })
      );
    }
    
    const responses = await Promise.allSettled(promises);
    const successResponses = responses.filter(r => r.status === 'fulfilled').map(r => r.value);
    
    if (successResponses.length === 3) {
      // Check that only one was processed as new, others as duplicates
      const newEvents = successResponses.filter(r => !r.data.duplicate).length;
      const duplicateEvents = successResponses.filter(r => r.data.duplicate).length;
      
      if (newEvents === 1 && duplicateEvents === 2) {
        console.log('✅ PASS: Rapid duplicate delivery handled correctly');
        console.log(`   New events: ${newEvents}, Duplicate events: ${duplicateEvents}`);
        results.passed++;
        results.tests.push({ name: 'rapid_duplicate_delivery', status: 'passed' });
      } else {
        console.log('❌ FAIL: Rapid duplicate delivery not handled correctly');
        console.log(`   New events: ${newEvents}, Duplicate events: ${duplicateEvents}`);
        results.failed++;
        results.tests.push({ name: 'rapid_duplicate_delivery', status: 'failed' });
      }
    } else {
      console.log('❌ FAIL: Not all rapid requests succeeded');
      console.log(`   Success responses: ${successResponses.length}/3`);
      results.failed++;
      results.tests.push({ name: 'rapid_duplicate_delivery', status: 'failed', error: 'Not all requests succeeded' });
    }
  } catch (error) {
    console.log('❌ FAIL: Rapid duplicate delivery test failed');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'rapid_duplicate_delivery', status: 'failed', error: error.message });
  }

  // Test 11: Different event types with same pattern (should not be duplicates)
  try {
    console.log('\nTest 11: Different event types should not interfere with idempotency');
    const baseId = `evt_different_types_${Date.now()}`;
    
    // Send payment_intent.succeeded first
    const paymentPayload = {
      ...payloads.payment_intent_succeeded,
      id: baseId + '_payment'
    };
    
    const checkoutPayload = {
      ...payloads.checkout_session_completed,
      id: baseId + '_checkout'
    };
    
    const paymentResponse = await axios.post(WEBHOOK_URL, JSON.stringify(paymentPayload), {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': generateStripeSignature(JSON.stringify(paymentPayload), WEBHOOK_SECRET, timestamp + 11)
      }
    });
    
    const checkoutResponse = await axios.post(WEBHOOK_URL, JSON.stringify(checkoutPayload), {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': generateStripeSignature(JSON.stringify(checkoutPayload), WEBHOOK_SECRET, timestamp + 12)
      }
    });
    
    if (paymentResponse.status === 200 && checkoutResponse.status === 200 && 
        !paymentResponse.data.duplicate && !checkoutResponse.data.duplicate) {
      console.log('✅ PASS: Different event types processed independently');
      console.log(`   Payment event duplicate: ${paymentResponse.data.duplicate}`);
      console.log(`   Checkout event duplicate: ${checkoutResponse.data.duplicate}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Different event types interfering with each other');
      results.failed++;
    }
    results.tests.push({ name: 'different_event_types', status: 'passed' });
  } catch (error) {
    console.log('❌ FAIL: Different event types test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    results.failed++;
    results.tests.push({ name: 'different_event_types', status: 'failed', error: error.message });
  }

  return results;
}

/**
 * Test webhook endpoint availability
 */
async function testWebhookAvailability() {
  try {
    console.log('🌐 Testing webhook endpoint availability...');
    
    // Simple GET request to check if server is running
    const response = await axios.get(WEBHOOK_URL.replace('/api/stripe/webhook', '/health'), {
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('✅ Server is running and accessible');
      return true;
    } else {
      console.log('⚠️  Server responded but with unexpected status:', response.status);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running or not accessible');
      console.log('   Please ensure the server is started with: npm run dev');
    } else {
      console.log('⚠️  Server availability test failed:', error.message);
    }
    return false;
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('===============================================');
  console.log('  🧪 STRIPE WEBHOOK INTEGRATION TEST SUITE');
  console.log('===============================================\n');

  // Check if server is available
  const serverAvailable = await testWebhookAvailability();
  if (!serverAvailable) {
    console.log('\n❌ Cannot run tests - server not available');
    process.exit(1);
  }

  // Run webhook tests
  const results = await runWebhookTests();

  // Print summary
  console.log('\n===============================================');
  console.log('  📊 TEST RESULTS SUMMARY');
  console.log('===============================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total: ${results.passed + results.failed}`);
  console.log(`🎯 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 Detailed Results:');
  results.tests.forEach((test, index) => {
    const status = test.status === 'passed' ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  if (results.passed === results.tests.length) {
    console.log('\n🎉 ALL TESTS PASSED! Webhook is production-ready.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review the implementation before production deployment.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
main().catch(error => {
  console.error('\n💥 Test suite crashed:', error.message);
  process.exit(1);
});

export {
  generateStripeSignature,
  createWebhookPayloads,
  runWebhookTests
};