/**
 * IN-BROWSER AUTOMATION VIEWER
 * 
 * NO VNC - Direct browser control using in-browser automation
 * AI agents control the user's browser directly via JavaScript
 */

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeTaskStatus } from '@/hooks/use-realtime-task-status';

interface BrowserStreamViewerProps {
  sessionId: string;
  agentId?: string;
  workerUrl?: string;
}

export function BrowserStreamViewer({ 
  sessionId,
  agentId,
  workerUrl = 'https://worker-production-6480.up.railway.app' 
}: BrowserStreamViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<string>('Initializing...');
  const [isAutomationActive, setIsAutomationActive] = useState(false);
  const automationAgentRef = useRef<any>(null);

  // Real-time WebSocket connection for automation commands
  const {
    connectionStatus,
    taskStatuses,
    taskProgress,
    allTaskLogs,
    connect: connectWebSocket,
    subscribeToTask,
    subscribeToSession,
    disconnect
  } = useRealtimeTaskStatus(agentId, sessionId);

  useEffect(() => {
    console.log('[IN-BROWSER_AUTOMATION] Session ID:', sessionId);
    console.log('[IN-BROWSER_AUTOMATION] Agent ID:', agentId);
    
    // Initialize automation agent
    initializeAutomationAgent();
    
    // Connect to WebSocket for real-time automation commands
    if (agentId) {
      connectWebSocket();
    }
    
    setIsLoading(false);
  }, [sessionId, agentId, workerUrl]);

  const initializeAutomationAgent = async () => {
    try {
      // Dynamically import and initialize the automation agent
      // @ts-ignore - automation-agent.js doesn't have TypeScript declarations
      const { default: automationAgent, AutomationAgent } = await import('@/core/automation-agent.js');
      
      if (!automationAgentRef.current) {
        automationAgentRef.current = automationAgent;
        await automationAgentRef.current.init();
        
        // Set up session data
        const sessionData = {
          sessionId,
          agentId,
          workerUrl
        };
        
        await automationAgentRef.current.startSession(sessionData);
        setIsAutomationActive(true);
        setAutomationStatus('Automation Agent Active');
        
        console.log('✅ [IN-BROWSER_AUTOMATION] Automation agent initialized');
      }
    } catch (error) {
      console.error('❌ [IN-BROWSER_AUTOMATION] Failed to initialize automation agent:', error);
      setError(`Failed to initialize automation: ${error}`);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white p-8">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold mb-2">Connection Error</h3>
        <p className="text-gray-400 text-center max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400">Initializing in-browser automation...</p>
        <p className="text-gray-600 text-sm mt-2">Session: {sessionId.substring(0, 16)}...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isAutomationActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-sm font-medium text-gray-200">In-Browser Automation</span>
          <span className="text-xs text-gray-400">({automationStatus})</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500">
            Session: {sessionId.substring(0, 16)}...
          </div>
          <div className={`px-2 py-1 rounded text-xs ${
            connectionStatus.isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Live Browser View - THE MISSING PIECE */}
      <div className="flex-1 flex flex-col">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-300">WebSocket: {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isAutomationActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-gray-300">REAL Agent: {isAutomationActive ? 'Active' : 'Initializing'}</span>
            </div>
            {taskStatuses.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-gray-300">Active Tasks: {taskStatuses.length}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (automationAgentRef.current) {
                  automationAgentRef.current.testAutomation();
                }
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
              disabled={!isAutomationActive}
            >
              Test
            </button>
            <button
              onClick={() => {
                if (automationAgentRef.current) {
                  automationAgentRef.current.takeScreenshot();
                }
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
              disabled={!isAutomationActive}
            >
              Screenshot
            </button>
          </div>
        </div>

        {/* IN-BROWSER AUTOMATION VIEW - NO VNC NEEDED */}
        <div 
          id="live-browser-agent-DXyiI6TP"
          className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white"
          style={{ flex: 1 }}
        >
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto">
              <div className="text-4xl">🤖</div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold">
                {isAutomationActive ? 'IN-BROWSER AUTOMATION ACTIVE' : 'INITIALIZING AUTOMATION'}
              </h3>
              <p className="text-gray-400 max-w-md">
                {isAutomationActive 
                  ? 'AI agents now control your browser directly. You will see REAL mouse movement, typing, and scrolling in this window.'
                  : 'Setting up automation agent and WebSocket connection...'
                }
              </p>
              
              {/* Real-time status indicators */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>WebSocket: {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isAutomationActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span>Automation Agent: {isAutomationActive ? 'Active' : 'Initializing'}</span>
                </div>
                {taskStatuses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Active Tasks: {taskStatuses.length}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    if (automationAgentRef.current) {
                      automationAgentRef.current.testAutomation();
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  disabled={!isAutomationActive}
                >
                  Test Automation
                </button>
                <button
                  onClick={() => {
                    if (automationAgentRef.current) {
                      automationAgentRef.current.takeScreenshot();
                    }
                  }}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  disabled={!isAutomationActive}
                >
                  Take Screenshot
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Task logs if available */}
        {allTaskLogs.size > 0 && (
          <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 max-h-20 overflow-y-auto">
            <div className="text-xs text-gray-400 mb-1">Recent Activity:</div>
            {Array.from(allTaskLogs.values()).flat().slice(-2).map((log: any, index: number) => (
              <div key={index} className="text-xs text-gray-300">
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-600">
        💡 Tip: AI agents control your browser directly - no streaming required
        {connectionStatus.isConnected && ' • WebSocket Connected'}
      </div>
    </div>
  );
}