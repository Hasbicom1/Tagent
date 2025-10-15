/**
 * LIVE BROWSER STREAMING VIEWER
 * 
 * REAL LIVE BROWSER STREAMING using Playwright CDP
 * Users see actual browser automation in real-time
 */

import React, { useEffect, useRef, useState } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [fps, setFps] = useState(0);
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
    console.log('[LIVE_STREAM] Session ID:', sessionId);
    console.log('[LIVE_STREAM] Agent ID:', agentId);
    
    // CRITICAL FIX: Poll session status until worker is ready
    pollSessionStatus();
    
    // Connect to WebSocket for real-time automation commands
    if (agentId) {
      connectWebSocket();
    }
    
    setIsLoading(false);
  }, [sessionId, agentId, workerUrl]);

  // CRITICAL FIX: Poll session status until worker is ready
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
          console.log('✅ Worker is ready! Starting WebSocket connection...');
          setIsReady(true);
          setStatus('Connected');
          
          // NOW connect WebSocket
          initializeLiveStream();
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

  const initializeLiveStream = () => {
    // Get JWT token from session storage
    const jwtToken = sessionStorage.getItem('websocket_token');
    
    if (!jwtToken) {
      console.error('❌ No JWT token available for WebSocket authentication');
      setError('Authentication token missing. Please refresh the page.');
      return;
    }

    // Connect to backend WebSocket for live stream WITH JWT token
    // Use current host and protocol to avoid hardcoded production domain
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/view/${sessionId}?token=${encodeURIComponent(jwtToken)}`;
    console.log('🔌 Connecting to WebSocket with JWT authentication...');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    let frameCount = 0;
    let lastTime = Date.now();
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected with JWT authentication');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        console.log('📸 Frame received:', { type: frame.type, hasData: !!frame.data, sessionId: frame.sessionId });
        
        if (frame.type === 'frame' && frame.data) {
          // Render frame on canvas
          const canvas = canvasRef.current;
          if (!canvas) {
            console.warn('⚠️ Canvas not available');
            return;
          }
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('⚠️ Canvas context not available');
            return;
          }
          
          // Create image from Base64 JPEG
          const img = new Image();
          img.onload = () => {
            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw frame
            ctx.drawImage(img, 0, 0);
            console.log('✅ Frame rendered on canvas');
            
            // Calculate FPS
            frameCount++;
            const now = Date.now();
            if (now - lastTime >= 1000) {
              setFps(frameCount);
              frameCount = 0;
              lastTime = now;
            }
          };
          
          img.onerror = (error) => {
            console.error('❌ Failed to load image:', error);
          };
          
          img.src = `data:image/jpeg;base64,${frame.data}`;
        } else {
          console.log('📨 Non-frame message received:', frame);
        }
        
      } catch (err) {
        console.error('❌ Frame render error:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('❌ Disconnected from live stream');
      setIsConnected(false);
    };
    
    return () => {
      ws.close();
    };
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
            {isConnected ? '🔴 LIVE' : '⚫ Offline'}
          </span>
          <span className="text-xs text-gray-400">{fps} FPS</span>
        </div>
        <span className="text-xs text-gray-500">
          Session: {sessionId.substring(0, 16)}...
        </span>
      </div>
      
      {/* Live Browser Canvas */}
      <div className="flex-1 relative bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'auto' }}
        />
        
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">📺</div>
              <div className="text-xl font-bold mb-2">
                Connecting to Live Browser...
              </div>
              <div className="text-gray-400">
                AI agents will appear here
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        💡 100% FREE live browser streaming powered by Playwright CDP
      </div>
    </div>
  );
}