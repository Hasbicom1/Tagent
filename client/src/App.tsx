import { useState, useEffect } from 'react';
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LandingPage } from "@/components/landing/LandingPage";
import { CommandTerminalInterface } from "@/components/command/CommandTerminalInterface";
import { MoveableChatToggle } from "@/components/chat/MoveableChatToggle";
import { ViralCommandInterface } from "@/components/viral/ViralCommandInterface";
import { AgentInterface } from "@/components/agent/AgentInterface";
import { PaymentSuccess } from "@/components/payment/PaymentSuccess";
import { PaymentFlow } from "@/components/payment/PaymentFlow";
import { BrowserInterface } from "@/components/browser/BrowserInterface";
import NotFound from "@/pages/not-found";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Loader2, Rocket, Sparkles, MessageCircle } from "lucide-react";

// Component to handle successful Stripe Checkout return
function CheckoutSuccess() {
  const [location, setLocation] = useLocation();
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
        setTimeout(() => setLocation('/'), 2000);
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
        setTimeout(() => setLocation('/'), 3000);
      } finally {
        setIsLoading(false);
      }
    };

    handleCheckoutSuccess();
  }, [toast]);

  const handleEnterAgent = () => {
    if (sessionData) {
      // Use wouter navigation to agent interface
      setLocation(`/agent?id=${sessionData.agentId}`);
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
  // ✅ FIX: Use window.location.search to get query parameters (wouter excludes them)
  const urlParams = new URLSearchParams(window.location.search);
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
  const [location, setLocation] = useLocation();
  const [viralCommand, setViralCommand] = useState<{command: string, data?: any} | null>(null);
  const [showViralInterface, setShowViralInterface] = useState(false);

  const handleStartPayment = () => {
    console.log('Starting payment flow');
    // Navigate to payment page using wouter
    setLocation('/payment');
  };

  const handleViralCommand = (command: string, data?: any) => {
    console.log('Viral command triggered:', command, data);

    // Handle external links directly without full-page interface
    if (command === 'open_twitter') {
      window.open('https://twitter.com/agentforall', '_blank', 'noopener,noreferrer');
      return;
    } else if (command === 'open_instagram') {
      window.open('https://instagram.com/agentforall.ai', '_blank', 'noopener,noreferrer');
      return;
    } else if (command === 'social_links') {
      // Open social media links in new tabs
      window.open('https://twitter.com/agentforall', '_blank', 'noopener,noreferrer');
      window.open('https://instagram.com/agentforall.ai', '_blank', 'noopener,noreferrer');
      return;
    } else if (command === 'share_content') {
      // Handle share content without full-page interface
      console.log('Creating shareable content');
      return;
    } else if (command === 'tell_friends') {
      // Handle tell friends without full-page interface  
      console.log('Generating referral content');
      return;
    }

    // Only show viral interface for transform commands (bet_on_*, lucky_*, etc.)
    if (!command.startsWith('bet_on_') && command !== 'lucky_dollar' && command !== 'revolution_mode') {
      console.log('Command does not require viral interface:', command);
      return;
    }

    // Only show full-page viral interface for transform commands
    setViralCommand({ command, data });
    setShowViralInterface(true);
  };

  const handleViralPayment = (method: string) => {
    console.log('Payment method selected:', method);
    if (method === 'stripe') {
      setLocation('/payment');
    } else {
      // Handle crypto payments
      console.log(`Processing ${method} payment`);
      // For now, redirect to stripe until crypto is implemented
      setLocation('/payment');
    }
  };

  const handleBackToHome = () => {
    setShowViralInterface(false);
    setViralCommand(null);
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
      <Route path="/" component={() => {
        if (showViralInterface && viralCommand) {
          return (
            <div>
              <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
              </div>
              <ViralCommandInterface 
                command={viralCommand.command}
                data={viralCommand.data}
                onBack={handleBackToHome}
                onPayment={handleViralPayment}
              />
            </div>
          );
        }
        
        return (
          <div className="min-h-screen bg-background text-foreground">
            <div className="fixed top-4 right-4 z-50">
              <ThemeToggle />
            </div>
            
            {/* Original Terminal Interface - but hidden/replaced with viral mode */}
            <div className="min-h-screen bg-background text-foreground font-mono crt-screen scanlines">
              {/* Welcome message for new users */}
              <div className="flex items-center justify-center min-h-screen p-6">
                <div className="text-center space-y-8 max-w-2xl">
                  <div className="space-y-4">
                    <Rocket className="w-16 h-16 mx-auto text-primary" />
                    <h1 className="text-4xl lg:text-6xl font-bold tracking-tight phosphor-text">
                      <span className="text-foreground">AI FOR </span>
                      <span className="text-primary text-5xl lg:text-7xl">$1</span>
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      AI dreams shouldn't cost more than a coffee
                    </p>
                  </div>
                  
                  <div className="bg-card/50 rounded border border-primary/10 p-6 space-y-4">
                    <div className="text-primary font-mono text-xl flex items-center justify-center gap-2"><Sparkles className="w-5 h-5" />Try Our Viral Commands!</div>
                    <div className="text-muted-foreground text-sm space-y-2">
                      <div>• "bet a dollar on your dog"</div>
                      <div>• "bet a dollar on your cat"</div>
                      <div>• "follow us" for social media</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
Look for the chat toggle in the corner!
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Moveable Chat Toggle */}
            <MoveableChatToggle onViralCommand={handleViralCommand} />
          </div>
        );
      }} />
      <Route path="/classic" component={() => (
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