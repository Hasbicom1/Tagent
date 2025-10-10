import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeTaskStatus } from '@/hooks/use-realtime-task-status';
import { Loader2, WifiOff, CheckCircle, XCircle, MousePointer, Keyboard, ScrollText, Bot } from 'lucide-react';
import { BrowserStreamViewer } from './BrowserStreamViewer';

interface RealBrowserAutomationProps {
  sessionId: string;
  agentId?: string;
  workerUrl?: string;
}

export function RealBrowserAutomation({
  sessionId,
  agentId,
  workerUrl = 'https://worker-production-6480.up.railway.app'
}: RealBrowserAutomationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<string>('Initializing...');
  const [currentTask, setCurrentTask] = useState<string>('');
  const [agentActivity, setAgentActivity] = useState<any[]>([]);
  const automationAgentRef = useRef<any>(null);

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
    console.log('[REAL_BROWSER] Session ID:', sessionId);
    console.log('[REAL_BROWSER] Agent ID:', agentId);

    initializeRealBrowserAutomation();

    if (agentId) {
      connectWebSocket();
    }

    setIsLoading(false);
  }, [sessionId, agentId, workerUrl]);

  const initializeRealBrowserAutomation = async () => {
    try {
      // Dynamically import and initialize the REAL browser automation agent
      const { default: liveBrowserAgent, LiveBrowserAgent } = await import('@/core/live-browser-agent.js');

      if (!automationAgentRef.current) {
        automationAgentRef.current = liveBrowserAgent;

        // Set up session data for REAL automation
        const sessionData = {
          sessionId,
          agentId,
          workerUrl
        };

        await automationAgentRef.current.startSession(sessionData);
        setIsAgentActive(true);
        setAutomationStatus('REAL browser automation active');

        console.log('✅ [REAL_BROWSER] REAL browser automation initialized');
      }
    } catch (error) {
      console.error('❌ [REAL_BROWSER] Failed to initialize REAL browser automation:', error);
      setError(`Failed to initialize REAL browser automation: ${error}`);
    }
  };

  // Handle REAL agent actions in real-time
  const handleRealAgentAction = (action: any) => {
    console.log('🤖 [REAL_BROWSER] REAL Agent action:', action);
    
    // Update UI with REAL agent activity
    setCurrentTask(action.description || action.type || 'Processing...');
    setAgentActivity(prev => [...prev.slice(-9), {
      id: Date.now(),
      type: action.type,
      description: action.description,
      timestamp: new Date().toISOString(),
      status: 'executing'
    }]);

    // Show visual feedback for REAL actions
    if (action.type === 'click') {
      setAutomationStatus('🖱️ Clicking element...');
    } else if (action.type === 'type') {
      setAutomationStatus('⌨️ Typing text...');
    } else if (action.type === 'scroll') {
      setAutomationStatus('📜 Scrolling page...');
    } else if (action.type === 'navigate') {
      setAutomationStatus('🌐 Navigating to page...');
    } else {
      setAutomationStatus('🤖 AI agent working...');
    }
  };

  // Connect to REAL AI agents
  const connectToRealAgents = async () => {
    try {
      setAutomationStatus('Connecting to REAL AI agents...');
      
      // Connect to the worker with REAL AI agents
      const response = await fetch(`${workerUrl}/connect-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          agentId,
          agentTypes: ['browser-use', 'skyvern', 'lavague', 'stagehand']
        })
      });

      if (response.ok) {
        setAutomationStatus('✅ Connected to REAL AI agents');
        setIsAgentActive(true);
      } else {
        throw new Error('Failed to connect to REAL AI agents');
      }
    } catch (error) {
      console.error('❌ Failed to connect to REAL AI agents:', error);
      setError(`Failed to connect to REAL AI agents: ${error}`);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-950 text-white p-8">
        <div className="text-red-500 text-6xl mb-4">
          <XCircle size={64} />
        </div>
        <h3 className="text-xl font-semibold mb-2">REAL Browser Automation Error</h3>
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
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-950 text-white p-8">
        <Loader2 className="animate-spin w-12 h-12 text-blue-500 mb-4" />
        <p className="text-lg">Initializing REAL browser automation...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-950 flex flex-col">
      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 bg-gray-800/80 backdrop-blur-sm text-white text-xs p-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-green-500" />
          <span className="font-bold">REAL AI Agent:</span> {agentId || 'N/A'}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>WebSocket: {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAgentActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span>REAL Agent: {isAgentActive ? 'Active' : 'Initializing'}</span>
        </div>
      </div>

      {/* Live Browser Stream */}
      <div className="flex-1">
        <BrowserStreamViewer 
          sessionId={sessionId}
          agentId={agentId}
          workerUrl={workerUrl}
        />
      </div>
    </div>
  );
}
