import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SessionData {
  sessionId: string;
  agentId: string;
  expiresAt: string;
  automationUrl?: string;
}

export default function Success() {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleCheckoutSuccess = async () => {
      try {
        // Get session_id from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutSessionId = urlParams.get('session_id');
        
        if (!checkoutSessionId) {
          throw new Error('No session ID found in URL');
        }

        // Prevent duplicate creation on refresh: reuse existing mapping
        const localKey = `activated_agent_for_checkout_${checkoutSessionId}`;
        const existingAgentId = localStorage.getItem(localKey);
        if (existingAgentId) {
          // Fast-path redirect to persistent agent session
          window.location.href = `/live/agent/${existingAgentId}`;
          return;
        }

        // Get CSRF token first (backend expects it for POST /api/checkout-success)
        const csrfResponse = await apiRequest('GET', '/api/csrf-token');
        const { csrfToken } = await csrfResponse.json();
        
        // Idempotent activation: backend guarantees one agent per Stripe checkout
        const activateResponse = await apiRequest('POST', '/api/checkout-success', {
          sessionId: checkoutSessionId,
          csrfToken
        });

        if (!activateResponse.ok) {
          const error = await activateResponse.json();
          throw new Error(error.error || 'Session activation failed');
        }

        const data = await activateResponse.json();
        const agentId = data.agentId || data.sessionId;
        const expiresAt = data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // CRITICAL FIX: Store JWT token for WebSocket authentication
        if (data.websocketToken) {
          sessionStorage.setItem('websocket_token', data.websocketToken);
          console.log('✅ JWT token stored for WebSocket authentication');
        } else {
          console.warn('⚠️ No JWT token received from backend');
        }

        // Persist mapping to prevent new session creation on any subsequent refreshes
        if (agentId) {
          localStorage.setItem(localKey, agentId);
        }

        setSessionData({
          sessionId: data.sessionId || checkoutSessionId,
          agentId,
          expiresAt
        });
        
        // NEW: Poll session status until worker is ready
        await pollSessionStatus(agentId);

      } catch (error) {
        console.error('Checkout success error:', (error as Error).message);
        setError((error as Error).message);
        
        toast({
          title: 'Session Activation Failed',
          description: (error as Error).message,
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    };

    handleCheckoutSuccess();
  }, [toast]);

  // NEW: Poll session status until worker is ready
  const pollSessionStatus = async (agentId: string) => {
    for (let i = 0; i < 30; i++) { // Poll for up to 60 seconds
      try {
        const response = await fetch(`/api/session-status?session=${agentId}`);
        const data = await response.json();
        
        console.log(`[POLL ${i}] Session status:`, data);
        
        if (data.status === 'ready' && data.workerConnected) {
          console.log('✅ Worker is ready, redirecting to agent page');
          window.location.href = `/live/agent/${agentId}`;
          return;
        } else if (data.status === 'error') {
          console.error('❌ Worker setup failed');
          toast({
            title: "Setup Error",
            description: "Failed to initialize AI agent. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Status check failed:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.error('Session not ready in time');
    toast({
      title: "Timeout",
      description: "Agent setup is taking longer than expected. Please try again.",
      variant: "destructive",
    });
  };

  const handleEnterChat = () => {
    if (sessionData?.automationUrl) {
      // Redirect to automation session
      window.location.href = sessionData.automationUrl;
    } else if (sessionData) {
      setLocation('/browser-chat');
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m remaining`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minutes remaining`;
    } else {
      return 'Session expired';
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
          <p className="text-muted-foreground">
            Verifying payment and activating your AI agent session...
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Activation Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => setLocation('/')} variant="outline">
            Return to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-muted-foreground mb-4">
            Unable to retrieve session data. Please try again.
          </p>
          <Button onClick={() => setLocation('/')} variant="outline">
            Return to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="p-8 max-w-lg mx-auto text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
        
        <h1 className="text-3xl font-bold mb-4">
          Payment Successful!
        </h1>
        
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Agent Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent ID:</span>
              <span className="font-mono font-semibold" data-testid="text-agent-id">
                {sessionData.agentId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session:</span>
              <span className="font-mono text-xs" data-testid="text-session-id">
                {sessionData.sessionId.substring(0, 12)}...
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status:</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-green-600 font-semibold" data-testid="text-time-remaining">
                  {formatTimeRemaining(sessionData.expiresAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground mb-6">
          <p>✅ Payment processed successfully via Stripe</p>
          <p>✅ AI agent activated with full browser control</p>
          <p>✅ Live VNC streaming enabled</p>
          <p>✅ Real-time task execution ready</p>
        </div>

        <Button 
          size="lg" 
          onClick={handleEnterChat}
          className="w-full"
          data-testid="button-enter-chat"
        >
          <div className="flex items-center gap-2">
            Enter AI Agent Chat
            <ArrowRight className="w-4 h-4" />
          </div>
        </Button>
        
        <p className="text-xs text-muted-foreground mt-4">
          Your session will automatically expire in 24 hours
        </p>
      </Card>
    </div>
  );
}