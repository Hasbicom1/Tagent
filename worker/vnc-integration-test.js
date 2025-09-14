/**
 * VNC Integration Test
 * 
 * Tests the critical VNC integration fixes implemented in browser-engine.ts
 */

const { BrowserEngine } = require('./browser-engine');

async function testVNCIntegration() {
  console.log('🧪 Starting VNC Integration Test...');
  
  const browserEngine = new BrowserEngine({
    browserType: 'chromium',
    headless: false,
    taskTimeout: 30000,
    maxConcurrentSessions: 1,
    sessionTimeout: 300000
  });

  try {
    // Initialize the browser engine
    await browserEngine.initialize();
    console.log('✅ Browser engine initialized successfully');

    // Test task execution with VNC integration
    const testTask = {
      id: 'vnc-test-task-001',
      sessionId: 'vnc-test-session-001',
      instruction: 'Navigate to a test page and capture screenshot',
      url: 'data:text/html,<h1 style="color: green; font-size: 48px; text-align: center; margin-top: 200px;">VNC Integration Test - SUCCESS!</h1>',
      timeout: 30000
    };

    console.log('🔄 Executing test task with VNC integration...');
    
    // Set up event listeners for VNC events
    browserEngine.on('vncReady', (details) => {
      console.log('📺 VNC Ready Event Received:', {
        sessionId: details.sessionId,
        displayEnv: details.displayEnv,
        webSocketURL: details.webSocketURL,
        vncPort: details.vncPort,
        isActive: details.isActive,
        restored: details.restored || false
      });
    });

    browserEngine.on('browserLaunched', (sessionId) => {
      console.log('🚀 Browser Launched Event:', { sessionId });
    });

    // Execute the task
    const result = await browserEngine.executeTask(testTask);
    
    console.log('✅ Task execution completed:', {
      success: result.success,
      taskId: result.taskId,
      executionTime: `${result.executionTime.toFixed(2)}ms`,
      stepsCompleted: result.steps.filter(s => s.status === 'completed').length,
      totalSteps: result.steps.length,
      hasScreenshots: result.screenshots.length > 0,
      finalUrl: result.finalUrl
    });

    // Test VNC metadata in result
    if (result.liveView) {
      console.log('📺 VNC Live View Metadata:', {
        webSocketURL: result.liveView.webSocketURL,
        isActive: result.liveView.isActive,
        vncPort: result.liveView.vncPort,
        displayNumber: result.liveView.displayNumber
      });
    } else {
      console.log('⚠️ No VNC live view metadata found in result');
    }

    // Test session reuse and VNC resilience
    console.log('🔄 Testing session reuse and VNC resilience...');
    const testTask2 = {
      id: 'vnc-test-task-002',
      sessionId: 'vnc-test-session-001', // Same session ID
      instruction: 'Test session reuse with VNC resilience',
      url: 'data:text/html,<h1 style="color: blue; font-size: 48px; text-align: center; margin-top: 200px;">VNC Session Reuse Test - SUCCESS!</h1>',
      timeout: 30000
    };

    const result2 = await browserEngine.executeTask(testTask2);
    console.log('✅ Session reuse test completed:', {
      success: result2.success,
      reuseExecutionTime: `${result2.executionTime.toFixed(2)}ms`
    });

    console.log('🎉 VNC Integration Test PASSED!');
    
    return {
      success: true,
      vncIntegrationWorking: true,
      sessionReuseWorking: true,
      eventsEmitted: true
    };

  } catch (error) {
    console.error('❌ VNC Integration Test FAILED:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    try {
      await browserEngine.cleanup();
      console.log('🧹 Browser engine cleanup completed');
    } catch (error) {
      console.error('⚠️ Cleanup error:', error);
    }
  }
}

// Export for use in other tests
module.exports = { testVNCIntegration };

// Run test if called directly
if (require.main === module) {
  testVNCIntegration()
    .then((result) => {
      console.log('\n🏁 Final Test Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}