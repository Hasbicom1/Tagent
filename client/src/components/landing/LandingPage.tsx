import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, Terminal, Zap, Clock, Shield, Play, ChevronRight } from 'lucide-react';
import brainImage from '@assets/generated_images/AI_brain_neural_network_e66f3b84.png';
import automationImage from '@assets/generated_images/Browser_automation_interface_9b695698.png';

interface TerminalCommand {
  command: string;
  response: string;
}

export function LandingPage() {
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<TerminalCommand[]>([
    { command: 'help', response: 'Available commands: search, automate, execute, status' },
  ]);
  const [brainActive, setBrainActive] = useState(false);

  // Mock terminal commands for demo
  const handleTerminalCommand = (command: string) => {
    const responses: Record<string, string> = {
      'search amazon for RTX 4090': '🔍 Found 23 listings, analyzing prices...',
      'automate login facebook': '🤖 Navigating to facebook.com, filling credentials...',
      'execute task': '⚡ Initializing browser automation sequence...',
      'status': '✅ Agent PHOENIX-7742 ready. Payment required for execution.',
      'help': 'Available commands: search, automate, execute, status',
    };

    const response = responses[command.toLowerCase()] || '❓ Unknown command. Type "help" for available commands.';
    
    setTerminalHistory(prev => [...prev, { command, response }]);
    setTerminalInput('');
  };

  const handleBrainClick = () => {
    setBrainActive(true);
    setTimeout(() => setBrainActive(false), 2000);
    // Simulate brain activation
    console.log('Brain activation triggered - redirecting to payment...');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-6 text-sm font-medium">
              <Zap className="w-3 h-3 mr-1" />
              AI AGENT PLATFORM
            </Badge>
            
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-foreground">PAY </span>
              <span className="text-primary text-6xl lg:text-8xl">$1</span>
              <span className="text-foreground">, GET 24H</span>
              <br />
              <span className="text-foreground">AI AGENT ACCESS</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Talk to <strong>AGENT PHOENIX-7742</strong>, describe any task, click EXECUTE, 
              and watch live browser automation happen. Perfect for deadlines.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 hover-elevate"
                onClick={() => console.log('Pay $1 clicked')}
                data-testid="button-pay-dollar"
              >
                <Zap className="w-5 h-5 mr-2" />
                PAY $1 • START NOW
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-watch-demo"
              >
                <Play className="w-5 h-5 mr-2" />
                WATCH DEMO
              </Button>
            </div>

            {/* Interactive Brain */}
            <div className="flex justify-center mb-8">
              <div 
                className={`relative cursor-pointer transition-all duration-300 ${brainActive ? 'scale-110' : 'hover:scale-105'}`}
                onClick={handleBrainClick}
                data-testid="button-brain-activation"
              >
                <div className={`absolute inset-0 rounded-full ${brainActive ? 'animate-pulse bg-primary/20' : ''}`} />
                <img 
                  src={brainImage} 
                  alt="AI Brain Neural Network" 
                  className={`w-32 h-32 rounded-full border-2 transition-all duration-300 ${brainActive ? 'border-primary shadow-lg shadow-primary/25' : 'border-border'}`}
                />
                {brainActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-primary font-bold text-sm animate-pulse">ACTIVATING...</div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Click the brain to activate • No signup required • Instant access
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card className="p-6 hover-elevate">
              <Clock className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">24 Hour Access</h3>
              <p className="text-muted-foreground">
                Full access to PHOENIX-7742 for exactly 24 hours. No subscriptions, no hidden fees.
              </p>
            </Card>
            
            <Card className="p-6 hover-elevate">
              <Terminal className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Live Automation</h3>
              <p className="text-muted-foreground">
                Watch in real-time as the AI agent executes tasks in your browser. Full transparency.
              </p>
            </Card>
            
            <Card className="p-6 hover-elevate">
              <Shield className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Instant Results</h3>
              <p className="text-muted-foreground">
                Perfect for deadlines. Get complex web tasks done in minutes, not hours.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Interactive Terminal Demo */}
      <div id="demo" className="bg-card py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Try the Terminal Interface</h2>
            <p className="text-muted-foreground">
              Preview what you'll get after payment. Type commands below:
            </p>
          </div>

          <Card className="bg-background border-2 border-primary/20">
            <div className="bg-primary/5 p-4 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="ml-4 text-sm font-mono text-muted-foreground">
                  AGENT PHOENIX-7742 • DEMO MODE
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-background font-mono text-sm">
              <div className="mb-4 h-64 overflow-y-auto bg-card p-4 rounded border space-y-2">
                {terminalHistory.map((item, idx) => (
                  <div key={idx}>
                    <div className="text-primary">$ {item.command}</div>
                    <div className="text-chart-2 ml-2">{item.response}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-primary">$</span>
                <Input
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && terminalInput.trim()) {
                      handleTerminalCommand(terminalInput.trim());
                    }
                  }}
                  className="bg-transparent border-none font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Type a command... (try: search amazon for RTX 4090)"
                  data-testid="input-terminal-command"
                />
              </div>
            </div>
          </Card>

          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">
              This is just a preview. Pay $1 to unlock the full AI agent.
            </p>
            <Button 
              size="lg" 
              onClick={() => console.log('Upgrade to full access')}
              data-testid="button-upgrade-access"
            >
              <Zap className="w-5 h-5 mr-2" />
              UNLOCK FULL ACCESS • $1
            </Button>
          </div>
        </div>
      </div>

      {/* Browser Automation Preview */}
      <div className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Live Browser Automation</h2>
            <p className="text-muted-foreground">
              Watch PHOENIX-7742 work in real-time
            </p>
          </div>

          <Card className="overflow-hidden hover-elevate">
            <img 
              src={automationImage} 
              alt="Browser Automation Interface" 
              className="w-full h-auto"
            />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium">LIVE AUTOMATION FEED</span>
              </div>
              <p className="text-muted-foreground">
                Real-time view of AI agent performing tasks. No black box - see exactly what happens.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Pricing CTA */}
      <div className="bg-primary/5 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            One Price. One Agent. 24 Hours.
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            No subscriptions. No limits. Just pure AI automation power.
          </p>
          
          <div className="bg-background rounded-lg p-8 mb-8 border">
            <div className="text-6xl font-bold text-primary mb-2">$1</div>
            <div className="text-lg font-medium mb-4">24 Hour Access</div>
            <div className="text-muted-foreground space-y-1 mb-6">
              <div>✓ Full PHOENIX-7742 access</div>
              <div>✓ Unlimited task execution</div>
              <div>✓ Live browser automation</div>
              <div>✓ Real-time progress tracking</div>
            </div>
            <Button 
              size="lg" 
              className="w-full text-lg py-6"
              onClick={() => console.log('Final CTA clicked')}
              data-testid="button-final-cta"
            >
              <Zap className="w-5 h-5 mr-2" />
              START YOUR 24H SESSION NOW
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Secure payment via Stripe • Instant activation • No account required
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-sm text-muted-foreground space-y-2">
            <div>Agent HQ © 2025 • Powered by AI</div>
            <div>Contact: hello@agenthq.ai • Support available 24/7</div>
          </div>
        </div>
      </div>
    </div>
  );
}