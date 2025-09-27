/**
 * Test Real Automation System
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testAutomation() {
  console.log('🧪 TESTING: Real Automation System');
  
  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test chat endpoint
    console.log('\n2. Testing chat endpoint...');
    const chatResponse = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'go to google.com'
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Chat response:', chatData);
    } else {
      console.log('❌ Chat failed:', chatResponse.status, await chatResponse.text());
    }
    
    // Test automation endpoint
    console.log('\n3. Testing automation endpoint...');
    const automationResponse = await fetch(`${BASE_URL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'go to google.com'
      })
    });
    
    if (automationResponse.ok) {
      const automationData = await automationResponse.json();
      console.log('✅ Automation response:', automationData);
    } else {
      console.log('❌ Automation failed:', automationResponse.status, await automationResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAutomation();
