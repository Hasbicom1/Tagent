import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Play, Bot, Monitor, CreditCard, ArrowRight, Terminal, Zap } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="container mx-auto px-4 py-16 relative z-10">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="animate-fade-in-up">
            <Badge variant="outline" className="mb-6 px-4 py-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all duration-300">
              <Terminal className="w-4 h-4 mr-2 animate-pulse" />
              PHOENIX-7742 Agent System
            </Badge>
          </div>
          
          <div className="animate-fade-in-up delay-200">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-blue-500 to-primary/60 bg-clip-text text-transparent animate-gradient">
              AI Browser Agent
            </h1>
          </div>
          
          <div className="animate-fade-in-up delay-400">
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Autonomous AI agent that controls real browsers with live visual streaming. 
              Watch your tasks execute in real-time with mouse tracking and automation.
            </p>
          </div>

          <div className="animate-fade-in-up delay-600">
            <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-500 transition-colors duration-300 group">
                <CheckCircle className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                Live Browser Control
                <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-500 transition-colors duration-300 group">
                <CheckCircle className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                Real-time VNC Streaming
                <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-500 transition-colors duration-300 group">
                <CheckCircle className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                AI-Powered Automation
                <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          </div>

          <div className="animate-fade-in-up delay-800">
            <Button 
              size="lg" 
              onClick={handleStartSession}
              disabled={isCreatingCheckout}
              className="px-8 py-6 text-lg hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 group"
              data-testid="button-start-session"
            >
              {isCreatingCheckout ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  Initializing Payment...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  Start 24-Hour Session - $1.00
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              )}
            </Button>
          </div>
          
          <div className="animate-fade-in-up delay-1000">
            <p className="text-sm text-muted-foreground mt-4">
              Secure payment via Stripe • Full refund if not satisfied
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 hover:scale-105 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group border-primary/10 hover:border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Monitor className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="text-xl font-semibold group-hover:text-primary transition-colors duration-300">Live Browser View</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
              Watch the AI agent control browsers in real-time with VNC streaming. 
              See every click, scroll, and interaction as it happens.
            </p>
          </Card>

          <Card className="p-6 hover:scale-105 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group border-primary/10 hover:border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Bot className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="text-xl font-semibold group-hover:text-primary transition-colors duration-300">AI Automation</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
              Powered by advanced AI planning and Playwright engine. 
              Handles complex multi-step tasks with precision and reliability.
            </p>
          </Card>

          <Card className="p-6 hover:scale-105 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group border-primary/10 hover:border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                <Play className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="text-xl font-semibold group-hover:text-primary transition-colors duration-300">Real-time Updates</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
              Live task progress, logs, and status updates via WebSocket. 
              Complete transparency into every automation step.
            </p>
          </Card>
        </div>

        {/* Demo Preview */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-3 group hover:scale-105 transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 relative">
                <span className="text-primary font-bold">1</span>
                <div className="absolute -right-2 -top-2 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <h4 className="font-semibold group-hover:text-primary transition-colors duration-300">Pay $1</h4>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300">Secure checkout via Stripe</p>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
            
            <div className="flex flex-col items-center gap-3 group hover:scale-105 transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 relative">
                <span className="text-primary font-bold">2</span>
                <div className="absolute -right-2 -top-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
              <h4 className="font-semibold group-hover:text-primary transition-colors duration-300">Get Access</h4>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300">24-hour agent session</p>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
            
            <div className="flex flex-col items-center gap-3 group hover:scale-105 transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 relative">
                <span className="text-primary font-bold">3</span>
                <div className="absolute -right-2 -top-2 w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
              </div>
              <h4 className="font-semibold group-hover:text-primary transition-colors duration-300">Request Tasks</h4>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300">Chat with AI agent</p>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
            
            <div className="flex flex-col items-center gap-3 group hover:scale-105 transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300 relative">
                <span className="text-primary font-bold">4</span>
                <div className="absolute -right-2 -top-2 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              </div>
              <h4 className="font-semibold group-hover:text-primary transition-colors duration-300">Watch Live</h4>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-300">Real-time browser control</p>
              <Zap className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground animate-fade-in-up delay-1200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Terminal className="w-4 h-4 animate-pulse" />
            <p className="font-mono">Powered by PHOENIX-7742 AI Agent Technology</p>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
            <span className="flex items-center gap-1 hover:text-green-500 transition-colors duration-300">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Live VNC streaming
            </span>
            <span className="flex items-center gap-1 hover:text-blue-500 transition-colors duration-300">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              Playwright automation
            </span>
            <span className="flex items-center gap-1 hover:text-purple-500 transition-colors duration-300">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              Real-time WebSocket updates
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}