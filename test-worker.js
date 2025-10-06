// Quick test script for worker
console.log('🧪 Testing worker service...');

const testTask = async () => {
  try {
    console.log('1. Checking worker health...');
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('✅ Worker health:', healthData);

    console.log('\n2. Submitting test task...');
    const taskResponse = await fetch('http://localhost:3001/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction: 'search for iPhone 15',
        sessionId: 'test-session-123'
      })
    });
    
    const taskData = await taskResponse.json();
    console.log('✅ Task submitted:', taskData);

    if (taskData.taskId) {
      console.log('\n3. Waiting for task to complete (10 seconds)...');
      
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`http://localhost:3001/task/${taskData.taskId}`);
        const statusData = await statusResponse.json();
        
        console.log(`   [${i+1}s] Status: ${statusData.status}, Progress: ${statusData.progress}%`);
        
        if (statusData.status === 'completed') {
          console.log('\n✅ Task completed successfully!');
          console.log('   Result:', statusData.result?.message);
          console.log('   URL:', statusData.result?.url);
          console.log('   Screenshot:', statusData.result?.screenshot ? 'Captured ✅' : 'Not available');
          break;
        }
        
        if (statusData.status === 'failed') {
          console.log('\n❌ Task failed:', statusData.error);
          break;
        }
      }
    }

    console.log('\n🎉 Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

testTask();

