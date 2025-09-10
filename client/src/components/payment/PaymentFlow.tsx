import { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, Loader2, CreditCard, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Load Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentFlowProps {
  onPaymentSuccess: (sessionData: { sessionId: string; agentId: string; expiresAt: Date }) => void;
}

const CheckoutForm = ({ onPaymentSuccess }: PaymentFlowProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required'
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment with our backend
        const response = await apiRequest('POST', '/api/confirm-payment', {
          paymentIntentId: paymentIntent.id
        });

        const sessionData = await response.json();
        
        onPaymentSuccess({
          sessionId: sessionData.sessionId,
          agentId: sessionData.agentId,
          expiresAt: new Date(sessionData.expiresAt)
        });

        toast({
          title: "Payment Successful!",
          description: "Your agent session is now active.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement className="mb-6" />
      
      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full text-lg py-6 font-mono"
        data-testid="button-process-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            PROCESSING_PAYMENT...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            DEPLOY AGENT • $1.00
          </>
        )}
      </Button>
      
      <div className="text-center space-y-2 text-sm font-mono text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Secure payment via Stripe</span>
        </div>
        <div>24-hour session • No subscription • Instant activation</div>
      </div>
    </form>
  );
};

export function PaymentFlow({ onPaymentSuccess }: PaymentFlowProps) {
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await apiRequest('POST', '/api/create-payment-intent', {});
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error('Failed to create payment intent:', error);
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-lg font-mono">INITIALIZING_PAYMENT_GATEWAY...</div>
            <div className="text-sm text-muted-foreground">Please wait while we prepare your session</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <div className="text-lg font-mono text-destructive">PAYMENT_GATEWAY_ERROR</div>
            <div className="text-sm text-muted-foreground">Failed to initialize payment system</div>
          </div>
        </Card>
      </div>
    );
  }

  const stripeOptions = {
    clientSecret,
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#3b82f6',
        colorBackground: '#0f0f23',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Terminal Header */}
      <div className="border-b border-primary/20 bg-card/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold">PAYMENT_GATEWAY</span>
              <Badge variant="outline" className="text-xs font-mono border-primary/30">
                SECURE_CHECKOUT
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
                stripe_payment_terminal.exe
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold font-mono">
                DEPLOY AI AGENT
              </h1>
              <p className="text-lg text-muted-foreground font-sans">
                24-hour autonomous agent access for $1.00
              </p>
            </div>

            {/* Pricing Summary */}
            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-lg">Agent Session (24h)</span>
                  <span className="font-mono text-2xl font-bold text-primary">$1.00</span>
                </div>
                <div className="text-sm text-muted-foreground font-mono space-y-1">
                  <div>✓ Full PHOENIX-7742 access</div>
                  <div>✓ Unlimited task execution</div>
                  <div>✓ Live browser automation</div>
                  <div>✓ Real-time monitoring</div>
                </div>
              </div>
            </Card>

            {/* Payment Form */}
            <Elements stripe={stripePromise} options={stripeOptions}>
              <CheckoutForm onPaymentSuccess={onPaymentSuccess} />
            </Elements>
          </div>
        </Card>
      </div>
    </div>
  );
}