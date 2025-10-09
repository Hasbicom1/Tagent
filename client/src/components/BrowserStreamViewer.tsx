/**
 * IN-BROWSER AUTOMATION VIEWER
 * 
 * NO VNC - Direct browser control using in-browser automation
 * AI agents control the user's browser directly via JavaScript
 */

import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    console.log('[IN-BROWSER_AUTOMATION] Session ID:', sessionId);
    // No VNC - using in-browser automation instead
    setIsLoading(false);
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
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-200">In-Browser Automation</span>
        </div>
        <div className="text-xs text-gray-500">
          Session: {sessionId.substring(0, 16)}...
        </div>
      </div>

      {/* In-Browser Automation Interface */}
      <div className="flex-1 flex flex-col items-center justify-center text-white p-8">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto">
            <div className="text-4xl">🤖</div>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold">IN-BROWSER AUTOMATION ACTIVE</h3>
            <p className="text-gray-400 max-w-md">
              AI agents now control your browser directly. No VNC required - 
              all interactions happen in your current browser window.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.href = '/automation-demo'}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Try Demo
              </button>
              <button
                onClick={() => window.location.href = '/automation-test'}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Test Automation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-600">
        💡 Tip: AI agents control your browser directly - no streaming required
      </div>
    </div>
  );
}