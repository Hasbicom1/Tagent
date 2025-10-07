/**
 * LIVE BROWSER STREAM VIEWER
 * 
 * Receives screenshot stream via WebSocket from the CDP-based worker
 * No VNC, no noVNC library needed - just pure WebSocket + images
 */

import { useEffect, useRef, useState } from 'react';

interface BrowserStreamViewerProps {
  sessionId: string;
  workerUrl?: string;
}

export function BrowserStreamViewer({ sessionId, workerUrl = 'ws://worker-production-6480.up.railway.app' }: BrowserStreamViewerProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement>(new Image());
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });

  useEffect(() => {
    if (!sessionId) return;

    console.log('[BROWSER_STREAM] Connecting to session:', sessionId);
    setConnectionStatus('connecting');

    // Construct WebSocket URL
    const wsUrl = `${workerUrl}/browser-stream?sessionId=${sessionId}`;
    console.log('[BROWSER_STREAM] WebSocket URL:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[BROWSER_STREAM] Connected');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'screenshot') {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Load base64 image
          imgRef.current.onload = () => {
            // Resize canvas to match image
            canvas.width = imgRef.current.width;
            canvas.height = imgRef.current.height;
            
            // Draw image
            ctx.drawImage(imgRef.current, 0, 0);
            
            // Update stats
            setLastUpdate(data.timestamp);
            
            // Calculate FPS
            const now = Date.now();
            fpsCounterRef.current.frames++;
            if (now - fpsCounterRef.current.lastTime >= 1000) {
              setFps(fpsCounterRef.current.frames);
              fpsCounterRef.current.frames = 0;
              fpsCounterRef.current.lastTime = now;
            }
          };

          imgRef.current.src = `data:image/jpeg;base64,${data.data}`;
        }
      } catch (error) {
        console.error('[BROWSER_STREAM] Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[BROWSER_STREAM] WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      console.log('[BROWSER_STREAM] Disconnected');
      setConnectionStatus('disconnected');
    };

    // Cleanup
    return () => {
      console.log('[BROWSER_STREAM] Cleaning up connection');
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId, workerUrl]);

  return (
    <div className="browser-stream-viewer flex flex-col w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            connectionStatus === 'disconnected' ? 'bg-gray-500' :
            'bg-red-500'
          }`} />
          <span className="text-sm font-medium text-gray-200">
            {connectionStatus === 'connected' ? 'Live' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             connectionStatus === 'disconnected' ? 'Disconnected' :
             'Connection Error'}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{fps} FPS</span>
          {lastUpdate > 0 && (
            <span>
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 p-4 overflow-auto">
        {connectionStatus === 'connecting' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting to browser session...</p>
          </div>
        )}
        
        {connectionStatus === 'error' && (
          <div className="text-center">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-red-400">Connection failed</p>
            <p className="text-gray-500 text-sm mt-2">Check worker service status</p>
          </div>
        )}
        
        {connectionStatus === 'disconnected' && lastUpdate === 0 && (
          <div className="text-center">
            <p className="text-gray-400">Disconnected</p>
            <p className="text-gray-500 text-sm mt-2">Session ended</p>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full shadow-2xl ${
            connectionStatus !== 'connected' && 'hidden'
          }`}
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        Session: {sessionId.substring(0, 16)}...
      </div>
    </div>
  );
}

