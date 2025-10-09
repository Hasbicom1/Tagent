/**
 * LIVE BROWSER VIEW - REAL BROWSER AUTOMATION
 * 
 * Shows an actual browser window where AI agents can be seen:
 * - Moving mouse cursor
 * - Typing text
 * - Scrolling pages
 * - Clicking elements
 * - Navigating websites
 */

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeTaskStatus } from '@/hooks/use-realtime-task-status';

interface LiveBrowserViewProps {
  sessionId: string;
  agentId?: string;
  workerUrl?: string;
}

export function LiveBrowserView({ 
  sessionId,
  agentId,
  workerUrl = 'https://worker-production-6480.up.railway.app' 
}: LiveBrowserViewProps) {
  const [currentUrl, setCurrentUrl] = useState('https://google.com');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [agentActions, setAgentActions] = useState<string[]>([]);
  const browserFrameRef = useRef<HTMLIFrameElement>(null);
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
    console.log('[LIVE_BROWSER] Initializing live browser view');
    console.log('[LIVE_BROWSER] Session ID:', sessionId);
    console.log('[LIVE_BROWSER] Agent ID:', agentId);
    
    // Initialize live browser automation
    initializeLiveBrowser();
    
    // Connect to WebSocket for real-time automation commands
    if (agentId) {
      connectWebSocket();
    }
    
    setIsLoading(false);
  }, [sessionId, agentId, workerUrl]);

  const initializeLiveBrowser = async () => {
    try {
      // Dynamically import and initialize the live browser agent
      const { default: LiveBrowserAgent } = await import('@/core/live-browser-agent.js');
      
      if (!automationAgentRef.current) {
        automationAgentRef.current = LiveBrowserAgent;
        
        // Set up session data
        const sessionData = {
          sessionId,
          agentId,
          workerUrl
        };
        
        await automationAgentRef.current.startSession(sessionData);
        setIsAgentActive(true);
        
        console.log('✅ [LIVE_BROWSER] Live browser automation initialized');
      }
    } catch (error) {
      console.error('❌ [LIVE_BROWSER] Failed to initialize live browser:', error);
      setError(`Failed to initialize live browser: ${error}`);
    }
  };

  // Handle agent actions in real-time
  const handleAgentAction = (action: any) => {
    console.log('🤖 [LIVE_BROWSER] Agent action:', action);
    
    // Add action to the log
    setAgentActions(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${action.description || action.action}`]);
    
    // Execute the action in the browser
    if (automationAgentRef.current) {
      automationAgentRef.current.executeCommand(action);
    }
  };

  // Listen for automation commands
  useEffect(() => {
    if (automationAgentRef.current) {
      // Listen for automation commands from server
      automationAgentRef.current.on('automation:command', handleAgentAction);
      automationAgentRef.current.on('automation:batch', (commands: any[]) => {
        commands.forEach(handleAgentAction);
      });
    }
  }, [automationAgentRef.current]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white p-8">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold mb-2">Browser Error</h3>
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
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white p-8">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
        <h3 className="text-xl font-semibold mb-2">Initializing Live Browser</h3>
        <p className="text-gray-400 text-center">Setting up AI agent browser control...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col">
      {/* Browser Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        
        <div className="flex-1 bg-gray-700 rounded-lg px-3 py-1 text-sm text-gray-300">
          {currentUrl}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-400">
            {isAgentActive ? 'AI Agent Active' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Live Browser Frame */}
      <div className="flex-1 relative">
        <iframe
          ref={browserFrameRef}
          src={currentUrl}
          className="w-full h-full border-0"
          title="Live Browser - AI Agent Control"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
        
        {/* Agent Action Overlay */}
        {isAgentActive && (
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 max-w-sm">
            <div className="text-green-400 text-sm font-mono mb-2">🤖 AI Agent Actions</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {agentActions.slice(-5).map((action, index) => (
                <div key={index} className="text-xs text-gray-300">
                  {action}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Agent Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 p-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isAgentActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-gray-300">
              {isAgentActive ? 'AI Agent Ready' : 'Initializing...'}
            </span>
          </div>
          
          {taskStatuses.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-300">
                {taskStatuses.length} Active Task{taskStatuses.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        <div className="text-gray-400">
          Session: {sessionId.slice(0, 8)}...
        </div>
      </div>
    </div>
  );
}
