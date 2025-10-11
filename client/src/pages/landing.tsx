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
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/3 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/3 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="container mx-auto px-6 py-20 relative z-10 max-w-7xl">
        
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="animate-fade-in-up">
            <Badge variant="outline" className="mb-8 px-6 py-3 border-primary/30 bg-primary/10 hover:bg-primary/15 transition-all duration-500 text-sm font-medium">
              <Terminal className="w-4 h-4 mr-2" />
              PHOENIX-7742 Agent System
            </Badge>
          </div>
          
          <div className="animate-fade-in-up delay-200">
            <h1 className="text-7xl font-bold mb-8 bg-gradient-to-r from-primary via-blue-500 to-primary/60 bg-clip-text text-transparent animate-gradient leading-tight">
              AI Browser Agent
            </h1>
          </div>
          
          <div className="animate-fade-in-up delay-400">
            <p className="text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              Autonomous AI agent that controls real browsers with live visual streaming. 
              Watch your tasks execute in real-time with mouse tracking and automation.
            </p>
          </div>

          <div className="animate-fade-in-up delay-600">
            <div className="flex items-center justify-center gap-8 mb-12 flex-wrap">
              <div className="flex items-center gap-3 text-base text-muted-foreground hover:text-green-500 transition-all duration-300 group cursor-pointer">
                <CheckCircle className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-medium">Live Browser Control</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
              <div className="flex items-center gap-3 text-base text-muted-foreground hover:text-blue-500 transition-all duration-300 group cursor-pointer">
                <CheckCircle className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-medium">Real-time VNC Streaming</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
              <div className="flex items-center gap-3 text-base text-muted-foreground hover:text-purple-500 transition-all duration-300 group cursor-pointer">
                <CheckCircle className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-medium">AI-Powered Automation</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300" />
              </div>
            </div>
          </div>

          <div className="animate-fade-in-up delay-800">
            <Button 
              size="lg" 
              onClick={handleStartSession}
              disabled={isCreatingCheckout}
              className="px-12 py-8 text-xl font-semibold hover:scale-105 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/30 group rounded-2xl"
              data-testid="button-start-session"
            >
              {isCreatingCheckout ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  <span>Initializing Payment...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                  <span>Start 24-Hour Session - $1.00</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              )}
            </Button>
          </div>
          
          <div className="animate-fade-in-up delay-1000">
            <p className="text-base text-muted-foreground mt-6 font-medium">
              🔒 Secure payment via Stripe • 💯 Full refund if not satisfied
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-10 mb-20">
          <Card className="p-8 hover:scale-105 hover:shadow-xl hover:shadow-primary/15 transition-all duration-500 group border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-muted/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-500">
                <Monitor className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Live Browser View</h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-lg leading-relaxed">
              Watch the AI agent control browsers in real-time with VNC streaming. 
              See every click, scroll, and interaction as it happens.
            </p>
          </Card>

          <Card className="p-8 hover:scale-105 hover:shadow-xl hover:shadow-primary/15 transition-all duration-500 group border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-muted/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-500">
                <Bot className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">AI Automation</h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-lg leading-relaxed">
              Powered by advanced AI planning and Playwright engine. 
              Handles complex multi-step tasks with precision and reliability.
            </p>
          </Card>

          <Card className="p-8 hover:scale-105 hover:shadow-xl hover:shadow-primary/15 transition-all duration-500 group border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-muted/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-500">
                <Play className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Real-time Updates</h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-lg leading-relaxed">
              Live task progress, logs, and status updates via WebSocket. 
              Complete transparency into every automation step.
            </p>
          </Card>
        </div>

        {/* Demo Preview */}
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-12 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="flex flex-col items-center gap-4 group hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center group-hover:from-green-500/30 group-hover:to-green-600/30 transition-all duration-500 relative shadow-lg">
                <span className="text-green-600 font-bold text-xl">1</span>
                <div className="absolute -right-3 -top-3 w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
              </div>
              <h4 className="font-bold text-xl group-hover:text-green-600 transition-colors duration-300">Pay $1</h4>
              <p className="text-base text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-center">Secure checkout via Stripe</p>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-green-600 group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
            
            <div className="flex flex-col items-center gap-4 group hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-blue-600/30 transition-all duration-500 relative shadow-lg">
                <span className="text-blue-600 font-bold text-xl">2</span>
                <div className="absolute -right-3 -top-3 w-4 h-4 bg-blue-500 rounded-full animate-pulse shadow-lg"></div>
              </div>
              <h4 className="font-bold text-xl group-hover:text-blue-600 transition-colors duration-300">Get Access</h4>
              <p className="text-base text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-center">24-hour agent session</p>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
            
            <div className="flex flex-col items-center gap-4 group hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all duration-500 relative shadow-lg">
                <span className="text-purple-600 font-bold text-xl">3</span>
                <div className="absolute -right-3 -top-3 w-4 h-4 bg-purple-500 rounded-full animate-pulse shadow-lg"></div>
              </div>
              <h4 className="font-bold text-xl group-hover:text-purple-600 transition-colors duration-300">Request Tasks</h4>
              <p className="text-base text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-center">Chat with AI agent</p>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
            
            <div className="flex flex-col items-center gap-4 group hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center group-hover:from-orange-500/30 group-hover:to-orange-600/30 transition-all duration-500 relative shadow-lg">
                <span className="text-orange-600 font-bold text-xl">4</span>
                <div className="absolute -right-3 -top-3 w-4 h-4 bg-orange-500 rounded-full animate-pulse shadow-lg"></div>
              </div>
              <h4 className="font-bold text-xl group-hover:text-orange-600 transition-colors duration-300">Watch Live</h4>
              <p className="text-base text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-center">Real-time browser control</p>
              <Zap className="w-5 h-5 text-muted-foreground group-hover:text-orange-600 group-hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-base text-muted-foreground animate-fade-in-up delay-1200">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Terminal className="w-5 h-5 animate-pulse" />
            <p className="font-mono text-lg font-medium">Powered by PHOENIX-7742 AI Agent Technology</p>
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap text-sm">
            <span className="flex items-center gap-2 hover:text-green-500 transition-colors duration-300 cursor-pointer">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
              <span className="font-medium">Live VNC streaming</span>
            </span>
            <span className="flex items-center gap-2 hover:text-blue-500 transition-colors duration-300 cursor-pointer">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-lg"></div>
              <span className="font-medium">Playwright automation</span>
            </span>
            <span className="flex items-center gap-2 hover:text-purple-500 transition-colors duration-300 cursor-pointer">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-lg"></div>
              <span className="font-medium">Real-time WebSocket updates</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}