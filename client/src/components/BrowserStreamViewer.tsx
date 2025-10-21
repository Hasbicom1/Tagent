/**
 * LIVE BROWSER STREAMING VIEWER
 * 
 * VNC-BASED LIVE BROWSER STREAMING using noVNC RFB client
 * Users see actual browser automation in real-time via VNC
 */

import React, { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc/core/rfb';
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
  const vncContainerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Initializing...');
  const [isReady, setIsReady] = useState(false);

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
    console.log('[VNC_STREAM] Session ID:', sessionId);
    console.log('[VNC_STREAM] Agent ID:', agentId);
    
    // Poll session status until worker is ready
    pollSessionStatus();
    
    // Connect to WebSocket for real-time automation commands
    if (agentId) {
      connectWebSocket();
    }
    
    setIsLoading(false);

    return () => {
      // Cleanup VNC connection
      if (rfbRef.current) {
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }
    };
  }, [sessionId, agentId]);

  const pollSessionStatus = async () => {
    let pollCount = 0;
    const MAX_POLLS = 30; // 60 seconds max wait time
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/session-status?session=${sessionId}`);
        const data = await response.json();
        
        console.log(`[POLL ${pollCount}] Session status:`, data);
        setStatus(`Waiting for browser to start... (${data.status})`);
        
        if (data.status === 'ready' && data.workerReady) {
          console.log('✅ Worker is ready! Starting VNC connection...');
          setIsReady(true);
          setStatus('Connected');
          
          // NOW connect to VNC
          initializeVNCStream();
        } else if (data.status === 'error') {
          console.error('❌ Worker setup failed');
          setError('Failed to initialize AI agent. Please try again.');
          setStatus('Failed');
        } else {
          pollCount++;
          
          if (pollCount >= MAX_POLLS) {
            console.error('❌ Session not ready in time');
            setError('Timeout: Browser failed to start');
            setStatus('Timeout');
          } else {
            // Wait 2 seconds before next poll
            setTimeout(poll, 2000);
          }
        }
      } catch (err) {
        console.error('❌ Error polling session status:', err);
        setError('Failed to check session status');
        setStatus('Error');
      }
    };
    
    // Start polling
    poll();
  };

  const initializeVNCStream = () => {
    // Get JWT token from session storage
    const jwtToken = sessionStorage.getItem('websocket_token');
    
    if (!jwtToken) {
      console.error('❌ No JWT token available for VNC authentication');
      setError('Authentication token missing. Please refresh the page.');
      return;
    }

    // Connect to VNC proxy endpoint
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/vnc/${sessionId}?token=${encodeURIComponent(jwtToken)}`;
    console.log('🔌 Connecting to VNC proxy with JWT authentication:', wsUrl);
    
    const vncContainer = vncContainerRef.current;
    if (!vncContainer) {
      console.error('❌ VNC container not found');
      setError('VNC container missing');
      return;
    }

    try {
      // Create noVNC RFB client
      const rfb = new RFB(vncContainer, wsUrl, {
        credentials: { password: '' }, // No password needed for this setup
        wsProtocols: ['binary'],
        shared: true,
        scaleViewport: true,
        resizeSession: true,
        qualityLevel: 6,
        compressionLevel: 2
      });

      rfbRef.current = rfb;

      // Handle VNC connection events
      rfb.addEventListener('connect', () => {
        console.log('✅ VNC connected successfully');
        setIsConnected(true);
        setStatus('Live');
      });

      rfb.addEventListener('disconnect', (e: any) => {
        console.log('❌ VNC disconnected:', e.detail);
        setIsConnected(false);
        if (!e.detail.clean) {
          setError('Connection lost. Attempting to reconnect...');
        }
      });

      rfb.addEventListener('securityfailure', (e: any) => {
        console.error('❌ VNC security failure:', e.detail);
        setError('Authentication failed');
      });

      rfb.addEventListener('credentialsrequired', () => {
        console.error('❌ VNC credentials required');
        setError('VNC credentials required');
      });

    } catch (err) {
      console.error('❌ Failed to create VNC connection:', err);
      setError('Failed to connect to live browser');
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

  if (isLoading || !isReady) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400">{status}</p>
        <p className="text-gray-600 text-sm mt-2">Session: {sessionId.substring(0, 16)}...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-sm font-medium text-white">
            {isConnected ? '🔴 LIVE VNC' : '⚫ Offline'}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Session: {sessionId.substring(0, 16)}...
        </span>
      </div>
      
      {/* VNC Display Container */}
      <div 
        ref={vncContainerRef}
        id="vnc-container" 
        className="flex-1 relative bg-black overflow-hidden"
        style={{ width: '100%', height: '100%' }}
      >
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">🖥️</div>
              <div className="text-xl font-bold mb-2">
                Connecting to Live Browser...
              </div>
              <div className="text-gray-400">
                VNC stream will appear here
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        💡 ZERO-COST live browser via VNC (noVNC client)
      </div>
    </div>
  );
}