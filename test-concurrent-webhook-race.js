#!/usr/bin/env node

/**
 * Concurrent Webhook Race Condition Test Suite
 * Tests the atomic claim fix for preventing duplicate webhook processing
 */

import crypto from 'crypto';
import axios from 'axios';

const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'http://localhost:5000/api/stripe/webhook';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_webhook_secret_for_testing';

console.log('🧪 Starting Concurrent Webhook Race Condition Tests');
console.log(`📍 Testing endpoint: ${WEBHOOK_URL}`);
console.log(`🔑 Using webhook secret: ${WEBHOOK_SECRET.substring(0, 10)}...`);

/**
 * Generate a Stripe-compatible webhook signature
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
 * Create a test webhook payload
 */
function createTestWebhookPayload(eventId) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return {
    id: eventId,
    object: 'event',
    api_version: '2023-10-16',
    created: timestamp,
    data: {
      object: {
        id: 'pi_test_payment_intent_' + eventId.substring(-8),
        object: 'payment_intent',
        amount: 100,
        currency: 'usd',
        status: 'succeeded',
        customer: 'cus_test_customer_concurrent',
        metadata: {
          agent_session_id: 'test_concurrent_session',
          user_id: 'test_concurrent_user',
          test_type: 'race_condition_test'
        },
        created: timestamp - 60
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test_concurrent_' + Math.random().toString(36).substring(2, 8)
    },
    type: 'payment_intent.succeeded'
  };
}

/**
 * Send a single webhook request
 */
async function sendWebhookRequest(eventId, requestId, delayMs = 0) {
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  const payload = JSON.stringify(createTestWebhookPayload(eventId));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateStripeSignature(payload, WEBHOOK_SECRET, timestamp);
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      }
    });
    
    const endTime = Date.now();
    
    return {
      requestId,
      success: true,
      status: response.status,
      data: response.data,
      responseTime: endTime - startTime,
      timestamp: startTime
    };
  } catch (error) {
    const endTime = Date.now();
    
    return {
      requestId,
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message,
      responseTime: endTime - startTime,
      timestamp: startTime
    };
  }
}

/**
 * Test 1: Basic Atomic Claim Test
 * Send the same event ID twice in quick succession
 */
async function testBasicAtomicClaim() {
  console.log('\n🔬 Test 1: Basic Atomic Claim (Same Event ID, Sequential)');
  
  const eventId = `evt_basic_atomic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Send first request
  const result1 = await sendWebhookRequest(eventId, 'req1');
  console.log(`  Request 1: Status ${result1.status}, Processed: ${result1.data?.processed}, Duplicate: ${result1.data?.duplicate}`);
  
  // Send second request immediately (should be blocked by atomic claim)
  const result2 = await sendWebhookRequest(eventId, 'req2');
  console.log(`  Request 2: Status ${result2.status}, Processed: ${result2.data?.processed}, Duplicate: ${result2.data?.duplicate}`);
  
  // Verify results
  const success = result1.status === 200 && 
                 result2.status === 200 && 
                 result1.data?.processed === true && 
                 result1.data?.duplicate === false &&
                 result2.data?.duplicate === true;
                 
  console.log(`  ✅ Result: ${success ? 'PASS' : 'FAIL'} - Atomic claim ${success ? 'worked' : 'failed'}`);
  return success;
}

/**
 * Test 2: High Concurrency Race Test
 * Send multiple concurrent requests with same event ID
 */
async function testHighConcurrencyRace() {
  console.log('\n🔬 Test 2: High Concurrency Race (Same Event ID, Concurrent)');
  
  const eventId = `evt_race_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const concurrentRequests = 5;
  
  console.log(`  Sending ${concurrentRequests} concurrent requests with same event ID...`);
  
  // Send multiple concurrent requests
  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(sendWebhookRequest(eventId, `concurrent_req_${i + 1}`));
  }
  
  const results = await Promise.all(promises);
  
  // Analyze results
  const successfulProcessing = results.filter(r => r.data?.processed === true && r.data?.duplicate === false);
  const duplicateResponses = results.filter(r => r.data?.duplicate === true);
  const totalResponses = results.filter(r => r.status === 200);
  
  console.log(`  Successful processing: ${successfulProcessing.length}`);
  console.log(`  Duplicate responses: ${duplicateResponses.length}`);
  console.log(`  Total 200 responses: ${totalResponses.length}`);
  
  // Log individual results
  results.forEach(result => {
    console.log(`    ${result.requestId}: Status ${result.status}, Processed: ${result.data?.processed}, Duplicate: ${result.data?.duplicate}, Time: ${result.responseTime}ms`);
  });
  
  // Verify atomic behavior: exactly 1 successful processing, rest are duplicates
  const success = successfulProcessing.length === 1 && 
                 duplicateResponses.length === (concurrentRequests - 1) &&
                 totalResponses.length === concurrentRequests;
                 
  console.log(`  ✅ Result: ${success ? 'PASS' : 'FAIL'} - Race condition ${success ? 'prevented' : 'NOT PREVENTED'}`);
  return success;
}

