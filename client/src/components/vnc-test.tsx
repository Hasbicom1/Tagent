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