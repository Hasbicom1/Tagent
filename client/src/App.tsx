import { useState } from 'react';
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LandingPage } from "@/components/landing/LandingPage";
import { AgentInterface } from "@/components/agent/AgentInterface";
import { PaymentSuccess } from "@/components/payment/PaymentSuccess";
import { PaymentFlow } from "@/components/payment/PaymentFlow";
import NotFound from "@/pages/not-found";

function Router() {
  const [currentView, setCurrentView] = useState<'landing' | 'payment' | 'payment-success' | 'agent'>('landing');
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    agentId: string;
    expiresAt: Date;
    timeRemaining: number;
  } | null>(null);

  const handleStartPayment = () => {
    console.log('Starting payment flow');
    setCurrentView('payment');
  };

  const handlePaymentSuccess = (data: { sessionId: string; agentId: string; expiresAt: Date }) => {
    console.log('Payment completed successfully:', data);
    const timeRemaining = Math.max(0, Math.floor((data.expiresAt.getTime() - Date.now()) / 1000 / 60));
    setSessionData({ ...data, timeRemaining });
    setCurrentView('payment-success');
  };

  const handleEnterAgent = () => {
    console.log('Entering agent interface');
    setCurrentView('agent');
  };

  // Route to payment flow
  if (currentView === 'payment') {
    return (
      <PaymentFlow onPaymentSuccess={handlePaymentSuccess} />
    );
  }

  // Route to payment success
  if (currentView === 'payment-success' && sessionData) {
    return (
      <PaymentSuccess
        sessionId={sessionData.sessionId}
        expiresAt={sessionData.expiresAt}
        onEnterAgent={handleEnterAgent}
      />
    );
  }

  // Route to agent interface
  if (currentView === 'agent' && sessionData) {
    return (
      <AgentInterface
        agentId={sessionData.agentId}
        timeRemaining={sessionData.timeRemaining}
      />
    );
  }

  return (
    <Switch>
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