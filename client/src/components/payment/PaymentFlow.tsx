import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Loader2, CreditCard, Shield, ExternalLink, Twitter, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentFlowProps {
  onPaymentSuccess: (sessionData: { sessionId: string; agentId: string; expiresAt: Date }) => void;
}

export function PaymentFlow({ onPaymentSuccess }: PaymentFlowProps) {
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { toast } = useToast();

  // Create checkout session when component mounts
  useEffect(() => {
    const createCheckoutSession = async () => {
      try {
        // Get CSRF token first
        const csrfResponse = await apiRequest('GET', '/api/csrf-token', {});
        const { csrfToken } = await csrfResponse.json();
        
        const response = await apiRequest('POST', '/api/create-checkout-session', { csrfToken });
        const data = await response.json();
        console.log('Checkout session response:', data);
        
        if (data.checkoutUrl) {
          setCheckoutUrl(data.checkoutUrl);
          console.log('Checkout URL set:', data.checkoutUrl);
        } else {
          console.error('No checkoutUrl in response:', data);
          throw new Error('No checkout URL received from server');
        }
      } catch (error) {
        console.error('Failed to create checkout session:', error);
        toast({
          title: "LIBERATION_GATEWAY_ERROR",
          description: "Your escape from Big Tech subscription chains hit a snag. Retry your freedom activation.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    createCheckoutSession();
  }, [toast]);

  const handleProceedToCheckout = () => {
    console.log('Proceeding to checkout, URL:', checkoutUrl);
    if (checkoutUrl) {
      setIsRedirecting(true);
      console.log('Redirecting to:', checkoutUrl);
      // Force redirect with timeout fallback
      setTimeout(() => {
        window.location.href = checkoutUrl;
      }, 100);
      // Also try immediate redirect
      window.open(checkoutUrl, '_self');
    } else {
      console.error('No checkout URL available!');
      toast({
        title: "NEURAL_TRANSMISSION_ERROR", 
        description: "Liberation gateway not initialized. Refresh and try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-lg font-mono">INITIALIZING_AGENT_FOR_ALL...</div>
            <div className="text-sm text-muted-foreground">Preparing your UNIVERSAL-1 session</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!checkoutUrl) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <div className="text-lg font-mono text-destructive">PAYMENT_GATEWAY_ERROR</div>
            <div className="text-sm text-muted-foreground">Liberation payment gateway initialization failed</div>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              data-testid="button-retry"
            >
              RETRY
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Terminal Header */}
      <div className="border-b border-primary/20 bg-card/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold">AGENT_FOR_ALL_CHECKOUT</span>
              <Badge variant="outline" className="text-xs font-mono border-primary/30">
                STRIPE_HOSTED
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Payment Terminal */}
        <Card className="bg-background/90 border-primary/30 overflow-hidden">
          <div className="bg-card border-b border-primary/20 p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-chart-3" />
              <div className="w-3 h-3 rounded-full bg-chart-2" />
              <div className="ml-4 text-sm font-mono text-muted-foreground">
                stripe_checkout.exe
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold font-mono">
                AGENT FOR ALL
              </h1>
              <p className="text-lg text-muted-foreground font-sans">
                <strong>Break free from Big Tech.</strong> Own UNIVERSAL-1 for 24 hours. No subscriptions, no traps. Just <span className="text-primary">$1.00</span>.
              </p>
            </div>

            {/* Pricing Summary */}
            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-lg">Agent For All (24h)</span>
                  <span className="font-mono text-2xl font-bold text-primary">$1.00</span>
                </div>
                <div className="text-sm text-muted-foreground font-mono space-y-1">
                  <div>✓ Complete UNIVERSAL-1 ownership (not rental)</div>
                  <div>✓ Zero corporate restrictions (true freedom)</div>
                  <div>✓ Full browser automation (unlimited power)</div>
                  <div>✓ No subscription slavery (pay once, own it)</div>
                </div>
              </div>
            </Card>

            {/* Checkout Button */}
            <div className="space-y-6">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Button clicked! CheckoutUrl:', checkoutUrl);
                  handleProceedToCheckout();
                }}
                disabled={isRedirecting || !checkoutUrl}
                className="w-full text-lg py-6 font-mono"
                data-testid="button-proceed-checkout"
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    REDIRECTING_TO_STRIPE...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
ESCAPE BIG TECH AI • $1
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              
              <div className="text-center space-y-2 text-sm font-mono text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Agent For All payment via Stripe (we don't see your card)</span>
                </div>
                <div>24-hour ownership • No subscription traps • Freedom from Big Tech control</div>
                <div className="text-xs">Secure payment via independent Stripe (we never see your card details)</div>
              </div>
            </div>
          </div>
        </Card>
        
        {/* Contact Terminal */}
        <Card className="bg-background/50 border-primary/20 mt-8">
          <div className="bg-card border-b border-primary/20 p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-chart-3" />
              <div className="w-3 h-3 rounded-full bg-chart-2" />
              <div className="ml-4 text-sm font-mono text-muted-foreground">
                support_channels.exe
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <div className="text-primary font-mono text-sm">
                $ agent_support --democratize-ai
              </div>
              <div className="text-muted-foreground font-mono text-xs">
                Need help? AI democracy support is here.
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 text-sm font-mono">
              <a 
                href="https://x.com/AgentForAll" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                data-testid="link-twitter"
              >
                <Twitter className="w-4 h-4" />
                @AgentForAll
              </a>
              
              <a 
                href="mailto:support@agentforall.ai" 
                className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                data-testid="link-email"
              >
                <Mail className="w-4 h-4" />
                support@agentforall.ai
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}