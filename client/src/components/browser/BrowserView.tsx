/**
 * BrowserView Component - Live Browser Automation Viewer
 * Displays real-time VNC stream of browser automation in action
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VNCClient } from '@/components/vnc/VNCClient';
import { Monitor, Eye, Maximize2, Minimize2, RefreshCw, Zap } from 'lucide-react';

interface BrowserViewProps {
  agentId: string;
  sessionId?: string;
  isActive?: boolean;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export function BrowserView({ 
  agentId, 
  sessionId, 
  isActive = false,
  onStatusChange 
}: BrowserViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [isVNCReady, setIsVNCReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle connection status changes
  const handleStatusChange = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    setConnectionStatus(status);
    onStatusChange?.(status);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Initialize VNC when component becomes active
  useEffect(() => {
    if (isActive && agentId) {
      setIsVNCReady(true);
      handleStatusChange('connecting');
    } else {
      setIsVNCReady(false);
      handleStatusChange('disconnected');
    }
  }, [isActive, agentId]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Live Stream Active';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}
    >
      <Card className={`${isFullscreen ? 'h-full border-0 rounded-none' : 'h-[600px]'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Live Browser Automation</CardTitle>
              <Badge 
                variant="secondary" 
                className={`${getStatusColor()} text-white border-0`}
              >
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {getStatusText()}
                </div>
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-4 w-4" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4" />
                      Fullscreen
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className={`${isFullscreen ? 'h-[calc(100%-80px)]' : 'h-[520px]'} p-0`}>
          {isVNCReady ? (
            <div className="h-full w-full bg-gray-900 rounded-b-lg overflow-hidden">
              <VNCClient
                agentId={agentId}
                sessionId={sessionId || agentId}
                autoConnect={true}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-b-lg">
              <div className="text-center space-y-4">
                <Eye className="h-16 w-16 text-gray-400 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-700">
                    Browser Automation Viewer
                  </h3>
                  <p className="text-gray-500 mt-2 max-w-md">
                    When you send a browser automation request, you'll see the AI agent 
                    controlling the browser in real-time here.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="h-4 w-4" />
                  <span>Live VNC streaming • Real-time interaction • Full browser control</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fullscreen overlay controls */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleFullscreen}
            className="bg-black/50 hover:bg-black/70 text-white border-gray-600"
          >
            <Minimize2 className="h-4 w-4 mr-1" />
            Exit Fullscreen
          </Button>
        </div>
      )}
    </div>
  );
}