/**
 * Test 3: Rapid Sequential Test
 * Send rapid sequential requests to test timing windows
 */
async function testRapidSequential() {
  console.log('\n🔬 Test 3: Rapid Sequential (Same Event ID, 10ms intervals)');
  
  const eventId = `evt_rapid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const sequentialRequests = 4;
  
  console.log(`  Sending ${sequentialRequests} rapid sequential requests...`);
  
  const results = [];
  
  // Send requests with small delays to test timing windows
  for (let i = 0; i < sequentialRequests; i++) {
    const result = await sendWebhookRequest(eventId, `rapid_req_${i + 1}`, i * 10);
    results.push(result);
    console.log(`    Request ${i + 1}: Status ${result.status}, Processed: ${result.data?.processed}, Duplicate: ${result.data?.duplicate}`);
  }
  
  // Analyze results
  const successfulProcessing = results.filter(r => r.data?.processed === true && r.data?.duplicate === false);
  const duplicateResponses = results.filter(r => r.data?.duplicate === true);
  
  const success = successfulProcessing.length === 1 && 
                 duplicateResponses.length === (sequentialRequests - 1);
                 
  console.log(`  ✅ Result: ${success ? 'PASS' : 'FAIL'} - Rapid sequential ${success ? 'handled correctly' : 'failed'}`);
  return success;
}

/**
 * Test 4: Different Event IDs Test
 * Verify different events can still process concurrently
 */
async function testDifferentEventIds() {
  console.log('\n🔬 Test 4: Different Event IDs (Should all process successfully)');
  
  const baseTimestamp = Date.now();
  const concurrentRequests = 3;
  
  console.log(`  Sending ${concurrentRequests} concurrent requests with different event IDs...`);
  
  // Send concurrent requests with different event IDs
  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    const eventId = `evt_different_${baseTimestamp}_${i + 1}`;
    promises.push(sendWebhookRequest(eventId, `different_req_${i + 1}`));
  }
  
  const results = await Promise.all(promises);
  
  // Log results
  results.forEach(result => {
    console.log(`    ${result.requestId}: Status ${result.status}, Processed: ${result.data?.processed}, Duplicate: ${result.data?.duplicate}`);
  });
  
  // Verify all processed successfully (no duplicates)
  const allSuccessful = results.every(r => 
    r.status === 200 && 
    r.data?.processed === true && 
    r.data?.duplicate === false
  );
  
  console.log(`  ✅ Result: ${allSuccessful ? 'PASS' : 'FAIL'} - Different events ${allSuccessful ? 'processed independently' : 'interfered with each other'}`);
  return allSuccessful;
}

/**
 * Test 5: Stress Test
 * High volume concurrent test
 */
async function testStressTest() {
  console.log('\n🔬 Test 5: Stress Test (10 concurrent requests, same event ID)');
  
  const eventId = `evt_stress_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const stressRequests = 10;
  
  console.log(`  Sending ${stressRequests} concurrent requests for stress testing...`);
  
  // Send high volume concurrent requests
  const promises = [];
  for (let i = 0; i < stressRequests; i++) {
    promises.push(sendWebhookRequest(eventId, `stress_req_${i + 1}`));
  }
  
  const startTime = Date.now();
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  // Analyze results
  const successfulProcessing = results.filter(r => r.data?.processed === true && r.data?.duplicate === false);
  const duplicateResponses = results.filter(r => r.data?.duplicate === true);
  const errors = results.filter(r => !r.success);
  
  console.log(`  Total time: ${endTime - startTime}ms`);
  console.log(`  Successful processing: ${successfulProcessing.length}`);
  console.log(`  Duplicate responses: ${duplicateResponses.length}`);
  console.log(`  Errors: ${errors.length}`);
  
  // Log response times
  const responseTimes = results.map(r => r.responseTime);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  console.log(`  Average response time: ${Math.round(avgResponseTime)}ms`);
  
  const success = successfulProcessing.length === 1 && 
                 duplicateResponses.length === (stressRequests - 1) &&
                 errors.length === 0;
                 
  console.log(`  ✅ Result: ${success ? 'PASS' : 'FAIL'} - Stress test ${success ? 'passed' : 'failed'}`);
  return success;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Concurrent Webhook Race Condition Test Suite\n');
  
  const tests = [
    testBasicAtomicClaim,
    testHighConcurrencyRace, 
    testRapidSequential,
    testDifferentEventIds,
    testStressTest
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
    } catch (error) {
      console.error(`❌ Test failed with error: ${error.message}`);
      results.push(false);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n📊 Test Results Summary:');
  console.log(`  Tests passed: ${passed}/${total}`);
  console.log(`  Success rate: ${Math.round((passed / total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED! Race condition successfully fixed!');
    console.log('✅ Atomic claim semantics working correctly');
    console.log('✅ Concurrent webhook processing prevented');
    console.log('✅ Duplicate detection working properly');
  } else {
    console.log('\n❌ SOME TESTS FAILED! Race condition may still exist.');
    console.log('⚠️  Check implementation of atomic claim semantics');
  }
  
  return passed === total;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { runAllTests };