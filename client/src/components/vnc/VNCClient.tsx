import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  MonitorOff, 
  Maximize2, 
  Minimize2,
  RotateCcw,
  Settings,
  Wifi,
  WifiOff 
} from 'lucide-react';
import { createVNCConnection, isVNCLibraryLoaded } from '@/lib/vnc-loader';

interface VNCClientProps {
  sessionId: string;
  webSocketURL?: string;
  vncToken?: string;
  className?: string;
  onConnectionStateChange?: (connected: boolean) => void;
  autoConnect?: boolean;
}

interface VNCConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastConnectedAt?: Date;
  reconnectAttempts: number;
}

export function VNCClient({ 
  sessionId, 
  webSocketURL, 
  vncToken,
  className = '',
  onConnectionStateChange,
  autoConnect = true 
}: VNCClientProps) {
  const vncContainerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [connectionState, setConnectionState] = useState<VNCConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Connection state handler
  const updateConnectionState = (updates: Partial<VNCConnectionState>) => {
    setConnectionState(prev => {
      const newState = { ...prev, ...updates };
      onConnectionStateChange?.(newState.connected);
      return newState;
    });
  };

  // Initialize VNC connection
  const connectVNC = async () => {
    if (!webSocketURL || !vncContainerRef.current) {
      updateConnectionState({ 
        error: 'VNC connection details not available',
        connecting: false 
      });
      return;
    }

    try {
      updateConnectionState({ 
        connecting: true, 
        error: null 
      });

      // Clean up existing connection
      if (rfbRef.current) {
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }

      // Clear container
      const container = vncContainerRef.current;
      container.innerHTML = '';

      // Create VNC canvas container
      const vncCanvas = document.createElement('div');
      vncCanvas.style.width = '100%';
      vncCanvas.style.height = '100%';
      vncCanvas.style.overflow = 'hidden';
      container.appendChild(vncCanvas);

      // Build WebSocket URL with authentication
      const wsUrl = new URL(webSocketURL);
      if (vncToken) {
        wsUrl.searchParams.set('token', vncToken);
      }
      wsUrl.searchParams.set('sessionId', sessionId);

      console.log('🔌 Connecting to VNC:', wsUrl.toString());

      // Create RFB connection using the lazy loader
      const rfb = await createVNCConnection(
        vncCanvas,
        {
          url: wsUrl.toString(),
          credentials: { password: vncToken || '' },
          shared: true,
          wsProtocols: ['binary']
        },
        {
          scaleViewport: true,
          resizeSession: false,
          showDotCursor: true,
          background: '#000000'
        }
      );

      // Connection event handlers
      rfb.addEventListener('connect', () => {
        console.log('✅ VNC connected successfully');
        updateConnectionState({
          connected: true,
          connecting: false,
          error: null,
          lastConnectedAt: new Date(),
          reconnectAttempts: 0
        });
      });

      rfb.addEventListener('disconnect', (e: any) => {
        console.log('🔌 VNC disconnected:', e.detail);
        updateConnectionState({
          connected: false,
          connecting: false,
          error: e.detail.clean ? null : 'Connection lost'
        });
      });

      rfb.addEventListener('securityfailure', (e: any) => {
        console.error('🔒 VNC security failure:', e.detail);
        updateConnectionState({
          connected: false,
          connecting: false,
          error: 'Authentication failed'
        });
      });

      rfb.addEventListener('credentialsrequired', () => {
        console.log('🔑 VNC credentials required');
        updateConnectionState({
          error: 'Authentication required'
        });
      });

      rfbRef.current = rfb;

    } catch (error: any) {
      console.error('❌ VNC connection failed:', error);
      updateConnectionState({
        connected: false,
        connecting: false,
        error: error.message || 'Failed to connect to VNC'
      });
    }
  };

  // Disconnect VNC
  const disconnectVNC = () => {
    if (rfbRef.current) {
      rfbRef.current.disconnect();
      rfbRef.current = null;
    }
    updateConnectionState({
      connected: false,
      connecting: false,
      error: null
    });
  };

  // Reconnect with exponential backoff
  const reconnectVNC = async () => {
    const maxAttempts = 5;
    const baseDelay = 1000;
    
    if (connectionState.reconnectAttempts >= maxAttempts) {
      updateConnectionState({
        error: 'Max reconnection attempts reached'
      });
      return;
    }

    const delay = baseDelay * Math.pow(2, connectionState.reconnectAttempts);
    updateConnectionState({
      reconnectAttempts: connectionState.reconnectAttempts + 1
    });

    setTimeout(() => {
      connectVNC();
    }, delay);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = vncContainerRef.current?.parentElement;
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Send Ctrl+Alt+Del
  const sendCtrlAltDel = () => {
    if (rfbRef.current) {
      rfbRef.current.sendCtrlAltDel();
    }
  };

  // Auto-connect on mount or URL change
  useEffect(() => {
    if (autoConnect && webSocketURL && !connectionState.connected && !connectionState.connecting) {
      connectVNC();
    }

    return () => {
      disconnectVNC();
    };
  }, [webSocketURL, autoConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectVNC();
    };
  }, []);

  return (
    <div className={`flex flex-col h-full bg-black rounded-lg overflow-hidden ${className}`}>
      {/* VNC Controls */}
      {showControls && (
        <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Badge 
              variant={connectionState.connected ? "default" : "destructive"}
              className="text-xs"
            >
              {connectionState.connected ? (
                <><Wifi className="w-3 h-3 mr-1" /> Connected</>
              ) : connectionState.connecting ? (
                <><Wifi className="w-3 h-3 mr-1 animate-pulse" /> Connecting...</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" /> Disconnected</>
              )}
            </Badge>
            
            {connectionState.error && (
              <span className="text-xs text-red-400" data-testid="text-vnc-error">
                {connectionState.error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!connectionState.connected && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={connectVNC}
                disabled={connectionState.connecting}
                data-testid="button-vnc-connect"
              >
                <Monitor className="w-4 h-4" />
              </Button>
            )}

            {connectionState.connected && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={sendCtrlAltDel}
                  title="Send Ctrl+Alt+Del"
                  data-testid="button-vnc-ctrl-alt-del"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={disconnectVNC}
                  data-testid="button-vnc-disconnect"
                >
                  <MonitorOff className="w-4 h-4" />
                </Button>
              </>
            )}

            {connectionState.error && !connectionState.connecting && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={reconnectVNC}
                data-testid="button-vnc-reconnect"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleFullscreen}
              data-testid="button-vnc-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* VNC Display Container */}
      <div 
        ref={vncContainerRef} 
        className="flex-1 bg-black relative"
        data-testid="container-vnc-display"
      >
        {!webSocketURL && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">Browser Live View</p>
              <p className="text-sm opacity-75">
                VNC stream will appear here when agent starts browser automation
              </p>
            </div>
          </div>
        )}

        {webSocketURL && !connectionState.connected && !connectionState.connecting && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <WifiOff className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <p className="text-lg font-semibold mb-2">Connection Failed</p>
              <p className="text-sm opacity-75 mb-4">
                {connectionState.error || 'Unable to connect to browser view'}
              </p>
              <Button onClick={connectVNC} variant="outline" size="sm">
                Retry Connection
              </Button>
            </div>
          </div>
        )}

        {connectionState.connecting && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <Wifi className="w-12 h-12 mx-auto mb-4 animate-pulse" />
              <p className="text-lg font-semibold mb-2">Connecting to Browser</p>
              <p className="text-sm opacity-75">
                Establishing live view connection...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}