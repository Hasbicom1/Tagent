import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Zap, 
  Clock, 
  Shield, 
  ChevronRight, 
  Code, 
  Command,
  Cpu,
  Activity,
  Twitter,
  Mail
} from 'lucide-react';

interface LandingPageProps {
  onStartPayment: () => void;
}

export function LandingPage({ onStartPayment }: LandingPageProps) {
  const [isActivated, setIsActivated] = useState(false);

  const handleActivation = () => {
    setIsActivated(true);
    setTimeout(() => {
      setIsActivated(false);
      onStartPayment();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Terminal-style Header */}
      <div className="border-b border-primary/20 bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold">AGENT FOR ALL</span>
              <Badge variant="outline" className="text-xs font-mono border-primary/30">
                v2.0.1
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              ~/production/ready
            </div>
          </div>
        </div>
      </div>

      {/* Hero Terminal Interface */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          {/* Terminal Window */}
          <Card className="bg-background/90 border-primary/30 overflow-hidden mb-12">
            <div className="bg-card border-b border-primary/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-chart-3" />
                  <div className="w-3 h-3 rounded-full bg-chart-2" />
                  <div className="ml-4 text-sm font-mono text-muted-foreground">
                    agent_terminal.exe
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  SECURE_CONNECTION_ACTIVE
                </div>
              </div>
            </div>
            
            <div className="p-8 space-y-6 min-h-[400px]">
              <div className="space-y-4">
                <div className="text-primary font-mono text-sm">
                  $ ./initialize_agent_session --premium
                </div>
                <div className="text-muted-foreground font-mono text-sm space-y-1">
                  <div>Initializing AI Agent UNIVERSAL-1...</div>
                  <div>Loading neural networks... ████████████ 100%</div>
                  <div>Establishing secure connection... ✓</div>
                  <div>Agent status: <span className="text-chart-2">READY</span></div>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-primary/10">
                <div className="text-center space-y-6">
                  <div className="space-y-4">
                    <Badge variant="secondary" className="text-sm font-mono border-primary/30">
                      <Activity className="w-3 h-3 mr-2" />
                      AI_FOR_EVERYONE
                    </Badge>
                    
                    <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
                      <span className="text-primary text-5xl lg:text-7xl">AGENT</span>
                      <span className="text-foreground"> FOR </span>
                      <span className="text-primary text-5xl lg:text-7xl">ALL</span>
                      <br />
                      <span className="text-foreground">PAY </span>
                      <span className="text-primary text-5xl lg:text-7xl">$1</span>
                      <span className="text-foreground"> NOT</span>
                      <br />
                      <span className="text-primary text-5xl lg:text-7xl">$100</span>
                      <span className="text-foreground">/MONTH</span>
                    </h1>
                  </div>
                  
                  <p className="text-lg text-muted-foreground max-w-3xl mx-auto font-sans">
                    AI belongs to <strong>everyone</strong>, not just Silicon Valley elites. Get <span className="text-primary font-mono">UNIVERSAL-1</span> — 
                    your personal AI agent that's <strong>yours</strong> for 24 hours. Break free from subscription slavery. AI democracy starts with $1.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                    <Button 
                      size="lg" 
                      className="text-lg px-8 py-6 font-mono group"
                      onClick={onStartPayment}
                      data-testid="button-deploy-agent"
                    >
                      <Terminal className="w-5 h-5 mr-2" />
AGENT FOR ALL • $1
                      <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>

                {/* System Status */}
                <div className="bg-card/50 rounded border border-primary/10 p-4 mt-8">
                  <div className="grid md:grid-cols-3 gap-4 text-sm font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">AGENT_STATUS</span>
                      <span className="text-chart-2 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-chart-2 animate-pulse" />
                        ONLINE
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">UPTIME</span>
                      <span className="text-foreground">99.97%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">RESPONSE_TIME</span>
                      <span className="text-foreground">~2.1ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {isActivated && (
                <div className="border-t border-primary/20 pt-4 space-y-2 text-sm font-mono">
                  <div className="text-primary">$ Agent activation sequence initiated...</div>
                  <div className="text-chart-2">Redirecting to secure payment gateway...</div>
                  <div className="text-muted-foreground animate-pulse">Please wait...</div>
                </div>
              )}
            </div>
          </Card>

          {/* Core Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card className="bg-card/50 border-primary/20 p-6 hover-elevate">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold font-mono">24H_SESSION</h3>
                    <div className="text-sm text-muted-foreground font-mono">--no-limits</div>
                  </div>
                </div>
                <p className="text-muted-foreground font-sans text-sm">
                  True ownership for 24 hours. No rental fees, no usage surveillance, 
                  no corporate middlemen extracting value from your work.
                </p>
              </div>
            </Card>
            
            <Card className="bg-card/50 border-primary/20 p-6 hover-elevate">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Code className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold font-mono">LIVE_EXECUTION</h3>
                    <div className="text-sm text-muted-foreground font-mono">--verbose</div>
                  </div>
                </div>
                <p className="text-muted-foreground font-sans text-sm">
                  Complete transparency — unlike black-box corporate AI. 
                  Watch every decision, control every action, own every result.
                </p>
              </div>
            </Card>
            
            <Card className="bg-card/50 border-primary/20 p-6 hover-elevate">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold font-mono">SECURE_ISOLATION</h3>
                    <div className="text-sm text-muted-foreground font-mono">--sandboxed</div>
                  </div>
                </div>
                <p className="text-muted-foreground font-sans text-sm">
                  Your privacy fortress. Isolated sessions, zero tracking, 
                  no corporate surveillance. What you do is yours alone.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Technical Specifications */}
      <div className="bg-card/30 border-y border-primary/10">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-mono mb-4">
              TECHNICAL_SPECIFICATIONS
            </h2>
            <p className="text-muted-foreground font-sans">
              Enterprise-grade infrastructure accessible to everyone
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Agent Capabilities */}
            <Card className="bg-background/50 border-primary/20 p-6">
              <h3 className="text-xl font-bold font-mono mb-4 text-primary">
                AGENT_CAPABILITIES
              </h3>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Browser Control:</span>
                  <span className="text-chart-2">FULL_AUTOMATION</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Task Analysis:</span>
                  <span className="text-chart-2">NEURAL_NETWORKS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Response Time:</span>
                  <span className="text-chart-2">SUB_SECOND</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Concurrency:</span>
                  <span className="text-chart-2">UNLIMITED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Learning Mode:</span>
                  <span className="text-chart-2">ADAPTIVE</span>
                </div>
              </div>
            </Card>

            {/* System Architecture */}
            <Card className="bg-background/50 border-primary/20 p-6">
              <h3 className="text-xl font-bold font-mono mb-4 text-primary">
                SYSTEM_ARCHITECTURE
              </h3>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Runtime:</span>
                  <span className="text-foreground">CLOUD_NATIVE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security:</span>
                  <span className="text-foreground">ENTERPRISE_GRADE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scaling:</span>
                  <span className="text-foreground">AUTO_HORIZONTAL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monitoring:</span>
                  <span className="text-foreground">REAL_TIME</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime SLA:</span>
                  <span className="text-foreground">99.9%</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Deployment Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold font-mono">
              READY_TO_DEPLOY?
            </h2>
            <p className="text-xl text-muted-foreground font-sans max-w-2xl mx-auto">
              AI for everyone, not just the wealthy. One dollar breaks down the barriers.
            </p>
          </div>
          
          {/* Pricing Terminal */}
          <Card className="bg-background/90 border-primary/30 max-w-2xl mx-auto">
            <div className="bg-card border-b border-primary/20 p-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="ml-4 text-sm font-mono text-muted-foreground">
                  pricing_config.json
                </div>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="text-center space-y-4">
                <div className="text-6xl font-bold text-primary font-mono">$1</div>
                <div className="text-lg font-mono text-muted-foreground">
                  24_HOUR_SESSION
                </div>
                
                <div className="bg-card/50 rounded border border-primary/10 p-4 space-y-2 text-left font-mono text-sm">
                  <div className="text-muted-foreground">// Democracy includes:</div>
                  <div className="text-chart-2">✓ Full UNIVERSAL-1 ownership</div>
                  <div className="text-chart-2">✓ Zero usage restrictions</div>
                  <div className="text-chart-2">✓ Complete browser control</div>
                  <div className="text-chart-2">✓ No corporate monitoring</div>
                  <div className="text-chart-2">✓ Privacy-first isolation</div>
                </div>
                
                <Button 
                  size="lg" 
                  className="w-full text-lg py-6 font-mono"
                  onClick={onStartPayment}
                  data-testid="button-initialize-payment"
                >
                  <Command className="w-5 h-5 mr-2" />
JOIN THE AI REVOLUTION
                </Button>
              </div>
            </div>
          </Card>

          <div className="text-sm text-muted-foreground font-mono space-y-1">
            <div>AI for all • No surveillance capitalism • Your intelligence, your rules</div>
            <div>No subscription slavery • No Big Tech gatekeepers • True AI democracy</div>
          </div>
        </div>
      </div>

      {/* Contact Terminal */}
      <div className="border-t border-primary/20 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <Card className="bg-background/50 border-primary/20 max-w-2xl mx-auto mb-8">
            <div className="bg-card border-b border-primary/20 p-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="ml-4 text-sm font-mono text-muted-foreground">
                  contact_support.sh
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="text-primary font-mono text-sm">
                  $ contact --support --agent-for-all
                </div>
                <div className="text-muted-foreground font-mono text-sm space-y-2">
                  <div>Initializing contact protocols...</div>
                  <div>Democratic AI support channels: <span className="text-chart-2">ACTIVE</span></div>
                </div>
              </div>
              
              <div className="bg-card/50 rounded border border-primary/10 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Twitter className="w-4 h-4 text-primary" />
                  <span className="font-mono text-sm text-muted-foreground">--twitter</span>
                  <a 
                    href="https://x.com/AgentForAll" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-primary hover:text-primary/80 transition-colors"
                    data-testid="link-twitter"
                  >
                    @AgentForAll
                  </a>
                </div>
                
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="font-mono text-sm text-muted-foreground">--email</span>
                  <a 
                    href="mailto:support@agentforall.ai" 
                    className="font-mono text-sm text-primary hover:text-primary/80 transition-colors"
                    data-testid="link-email"
                  >
                    support@agentforall.ai
                  </a>
                </div>
              </div>
              
              <div className="text-xs font-mono text-muted-foreground">
                Contact channels established • AI democracy support ready
              </div>
            </div>
          </Card>
          
          <div className="text-center space-y-2 text-sm font-mono text-muted-foreground">
            <div>AGENT FOR ALL © 2025 • Democratizing AI for everyone</div>
            <div>Built for people who believe AI should serve all, not just the elite</div>
          </div>
        </div>
      </div>
    </div>
  );
}