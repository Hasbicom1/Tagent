import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Play, Bot, Monitor, CreditCard } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Landing() {
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const { toast } = useToast();

  const handleStartSession = async () => {
    try {
      setIsCreatingCheckout(true);
      
      // Get CSRF token
      const csrfResponse = await apiRequest('GET', '/api/csrf-token');
      const { csrfToken } = await csrfResponse.json();

      // Create Stripe checkout session
      const response = await apiRequest('POST', '/api/create-checkout-session', {
        csrfToken
      });

      const { checkoutUrl } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = checkoutUrl;
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Liberation Protocol Error",
        description: error.message || "Failed to initialize payment gateway",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-6 px-4 py-2">
            <Bot className="w-4 h-4 mr-2" />
            PHOENIX-7742 Agent System
          </Badge>
          
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Browser Agent
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Autonomous AI agent that controls real browsers with live visual streaming. 
            Watch your tasks execute in real-time with mouse tracking and automation.
          </p>

          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Live Browser Control
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Real-time VNC Streaming
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              AI-Powered Automation
            </div>
          </div>

          <Button 
            size="lg" 
            onClick={handleStartSession}
            disabled={isCreatingCheckout}
            className="px-8 py-6 text-lg"
            data-testid="button-start-session"
          >
            {isCreatingCheckout ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                Initializing Payment...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Start 24-Hour Session - $1.00
              </div>
            )}
          </Button>
          
          <p className="text-sm text-muted-foreground mt-4">
            Secure payment via Stripe • Full refund if not satisfied
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 hover-elevate">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-semibold">Live Browser View</h3>
            </div>
            <p className="text-muted-foreground">
              Watch the AI agent control browsers in real-time with VNC streaming. 
              See every click, scroll, and interaction as it happens.
            </p>
          </Card>

          <Card className="p-6 hover-elevate">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-semibold">AI Automation</h3>
            </div>
            <p className="text-muted-foreground">
              Powered by advanced AI planning and Playwright engine. 
              Handles complex multi-step tasks with precision and reliability.
            </p>
          </Card>

          <Card className="p-6 hover-elevate">
            <div className="flex items-center gap-3 mb-4">
              <Play className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-semibold">Real-time Updates</h3>
            </div>
            <p className="text-muted-foreground">
              Live task progress, logs, and status updates via WebSocket. 
              Complete transparency into every automation step.
            </p>
          </Card>
        </div>

        {/* Demo Preview */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">1</span>
              </div>
              <h4 className="font-semibold">Pay $1</h4>
              <p className="text-sm text-muted-foreground">Secure checkout via Stripe</p>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">2</span>
              </div>
              <h4 className="font-semibold">Get Access</h4>
              <p className="text-sm text-muted-foreground">24-hour agent session</p>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">3</span>
              </div>
              <h4 className="font-semibold">Request Tasks</h4>
              <p className="text-sm text-muted-foreground">Chat with AI agent</p>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">4</span>
              </div>
              <h4 className="font-semibold">Watch Live</h4>
              <p className="text-sm text-muted-foreground">Real-time browser control</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Powered by PHOENIX-7742 AI Agent Technology</p>
          <p className="mt-2">
            Live VNC streaming • Playwright automation • Real-time WebSocket updates
          </p>
        </div>
      </div>
    </div>
  );
}