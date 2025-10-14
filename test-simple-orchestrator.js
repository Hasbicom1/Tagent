/**
 * Test script for SimpleOrchestrator without Redis dependency
 */

import { SimpleOrchestrator } from './server/simple-orchestrator.ts';

async function testSimpleOrchestrator() {
  console.log('🧪 Testing SimpleOrchestrator...');
  
  try {
    // Initialize the orchestrator
    const orchestrator = new SimpleOrchestrator();
    await orchestrator.initialize();
    
    console.log('✅ SimpleOrchestrator initialized successfully');
    
    // Test a simple automation command
    const testRequest = {
      sessionId: 'test-session-123',
      command: 'Navigate to https://example.com and take a screenshot',
      options: {
        timeout: 30000,
        waitForLoad: true
      }
    };
    
    console.log('🚀 Executing test command:', testRequest.command);
    
    const response = await orchestrator.executeCommand(testRequest);
    
    console.log('📋 Response:', {
      success: response.success,
      taskId: response.taskId,
      message: response.message
    });
    
    if (response.success) {
      console.log('✅ SimpleOrchestrator test passed!');
      
      // Test status retrieval
      const status = await orchestrator.getTaskStatus(response.taskId);
      console.log('📊 Task status:', status);
    } else {
      console.log('❌ SimpleOrchestrator test failed:', response.error);
    }
    
    // Test system status
    const systemStatus = await orchestrator.getSystemStatus();
    console.log('🖥️  System status:', systemStatus);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testSimpleOrchestrator().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});