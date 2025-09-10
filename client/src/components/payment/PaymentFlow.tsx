import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Loader2, CreditCard, Shield, ExternalLink } from 'lucide-react';
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
        const response = await apiRequest('POST', '/api/create-checkout-session', {});
        const data = await response.json();
        setCheckoutUrl(data.checkoutUrl);
      } catch (error) {
        console.error('Failed to create checkout session:', error);
        toast({
          title: "Payment Error",
          description: "Failed to initialize payment system. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    createCheckoutSession();
  }, [toast]);

  const handleProceedToCheckout = () => {
    if (checkoutUrl) {
      setIsRedirecting(true);
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-lg font-mono">INITIALIZING_SECURE_CHECKOUT...</div>
            <div className="text-sm text-muted-foreground">Please wait while we prepare your session</div>
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
            <div className="text-sm text-muted-foreground">Failed to initialize secure checkout</div>
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
              <span className="text-lg font-bold">LIBERATION_CHECKOUT</span>
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
                BREAK THE CHAINS
              </h1>
              <p className="text-lg text-muted-foreground font-sans">
                Own your AI for 24 hours. Just $1.00. No Big Tech overlords.
              </p>
            </div>

            {/* Pricing Summary */}
            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-lg">PHOENIX Liberation (24h)</span>
                  <span className="font-mono text-2xl font-bold text-primary">$1.00</span>
                </div>
                <div className="text-sm text-muted-foreground font-mono space-y-1">
                  <div>✓ Total PHOENIX-7742 ownership</div>
                  <div>✓ Zero corporate restrictions</div>
                  <div>✓ Full browser liberation</div>
                  <div>✓ Privacy-first operation</div>
                </div>
              </div>
            </Card>

            {/* Checkout Button */}
            <div className="space-y-6">
              <Button
                onClick={handleProceedToCheckout}
                disabled={isRedirecting}
                className="w-full text-lg py-6 font-mono hover-elevate"
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
CLAIM YOUR AI FREEDOM
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              
              <div className="text-center space-y-2 text-sm font-mono text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Liberation payment via Stripe (we don't see your card)</span>
                </div>
                <div>24-hour ownership • Zero subscriptions • Instant freedom</div>
                <div className="text-xs">Escape to Stripe's independent payment fortress</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}