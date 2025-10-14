/**
 * Test API endpoints with SimpleOrchestrator integration
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8080';

async function testAPIEndpoints() {
  console.log('🧪 Testing API endpoints with SimpleOrchestrator...');
  
  try {
    // Test health endpoint
    console.log('🔍 Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health:', healthData);
    
    // Test browser command endpoint
    console.log('🔍 Testing browser command endpoint...');
    const commandResponse = await fetch(`${BASE_URL}/api/browser/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: 'Navigate to https://example.com and take a screenshot',
        sessionId: 'test-api-session-456',
        options: {
          timeout: 30000,
          waitForLoad: true
        }
      })
    });
    
    if (commandResponse.ok) {
      const commandData = await commandResponse.json();
      console.log('✅ Browser command response:', commandData);
      
      if (commandData.taskId) {
        // Test status endpoint
        console.log('🔍 Testing status endpoint...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await fetch(`${BASE_URL}/api/browser/status/${commandData.taskId}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('✅ Status response:', statusData);
        } else {
          console.log('⚠️  Status endpoint returned:', statusResponse.status, statusResponse.statusText);
        }
      }
    } else {
      console.log('❌ Browser command failed:', commandResponse.status, commandResponse.statusText);
      const errorText = await commandResponse.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Run the test
testAPIEndpoints().then(() => {
  console.log('🏁 API test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 API test crashed:', error);
  process.exit(1);
});