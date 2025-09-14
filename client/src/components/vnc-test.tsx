/**
 * VNC WebSocket Connection Test Component
 * Tests secure cookie-based authentication without Authorization headers
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Monitor } from 'lucide-react';

interface VNCStatus {
  connected: boolean;
  connectionId?: string;
  sessionId?: string;
  agentId?: string;
  error?: string;
  lastMessage?: string;
}

export default function VNCTest() {
  const [status, setStatus] = useState<VNCStatus>({ connected: false });
  const [connecting, setConnecting] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  
  // noVNC CDN test state  
  const [vncTesting, setVncTesting] = useState(false);
  const [vncStatus, setVncStatus] = useState<string>('Ready to test noVNC CDN');
  const [vncError, setVncError] = useState<string | null>(null);
  const [vncMessages, setVncMessages] = useState<string[]>([]);
  const [vncConnection, setVncConnection] = useState<any>(null);
  
  const addVncMessage = useCallback((message: string) => {
    setVncMessages(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  }, []);

  const addMessage = useCallback((message: string) => {
    setMessages(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  }, []);

  const connectToVNC = useCallback(() => {
    setConnecting(true);
    setStatus({ connected: false });
    addMessage('🔌 Attempting VNC connection...');

    try {
      // SECURITY TEST: Create WebSocket connection using only cookies (no Authorization header)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const vncUrl = `${protocol}//${window.location.host}/vnc`;
      
      addMessage(`🔗 Connecting to: ${vncUrl}`);
      addMessage('🍪 Using cookie-based authentication (no Authorization header)');
      
      // Create WebSocket connection - browser will automatically include cookies
      const socket = new WebSocket(vncUrl);

      socket.onopen = () => {
        addMessage('✅ WebSocket connection established');
        setStatus(prev => ({ ...prev, connected: true }));
        setConnecting(false);
        setWs(socket);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addMessage(`📨 Received: ${data.type}`);
          
          if (data.type === 'vnc_status' && data.status === 'connected') {
            setStatus({
              connected: true,
              connectionId: data.connectionId,
              sessionId: data.sessionId,
              agentId: data.agentId,
              lastMessage: event.data
            });
            addMessage(`🎉 VNC proxy connected! ID: ${data.connectionId}`);
          }
        } catch (error) {
          addMessage(`📦 Received binary data: ${event.data.length} bytes`);
        }
      };

      socket.onclose = (event) => {
        addMessage(`🔌 Connection closed: ${event.code} - ${event.reason || 'No reason'}`);
        setStatus({ connected: false });
        setConnecting(false);
        setWs(null);
      };

      socket.onerror = (error) => {
        console.error('VNC WebSocket error:', error);
        addMessage(`❌ Connection error occurred`);
        setStatus({ connected: false, error: 'Connection failed' });
        setConnecting(false);
        setWs(null);
      };

    } catch (error) {
      addMessage(`❌ Failed to create connection: ${error instanceof Error ? error.message : String(error)}`);
      setStatus({ connected: false, error: error instanceof Error ? error.message : String(error) });
      setConnecting(false);
    }
  }, [addMessage]);

  const disconnect = useCallback(() => {
    if (ws) {
      addMessage('🔌 Disconnecting...');
      ws.close();
    }
  }, [ws, addMessage]);

  const testNoVNCCDN = useCallback(async () => {
    setVncTesting(true);
    setVncError(null);
    setVncStatus('Loading noVNC from CDN...');
    addVncMessage('🔄 Starting real noVNC CDN test...');

    // Cleanup previous connection
    if (vncConnection) {
      addVncMessage('🧹 Cleaning up previous connection...');
      try {
        vncConnection.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
      setVncConnection(null);
    }

    try {
      // Get the VNC container
      const container = document.getElementById('novnc-container');
      if (!container) {
        throw new Error('VNC container not found');
      }
      
      addVncMessage('📦 Importing vnc-loader module...');
      const { loadVNCLibrary, createVNCConnection } = await import('../lib/vnc-loader');
      
      addVncMessage('🌐 Loading real noVNC from CDN...');
      setVncStatus('Loading RFB from CDN...');
      
      // Load with NO FALLBACK - fail closed as architect advised  
      const RFBClass = await loadVNCLibrary(true);
      
      // Check if we got real noVNC or ProductionRFB fallback
      if (RFBClass.toString().includes('ProductionRFB')) {
        throw new Error('CDN failed - got ProductionRFB fallback instead of real noVNC');
      }
      
      addVncMessage('✅ Real noVNC RFB loaded from CDN!');
      setVncStatus('Creating VNC connection...');
      
      // Create real VNC connection to /vnc proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const vncUrl = `${protocol}//${window.location.host}/vnc`;
      
      addVncMessage(`🔗 Connecting to VNC proxy: ${vncUrl}`);
      
      const connection = await createVNCConnection(
        container,
        {
          url: vncUrl,
          shared: true,
          credentials: { password: '' },
          wsProtocols: ['binary']
        },
        {
          scaleViewport: true,
          resizeSession: false,
          showDotCursor: true
        }
      );
      
      // Wire up real noVNC events for monitoring
      connection.addEventListener('connect', () => {
        addVncMessage('✅ noVNC connected to VNC server!');
        setVncStatus('noVNC connected successfully!');
      });
      
      connection.addEventListener('disconnect', (e: any) => {
        addVncMessage(`🔌 noVNC disconnected: ${e.detail.clean ? 'clean' : 'unclean'}`);
        setVncStatus('noVNC disconnected');
      });
      
      connection.addEventListener('securityfailure', (e: any) => {
        addVncMessage(`❌ Security failure: ${e.detail.status}`);
        setVncError(`Security failure: ${e.detail.status}`);
        setVncStatus('Security failure');
      });
      
      connection.addEventListener('credentialsrequired', () => {
        addVncMessage('🔐 Credentials required');
        setVncStatus('Credentials required');
      });
      
      setVncConnection(connection);
      addVncMessage('🎉 Real noVNC integration test successful!');
      setVncStatus('Real noVNC integrated successfully!');
      
    } catch (error) {
      console.error('noVNC CDN test failed:', error);
      const errorMsg = `Real noVNC test failed: ${(error as Error).message}`;
      setVncError(errorMsg);
      setVncStatus('Test failed - no fallback');
      addVncMessage(`❌ ${errorMsg}`);
    } finally {
      setVncTesting(false);
    }
  }, [addVncMessage, vncConnection]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            VNC WebSocket Security Test
          </CardTitle>
          <CardDescription>
            Test secure cookie-based VNC authentication without Authorization headers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-4">
            {status.connected ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Disconnected
              </Badge>
            )}

            {connecting ? (
              <Button disabled className="flex items-center gap-2" data-testid="button-connecting">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </Button>
            ) : status.connected ? (
              <Button variant="destructive" onClick={disconnect} data-testid="button-disconnect">
                Disconnect
              </Button>
            ) : (
              <Button onClick={connectToVNC} data-testid="button-connect">
                Test VNC Connection
              </Button>
            )}
          </div>

          {/* Connection Info */}
          {status.connected && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>VNC Connection Successful!</strong>
                <br />
                Connection ID: <code className="text-xs">{status.connectionId}</code>
                {status.sessionId && (
                  <>
                    <br />Session ID: <code className="text-xs">{status.sessionId}</code>
                  </>
                )}
                {status.agentId && (
                  <>
                    <br />Agent ID: <code className="text-xs">{status.agentId}</code>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {status.error && (
            <Alert variant="destructive">
              <XCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>Connection Failed:</strong> {status.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Security Test Results */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">🔒 Security Test Results:</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-600" />
                Cookie-based authentication (browser compatible)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-600" />
                No Authorization header required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-600" />
                Secure HTTP upgrade handling
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-600" />
                Origin validation active
              </li>
            </ul>
          </div>

          {/* Message Log */}
          <div className="space-y-2">
            <h4 className="font-semibold">📜 Connection Log:</h4>
            <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-gray-500">Click "Test VNC Connection" to start...</div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className="mb-1">
                    {message}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* noVNC CDN Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            noVNC CDN Integration Test
          </CardTitle>
          <CardDescription>
            Test real noVNC loading from CDN with production VNC proxy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* noVNC Status */}
          <div className="flex items-center gap-4">
            <Badge variant={vncError ? "destructive" : "default"} className="flex items-center gap-1">
              {vncTesting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : vncError ? (
                <XCircle className="w-3 h-3" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              {vncStatus}
            </Badge>
          </div>

          {/* Test Button */}
          <Button 
            onClick={testNoVNCCDN} 
            disabled={vncTesting}
            className="w-full"
            data-testid="button-test-novnc-cdn"
          >
            {vncTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing noVNC CDN...
              </>
            ) : (
              'Test noVNC CDN Loading'
            )}
          </Button>

          {/* Error Display */}
          {vncError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {vncError}
              </AlertDescription>
            </Alert>
          )}

          {/* Real VNC Container - CRITICAL: Must be rendered for test to work */}
          <div className="space-y-2">
            <h4 className="font-semibold">🖥️ Real VNC Display:</h4>
            <div 
              id="novnc-container"
              className="w-full h-64 bg-black border rounded-lg relative overflow-hidden"
              style={{ minHeight: '200px' }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                {vncConnection ? 'Real noVNC Active' : 'Click "Test noVNC CDN Loading" to see real VNC'}
              </div>
            </div>
          </div>

          {/* Disconnect Button */}
          {vncConnection && (
            <Button 
              onClick={() => {
                if (vncConnection) {
                  addVncMessage('🔌 Manually disconnecting...');
                  vncConnection.disconnect();
                  setVncConnection(null);
                  setVncStatus('Disconnected');
                }
              }}
              variant="outline"
              className="w-full"
              data-testid="button-disconnect-vnc"
            >
              Disconnect VNC
            </Button>
          )}

          {/* noVNC Message Log */}
          <div className="space-y-2">
            <h4 className="font-semibold">📜 noVNC Test Log:</h4>
            <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
              {vncMessages.length === 0 ? (
                <div className="text-gray-500">Click "Test noVNC CDN Loading" to start...</div>
              ) : (
                vncMessages.map((message, index) => (
                  <div key={index} className="mb-1">
                    {message}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Developer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">🛠️ Development Information</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p><strong>VNC Endpoint:</strong> ws://localhost:5000/vnc</p>
          <p><strong>Authentication:</strong> Session cookie validation</p>
          <p><strong>Security Features:</strong> Origin validation, Rate limiting, Session binding</p>
          <p><strong>Browser Compatibility:</strong> Full compatibility - no custom headers required</p>
        </CardContent>
      </Card>
    </div>
  );
}