import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';

export default function Cancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="p-8 max-w-lg mx-auto text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        
        <h1 className="text-3xl font-bold mb-4">
          Payment Cancelled
        </h1>
        
        <p className="text-muted-foreground mb-6">
          Your payment was cancelled and no charges were made to your account.
          You can try again when you're ready to activate your AI agent.
        </p>

        <div className="space-y-3 text-sm text-muted-foreground mb-6 p-4 bg-muted/50 rounded-lg">
          <p>💡 Your PHOENIX agent session is just one click away</p>
          <p>🔒 Secure payment processing via Stripe</p>
          <p>⚡ Instant activation after successful payment</p>
          <p>🤖 24-hour unlimited AI agent access</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline"
            onClick={() => setLocation('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
          
          <Button 
            size="lg" 
            onClick={() => setLocation('/payment')}
            className="flex items-center gap-2"
            data-testid="button-retry-payment"
          >
            <CreditCard className="w-4 h-4" />
            Try Payment Again
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-6">
          Need help? Contact support for assistance with payment issues.
        </p>
      </Card>
    </div>
  );
}