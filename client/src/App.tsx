import { useState, useEffect } from 'react';
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LandingPage } from "@/components/landing/LandingPage";
import { AgentInterface } from "@/components/agent/AgentInterface";
import { PaymentSuccess } from "@/components/payment/PaymentSuccess";
import { PaymentFlow } from "@/components/payment/PaymentFlow";
import { BrowserInterface } from "@/components/browser/BrowserInterface";
import NotFound from "@/pages/not-found";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Component to handle successful Stripe Checkout return
function CheckoutSuccess() {
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    agentId: string;
    expiresAt: Date;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleCheckoutSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const checkoutSessionId = urlParams.get('session_id');
      
      if (!checkoutSessionId) {
        console.error('No session_id in URL');
        toast({
          title: "Payment Error",
          description: "Invalid payment session. Please try again.",
          variant: "destructive",
        });
        // Redirect to home after error
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }

      try {
        // Get CSRF token first
        const csrfResponse = await apiRequest('GET', '/api/csrf-token');
        const { csrfToken } = await csrfResponse.json();
        
        // Process the successful checkout with CSRF token
        const response = await apiRequest('POST', '/api/checkout-success', {
          sessionId: checkoutSessionId,
          csrfToken: csrfToken
        });

        const data = await response.json();
        
        setSessionData({
          sessionId: data.sessionId, // This is the database session ID
          agentId: data.agentId,     // This is the agent ID for browser interface
          expiresAt: new Date(data.expiresAt)
        });
        
        setShowSuccess(true);
        
        toast({
          title: "Payment Successful!",
          description: "Your agent session is now active.",
        });
        
      } catch (error: any) {
        console.error('Error processing checkout success:', error);
        toast({
          title: "Payment Error",
          description: error.message || "Failed to activate agent session.",
          variant: "destructive",
        });
        // Redirect to home after error
        setTimeout(() => window.location.href = '/', 3000);
      } finally {
        setIsLoading(false);
      }
    };

    handleCheckoutSuccess();
  }, [toast]);

  const handleEnterAgent = () => {
    if (sessionData) {
      // Use URL-based navigation to agent interface
      window.location.href = `/agent?id=${sessionData.agentId}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-lg font-mono">PROCESSING_PAYMENT...</div>
            <div className="text-sm text-muted-foreground">Activating your agent session</div>
          </div>
        </Card>
      </div>
    );
  }

  if (showSuccess && sessionData) {
    return (
      <div>
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <PaymentSuccess
          sessionId={sessionData.sessionId}
          agentId={sessionData.agentId}
          expiresAt={sessionData.expiresAt}
          onEnterAgent={handleEnterAgent}
        />
      </div>
    );
  }

  // Error state - will redirect to home
  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
      <Card className="max-w-md w-full p-8">
        <div className="text-center space-y-4">
          <div className="text-lg font-mono text-destructive">PAYMENT_ERROR</div>
          <div className="text-sm text-muted-foreground">Redirecting to homepage...</div>
        </div>
      </Card>
    </div>
  );
}

// Component to handle agent interface access
function AgentAccess() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const agentId = urlParams.get('id');
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (agentId) {
      // Get session info to calculate time remaining
      const fetchSessionInfo = async () => {
        try {
          const response = await fetch(`/api/session/${agentId}`);
          const data = await response.json();
          const remaining = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000 / 60));
          setTimeRemaining(remaining);
        } catch (error) {
          console.error('Error fetching session info:', error);
        }
      };
      
      fetchSessionInfo();
    }
  }, [agentId]);

  if (!agentId) {
    return <NotFound />;
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <AgentInterface
        agentId={agentId}
        timeRemaining={timeRemaining}
      />
    </div>
  );
}

function Router() {
  const handleStartPayment = () => {
    console.log('Starting payment flow');
    // Navigate to payment page using wouter
    window.location.href = '/payment';
  };

  return (
    <Switch>
      <Route path="/success" component={CheckoutSuccess} />
      <Route path="/agent" component={AgentAccess} />
      <Route path="/browser/:sessionId" component={({ params }) => (
        <BrowserInterface sessionId={params.sessionId} />
      )} />
      <Route path="/payment" component={() => (
        <PaymentFlow onPaymentSuccess={() => {}} />
      )} />
      <Route path="/" component={() => (
        <div>
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <LandingPage onStartPayment={handleStartPayment} />
        </div>
      )} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;