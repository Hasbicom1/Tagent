import React, { useState, useEffect } from 'react';
import automationAgent from '../core/automation-agent';

export default function AutomationOverlay() {
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    // Check initial status
    const initialStatus = automationAgent.getStatus();
    setIsRunning(initialStatus.isRunning);
    setSessionInfo(initialStatus.session);

    // Listen for status changes
    const checkStatus = () => {
      const currentStatus = automationAgent.getStatus();
      setIsRunning(currentStatus.isRunning);
      setSessionInfo(currentStatus.session);
    };

    // Check status every second
    const statusInterval = setInterval(checkStatus, 1000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  const handleStart = () => {
    automationAgent.startSession();
    setStatus('Starting...');
  };

  const handleStop = () => {
    automationAgent.stopSession();
    setStatus('Stopped');
  };

  const handleTestCommand = async () => {
    if (!isRunning) {
      setStatus('Please start automation first');
      return;
    }

    setStatus('Testing command...');
    
    // Test with a simple click command
    await automationAgent.executeManualCommand('click', {
      selector: 'body'
    });
    
    setStatus('Test completed');
  };

  if (!isRunning && !sessionInfo) {
    return (
      <div className="fixed bottom-5 right-5 bg-gray-800 text-white p-4 rounded-xl shadow-lg border border-gray-600">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
          <span className="text-sm font-medium">Automation Ready</span>
        </div>
        <div className="mt-2 text-xs text-gray-300">
          Press Ctrl+Shift+A to start
        </div>
        <button
          onClick={handleStart}
          className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
        >
          Start Automation
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 bg-gray-800 text-white p-4 rounded-xl shadow-lg border border-gray-600 min-w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium">
            {isRunning ? 'Automation Active' : 'Automation Stopped'}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {sessionInfo?.id ? `Session: ${sessionInfo.id}` : 'No Session'}
        </div>
      </div>

      {/* Status */}
      <div className="mb-3">
        <div className="text-xs text-gray-300 mb-1">Status:</div>
        <div className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">
          {status}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            Start Automation
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleStop}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
            >
              Stop Automation
            </button>
            <button
              onClick={handleTestCommand}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
            >
              Test Command
            </button>
          </div>
        )}
      </div>

      {/* Session Info */}
      {sessionInfo && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="text-xs text-gray-300 mb-1">Session Info:</div>
          <div className="text-xs font-mono bg-gray-700 px-2 py-1 rounded">
            <div>ID: {sessionInfo.id}</div>
            <div>URL: {sessionInfo.url || window.location.href}</div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      <div className="mt-3 pt-3 border-t border-gray-600">
        <div className="text-xs text-gray-300 mb-1">Shortcuts:</div>
        <div className="text-xs space-y-1">
          <div>Ctrl+Shift+A: Start</div>
          <div>Ctrl+Shift+S: Stop</div>
        </div>
      </div>
    </div>
  );
}
