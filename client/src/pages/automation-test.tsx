import React, { useState, useEffect } from 'react';
import automationAgent from '../core/automation-agent';

export default function AutomationTest() {
  const [status, setStatus] = useState('Ready');
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Initialize automation agent
    automationAgent.init();
    
    // Add initial log
    addLog('🤖 Automation Test Page Loaded');
    addLog('💡 Try the test buttons below or use keyboard shortcuts');
  }, []);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, timestamp }]);
  };

  const testClick = async () => {
    addLog('🖱️ Testing click command...');
    try {
      await automationAgent.executeManualCommand('click', {
        selector: 'button'
      });
      addLog('✅ Click test completed');
    } catch (error) {
      addLog(`❌ Click test failed: ${error.message}`);
    }
  };

  const testType = async () => {
    addLog('⌨️ Testing type command...');
    try {
      await automationAgent.executeManualCommand('type', {
        selector: 'input',
        text: 'Hello from automation!'
      });
      addLog('✅ Type test completed');
    } catch (error) {
      addLog(`❌ Type test failed: ${error.message}`);
    }
  };

  const testScroll = async () => {
    addLog('📜 Testing scroll command...');
    try {
      await automationAgent.executeManualCommand('scroll', {
        y: 500
      });
      addLog('✅ Scroll test completed');
    } catch (error) {
      addLog(`❌ Scroll test failed: ${error.message}`);
    }
  };

  const testScreenshot = async () => {
    addLog('📸 Testing screenshot command...');
    try {
      const result = await automationAgent.executeManualCommand('screenshot', {});
      addLog('✅ Screenshot test completed');
      if (result.screenshot) {
        addLog('📷 Screenshot captured successfully');
      } else {
        addLog('📷 Page info captured (screenshot not available)');
      }
    } catch (error) {
      addLog(`❌ Screenshot test failed: ${error.message}`);
    }
  };

  const startSession = () => {
    automationAgent.startSession();
    addLog('🚀 Automation session started');
    setStatus('Running');
  };

  const stopSession = () => {
    automationAgent.stopSession();
    addLog('🛑 Automation session stopped');
    setStatus('Stopped');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('🧹 Logs cleared');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Automation Test Page</h1>
          <p className="text-gray-600 mb-4">
            Test the in-browser automation system. All actions are executed directly in your browser.
          </p>
          
          {/* Status */}
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              status === 'Running' ? 'bg-green-100 text-green-800' : 
              status === 'Stopped' ? 'bg-red-100 text-red-800' : 
              'bg-gray-100 text-gray-800'
            }`}>
              Status: {status}
            </div>
            <div className="text-sm text-gray-500">
              Session: {automationAgent.getStatus().isRunning ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
            
            {/* Session Controls */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Session Control</h3>
              <div className="flex space-x-3">
                <button
                  onClick={startSession}
                  disabled={automationAgent.getStatus().isRunning}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Start Session
                </button>
                <button
                  onClick={stopSession}
                  disabled={!automationAgent.getStatus().isRunning}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Stop Session
                </button>
              </div>
            </div>

            {/* Test Commands */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Test Commands</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={testClick}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Test Click
                </button>
                <button
                  onClick={testType}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Test Type
                </button>
                <button
                  onClick={testScroll}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Test Scroll
                </button>
                <button
                  onClick={testScreenshot}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Test Screenshot
                </button>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div>
              <h3 className="text-lg font-medium mb-3">Keyboard Shortcuts</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div><kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+Shift+A</kbd> Start automation</div>
                <div><kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+Shift+S</kbd> Stop automation</div>
              </div>
            </div>
          </div>

          {/* Test Elements */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Test Elements</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Input Field
                </label>
                <input
                  type="text"
                  placeholder="Type something here..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Textarea
                </label>
                <textarea
                  placeholder="Type a longer message here..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Test Button 1
                </button>
                <button className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Test Button 2
                </button>
                <button className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Test Button 3
                </button>
              </div>
              
              <div>
                <a href="#" className="text-blue-500 hover:text-blue-700 underline">
                  Test Link
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Activity Log</h2>
            <button
              onClick={clearLogs}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No activity yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
