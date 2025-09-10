import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, ExternalLink, Copy, Zap } from 'lucide-react';

interface PaymentSuccessProps {
  sessionId: string;
  expiresAt: Date;
  onEnterAgent: () => void;
}

export function PaymentSuccess({ sessionId, expiresAt, onEnterAgent }: PaymentSuccessProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [sessionLink, setSessionLink] = useState('');

  useEffect(() => {
    // Generate session link
    const link = `${window.location.origin}/agent/${sessionId}`;
    setSessionLink(link);

    // Update countdown every second
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt.getTime() - now;

      if (distance > 0) {
        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining('EXPIRED');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, sessionId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    console.log('Copied to clipboard:', text);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-chart-2/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-chart-2" />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Payment Successful!</h1>
            <p className="text-lg text-muted-foreground">
              Welcome to Agent HQ. Your 24-hour session with PHOENIX-7742 is now active.
            </p>
          </div>

          {/* Session Details */}
          <Card className="p-6 bg-chart-2/5 border-chart-2/20">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-chart-2" />
                <span className="font-semibold">Time Remaining</span>
              </div>
              
              <div className="text-4xl font-bold text-chart-2">
                {timeRemaining}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session ID:</span>
                  <Badge variant="secondary" className="font-mono">
                    {sessionId}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-medium">
                    {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Session Link */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Your 24-hour access link:
              </div>
              <div className="flex items-center gap-2 bg-background p-3 rounded border">
                <code className="flex-1 text-sm font-mono text-left break-all">
                  {sessionLink}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(sessionLink)}
                  data-testid="button-copy-link"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Bookmark this link to access your agent from any device
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button 
              size="lg" 
              className="w-full text-lg py-6"
              onClick={onEnterAgent}
              data-testid="button-enter-agent"
            >
              <Zap className="w-5 h-5 mr-2" />
              ENTER AGENT INTERFACE
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => copyToClipboard(sessionLink)}
                data-testid="button-share-link"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open('https://discord.gg/agenthq', '_blank')}
                data-testid="button-get-help"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Get Help
              </Button>
            </div>
          </div>

          {/* Important Notes */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="space-y-2 text-sm">
              <div className="font-medium text-primary">Important Notes:</div>
              <ul className="space-y-1 text-muted-foreground text-left">
                <li>• Your session expires in exactly 24 hours from payment</li>
                <li>• The agent link works on any device - save it!</li>
                <li>• Need help? Join our Discord for instant support</li>
                <li>• No refunds, but we guarantee you'll love the experience</li>
              </ul>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}