// client/src/pages/success.tsx

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function SuccessPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    agentId: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    const handleCheckoutSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');

      if (!sessionId) {
        setError('No session ID found in URL');
        setStatus('error');
        return;
      }

      console.log('💳 Processing checkout success for session:', sessionId);

      try {
        // Call backend to process checkout
        const response = await fetch('/api/checkout-success', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.token) {
          // Store all session data in localStorage
          localStorage.setItem('agent_session', data.sessionId);
          localStorage.setItem('agent_token', data.token);
          localStorage.setItem('agent_id', data.agentId);
          localStorage.setItem('agent_expires_at', data.expiresAt);

          console.log('✅ Session data stored:', {
            sessionId: data.sessionId,
            agentId: data.agentId,
            hasToken: !!data.token,
            expiresAt: data.expiresAt
          });

          setSessionData({
            sessionId: data.sessionId,
            agentId: data.agentId,
            expiresAt: data.expiresAt
          });

          setStatus('success');

          // Auto-redirect after 2 seconds
          setTimeout(() => {
            navigate(`/live/agent/${data.sessionId}`);
          }, 2000);

        } else {
          throw new Error(data.error || 'Failed to process checkout');
        }

      } catch (error) {
        console.error('❌ Error processing checkout:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setStatus('error');
      }
    };

    handleCheckoutSuccess();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Processing Payment</CardTitle>
              <CardDescription>
                Setting up your AI agent session...
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-600">
                Payment Successful!
              </CardTitle>
              <CardDescription>
                Your AI agent is ready to go
              </CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">
                Something Went Wrong
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'success' && sessionData && (
            <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Agent ID:</span>
                  <span className="font-mono font-semibold">{sessionData.agentId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Session Expires:</span>
                  <span className="font-semibold">
                    {new Date(sessionData.expiresAt).toLocaleDateString()} at{' '}
                    {new Date(sessionData.expiresAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Redirecting to your agent in a moment...
                </p>
                <Button
                  onClick={() => navigate(`/live/agent/${sessionData.sessionId}`)}
                  className="w-full"
                >
                  Go to Agent Now
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Button
                onClick={() => window.location.href = '/'}
                className="w-full"
                variant="outline"
              >
                Return to Home
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Please wait while we set up your session...
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Verifying payment</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Creating agent session</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                  <span>Initializing AI agent</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}