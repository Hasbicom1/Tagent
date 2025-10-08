/**
 * LIVE BROWSER VNC VIEWER
 * 
 * Embeds noVNC web client to show real-time browser with mouse & keyboard
 * Worker runs Xvfb + x11vnc + noVNC (port 6080) + Python worker
 */

import { useEffect, useState } from 'react';

interface BrowserStreamViewerProps {
  sessionId: string;
  workerUrl?: string;
}

export function BrowserStreamViewer({ 
  sessionId, 
  workerUrl = 'https://worker-production-6480.up.railway.app' 
}: BrowserStreamViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Construct noVNC URL
  // Worker exposes noVNC internally on port 6080, but Railway exposes it on main port (8080)
  const baseUrl = workerUrl.replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '');
  // Use worker-hosted noVNC plus WS proxy path so the WS tunnel stays on port 8080
  const vncUrl = `https://${baseUrl}/vnc.html?autoconnect=true&resize=scale&path=/websockify`;

  useEffect(() => {
    console.log('[VNC_VIEWER] Session ID:', sessionId);
    console.log('[VNC_VIEWER] noVNC URL:', vncUrl);
    
    // Reset states
    setIsLoading(true);
    setError(null);

    // Check if worker is accessible
    const workerHealthUrl = `https://${baseUrl}/health`;
    fetch(workerHealthUrl, { method: 'GET' })
      .then(res => {
        if (res.ok) {
          console.log('[VNC_VIEWER] Worker is healthy');
          setIsLoading(false);
        } else {
          throw new Error('Worker health check failed');
        }
      })
      .catch(err => {
        console.error('[VNC_VIEWER] Worker health check error:', err);
        setError('Worker service is not responding. Please wait for deployment to complete.');
        setIsLoading(false);
      });
  }, [sessionId, vncUrl, workerUrl]);

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
        <p className="text-gray-400">Connecting to live browser...</p>
        <p className="text-gray-600 text-sm mt-2">Session: {sessionId.substring(0, 16)}...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-200">Live Browser (VNC)</span>
        </div>
        <div className="text-xs text-gray-500">
          Session: {sessionId.substring(0, 16)}...
        </div>
      </div>

      {/* noVNC iframe - REAL mouse & typing visible */}
      <iframe
        src={vncUrl}
        className="flex-1 w-full border-0"
        title="Live Browser View"
        allow="clipboard-read; clipboard-write; fullscreen"
        allowFullScreen
        sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
      />

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-600">
        💡 Tip: You can interact with the browser using mouse and keyboard
      </div>
    </div>
  );
}

