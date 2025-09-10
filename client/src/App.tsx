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
import NotFound from "@/pages/not-found";

// Mock data for demo purposes
const mockSession = {
  id: 'PHOENIX-7742',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  timeRemaining: 1440 // 24 hours in minutes
};

function Router() {
  const [currentView, setCurrentView] = useState<'landing' | 'payment-success' | 'agent'>('landing');

  // Mock payment flow - in real app this would be handled by Stripe
  const handlePaymentSuccess = () => {
    console.log('Payment completed - transitioning to success page');
    setCurrentView('payment-success');
  };

  const handleEnterAgent = () => {
    console.log('Entering agent interface');
    setCurrentView('agent');
  };

  // Route simulation for demo
  if (currentView === 'payment-success') {
    return (
      <PaymentSuccess
        sessionId={mockSession.id}
        expiresAt={mockSession.expiresAt}
        onEnterAgent={handleEnterAgent}
      />
    );
  }

  if (currentView === 'agent') {
    return (
      <AgentInterface
        agentId={mockSession.id}
        timeRemaining={mockSession.timeRemaining}
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
          <LandingPage />
          {/* Demo buttons for navigation */}
          <div className="fixed bottom-4 right-4 space-y-2 z-50">
            <div className="bg-background border rounded-lg p-2 space-y-2">
              <div className="text-xs text-muted-foreground font-medium">DEMO NAVIGATION:</div>
              <button 
                onClick={handlePaymentSuccess}
                className="block w-full text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90"
              >
                Simulate Payment
              </button>
              <button 
                onClick={handleEnterAgent}
                className="block w-full text-xs bg-chart-2 text-white px-2 py-1 rounded hover:bg-chart-2/90"
              >
                Skip to Agent
              </button>
            </div>
          </div>
        </div>
      )} />
      <Route path="/agent/:sessionId" component={({ params }) => (
        <AgentInterface
          agentId={params.sessionId || 'PHOENIX-7742'}
          timeRemaining={mockSession.timeRemaining}
        />
      )} />
      <Route path="/success" component={() => (
        <PaymentSuccess
          sessionId={mockSession.id}
          expiresAt={mockSession.expiresAt}
          onEnterAgent={handleEnterAgent}
        />
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