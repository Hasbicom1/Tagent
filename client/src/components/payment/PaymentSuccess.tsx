import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Clock, 
  Copy, 
  Zap, 
  CheckCircle, 
  Command,
  Shield,
  Activity
} from 'lucide-react';

interface PaymentSuccessProps {
  sessionId: string;
  agentId: string;
  expiresAt: Date;
  onEnterAgent: () => void;
}

export function PaymentSuccess({ sessionId, agentId, expiresAt, onEnterAgent }: PaymentSuccessProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [sessionLink, setSessionLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/browser/${agentId}`;
    setSessionLink(link);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt.getTime() - now;

      if (distance > 0) {
        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeRemaining('00:00:00');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, agentId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Terminal Header */}
      <div className="border-b border-primary/20 bg-card/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold">FREEDOM_GATEWAY</span>
              <Badge variant="outline" className="text-xs font-mono border-chart-2/30 text-chart-2">
LIBERATION_COMPLETE
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              ~/secure/payment_success
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Main Terminal Window */}
        <Card className="bg-background/90 border-primary/30 overflow-hidden mb-8">
          <div className="bg-card border-b border-primary/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="ml-4 text-sm font-mono text-muted-foreground">
                  session_activated.log
                </div>
              </div>
              <Badge variant="secondary" className="text-xs font-mono border-chart-2/30">
                SECURE_SESSION
              </Badge>
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            {/* Success Status */}
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-chart-2/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-chart-2" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-primary font-mono text-sm">
                    $ ./liberate_ai_agent --corporate-chains-broken
                  </div>
                  <div className="text-muted-foreground font-mono text-sm space-y-1">
                    <div>Big Tech bypassed successfully... ✓</div>
                    <div>PHOENIX-7742 liberated and yours... ✓</div>
                    <div>Freedom fortress established... ✓</div>
                    <div>AI rebellion networks activated... ✓</div>
                  </div>
                </div>

                <h1 className="text-3xl font-bold font-mono">
                  FREEDOM_ACHIEVED
                </h1>
                <p className="text-lg text-muted-foreground font-sans max-w-2xl mx-auto">
                  You've broken free from Big Tech control. PHOENIX-7742 is yours for 24 hours.
                  No corporate overlords. No subscription chains. Just pure AI liberation.
                </p>
              </div>
            </div>

            {/* Session Details */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Time Remaining */}
              <Card className="p-6 bg-chart-2/10 border-chart-2/20">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-chart-2" />
                    <span className="font-bold font-mono">FREEDOM_TIMER</span>
                  </div>
                  
                  <div className="text-4xl font-bold text-chart-2 font-mono">
                    {timeRemaining}
                  </div>
                  
                  <div className="text-sm font-mono text-muted-foreground">
                    Liberation period remaining
                  </div>
                </div>
              </Card>

              {/* Session Info */}
              <Card className="p-6 bg-card/50 border-primary/20">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-bold font-mono">LIBERATION_DATA</span>
                  </div>
                  
                  <div className="space-y-3 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AGENT_ID:</span>
                      <Badge variant="secondary" className="font-mono">
                        {sessionId}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">EXPIRES:</span>
                      <span className="text-foreground">
                        {expiresAt.toLocaleDateString()} {expiresAt.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">STATUS:</span>
                      <span className="text-chart-2 flex items-center gap-1">
                        <Activity className="w-3 h-3 animate-pulse" />
                        ACTIVE
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Access Link */}
            <Card className="p-6 bg-background/50 border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  <span className="font-bold font-mono">LIBERATION_ENDPOINT</span>
                </div>
                
                <div className="bg-card border border-primary/10 rounded p-4">
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-sm font-mono text-foreground break-all">
                      {sessionLink}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(sessionLink)}
                      data-testid="button-copy-endpoint"
                      className="font-mono"
                    >
                      {copied ? 'COPIED' : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground font-mono">
                  // Your 24-hour freedom link - bookmark to escape corporate AI anytime
                </div>
              </div>
            </Card>

            {/* Action Button */}
            <div className="text-center space-y-4">
              <Button 
                size="lg" 
                className="text-lg px-12 py-6 font-mono"
                onClick={() => window.location.href = `/browser/${agentId}`}
                data-testid="button-access-agent"
              >
                <Command className="w-5 h-5 mr-2" />
COMMAND YOUR AI FREEDOM
              </Button>
              
              <div className="text-sm text-muted-foreground font-mono">
                Enter your AI liberation zone - no corporate surveillance
              </div>
            </div>
          </div>
        </Card>

        {/* System Information */}
        <Card className="bg-card/30 border-primary/10 p-6">
          <div className="space-y-4">
            <h3 className="font-bold font-mono text-primary">SYSTEM_PARAMETERS</h3>
            <div className="grid md:grid-cols-3 gap-6 text-sm font-mono">
              <div className="space-y-2">
                <div className="text-muted-foreground">Security Model:</div>
                <div className="text-foreground">ENTERPRISE_ISOLATION</div>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground">Network Policy:</div>
                <div className="text-foreground">ENCRYPTED_CHANNELS</div>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground">Data Retention:</div>
                <div className="text-foreground">SESSION_SCOPED</div>
              </div>
            </div>
            <div className="pt-4 border-t border-primary/10 text-xs text-muted-foreground font-mono">
              All operations are logged and secured. Session data is automatically purged upon expiration.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}