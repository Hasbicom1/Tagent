/**
 * LIVE BROWSER VNC VIEWER
 * 
 * Embeds noVNC web client to show real-time browser with mouse & keyboard
 * Worker runs Xvfb + x11vnc + noVNC (port 6080) + Python worker
 */

import { useEffect, useState } from 'react';

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
  const [auth, setAuth] = useState<{ token: string; vncPassword: string } | null>(null);

  // Construct noVNC URL
  // Worker exposes noVNC internally on port 6080, but Railway exposes it on main port (8080)
  const baseUrl = workerUrl.replace(/^wss?:\/\//, '').replace(/^https?:\/\//, '');
  // Build vncUrl dynamically once we have the token
  // Pass token directly in the WebSocket path for noVNC to forward
  const vncUrl = auth
    ? `https://${baseUrl}/vnc.html?autoconnect=true&resize=scale&path=/websockify?token=${encodeURIComponent(auth.token)}&sessionId=${encodeURIComponent(sessionId)}&password=${encodeURIComponent(auth.vncPassword)}`
    : `https://${baseUrl}/vnc.html`;

  useEffect(() => {
    console.log('[VNC_VIEWER] Session ID:', sessionId);
    // Request per-session VNC token from server
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/session/${encodeURIComponent(agentId || sessionId)}/live-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrfToken: 'skip' }) // server schema allows CSRF in production; backend handles
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `VNC auth failed: ${res.status}`);
        }
        const j = await res.json();
        // Expect { vncToken, vncPassword, workerUrl? }
        if (j.workerUrl) {
          // if server provides public worker URL, override
        }
        setAuth({ token: j.vncToken, vncPassword: j.vncPassword || 'password' });
      } catch (e: any) {
        console.error('[VNC_VIEWER] Token fetch error:', e);
        setError(e.message || 'Failed to obtain VNC token');
      } finally {
        setIsLoading(false);
      }
    })();
    
    // Reset states
    setIsLoading(true);
    setError(null);

  }, [sessionId, agentId, workerUrl]);

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

