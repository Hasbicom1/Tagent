import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Terminal, 
  Clock, 
  Code, 
  Shield, 
  ChevronRight, 
  Command,
  Activity,
  Twitter,
  Mail,
  Cpu,
  Zap
} from 'lucide-react';

interface CommandTerminalInterfaceProps {
  onStartPayment: () => void;
}

interface RevealedSection {
  id: string;
  component: React.ReactNode;
  timestamp: number;
}

// Available themes
const THEMES = {
  default: { name: 'Default Blue', primary: '217 91% 60%' },
  neon: { name: 'Neon Green', primary: '120 100% 50%' },
  warm: { name: 'Warm Orange', primary: '25 100% 60%' },
  purple: { name: 'Electric Purple', primary: '270 100% 70%' },
  red: { name: 'Matrix Red', primary: '0 100% 60%' },
  cyan: { name: 'Cyber Cyan', primary: '180 100% 50%' },
  pink: { name: 'Hot Pink', primary: '320 100% 70%' },
  gold: { name: 'Digital Gold', primary: '45 100% 60%' }
};

export function CommandTerminalInterface({ onStartPayment }: CommandTerminalInterfaceProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [revealedSections, setRevealedSections] = useState<RevealedSection[]>([]);
  const [currentTheme, setCurrentTheme] = useState('default');
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Focus input on mount and keep focus
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Apply theme to CSS variables
  useEffect(() => {
    const theme = THEMES[currentTheme as keyof typeof THEMES];
    if (theme) {
      document.documentElement.style.setProperty('--primary', theme.primary);
    }
  }, [currentTheme]);

  // Auto scroll to bottom when new content is added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history, revealedSections]);

  const addToHistory = (text: string, isCommand = false) => {
    setHistory(prev => [...prev, text]);
    if (isCommand) {
      setCommandHistory(prev => [...prev, text]);
      setHistoryIndex(-1);
    }
  };

  const isAlreadyRevealed = (sectionId: string) => {
    return revealedSections.some(section => section.id === sectionId);
  };

  const revealSection = (sectionId: string, component: React.ReactNode) => {
    if (!isAlreadyRevealed(sectionId)) {
      setRevealedSections(prev => [...prev, { 
        id: sectionId, 
        component, 
        timestamp: Date.now() 
      }]);
    }
  };

  const executeCommand = (command: string) => {
    const cmd = command.toLowerCase().trim();
    addToHistory(`> ${command}`, true);

    switch (cmd) {
      case 'help':
        setShowHelp(true);
        addToHistory('AVAILABLE COMMANDS:');
        addToHistory('  show header     - Reveal site header');
        addToHistory('  show hero       - Display hero terminal');
        addToHistory('  show features   - Show feature cards');  
        addToHistory('  show specs      - Display technical specs');
        addToHistory('  show pricing    - Reveal pricing section');
        addToHistory('  show contact    - Display contact info');
        addToHistory('  reveal all      - Show complete interface');
        addToHistory('  theme <name>    - Change color theme');
        addToHistory('  themes          - List available themes');
        addToHistory('  clear           - Clear terminal');
        addToHistory('  reset           - Reset to beginning');
        addToHistory('');
        addToHistory('TIP: Type naturally! "show me pricing" works too');
        break;

      case 'themes':
        addToHistory('AVAILABLE THEMES:');
        Object.entries(THEMES).forEach(([key, theme]) => {
          addToHistory(`  ${key.padEnd(10)} - ${theme.name}`);
        });
        addToHistory('');
        addToHistory('Usage: theme <name> (e.g., "theme neon")');
        break;

      case 'clear':
        setHistory([]);
        break;

      case 'reset':
        setHistory([]);
        setRevealedSections([]);
        setShowHelp(false);
        addToHistory('Interface reset. Type "help" to start exploring!');
        break;

      case 'show header':
      case 'header':
        if (!isAlreadyRevealed('header')) {
          addToHistory('Revealing site header...');
          revealSection('header', <HeaderSection key="header" />);
        } else {
          addToHistory('Header already revealed');
        }
        break;

      case 'show hero':
      case 'hero':
        if (!isAlreadyRevealed('hero')) {
          addToHistory('Initializing hero terminal...');
          revealSection('hero', <HeroSection key="hero" />);
        } else {
          addToHistory('Hero already revealed');
        }
        break;

      case 'show features':
      case 'features':
        if (!isAlreadyRevealed('features')) {
          addToHistory('Loading feature cards...');
          revealSection('features', <FeaturesSection key="features" />);
        } else {
          addToHistory('Features already revealed');
        }
        break;

      case 'show specs':
      case 'specs':
      case 'specifications':
        if (!isAlreadyRevealed('specs')) {
          addToHistory('Displaying technical specifications...');
          revealSection('specs', <SpecsSection key="specs" />);
        } else {
          addToHistory('Specs already revealed');
        }
        break;

      case 'show pricing':
      case 'pricing':
        if (!isAlreadyRevealed('pricing')) {
          addToHistory('Revealing pricing information...');
          revealSection('pricing', <PricingSection key="pricing" onStartPayment={onStartPayment} />);
        } else {
          addToHistory('Pricing already revealed');
        }
        break;

      case 'show contact':
      case 'contact':
        if (!isAlreadyRevealed('contact')) {
          addToHistory('Loading contact information...');
          revealSection('contact', <ContactSection key="contact" />);
        } else {
          addToHistory('Contact already revealed');
        }
        break;

      case 'reveal all':
      case 'show all':
        addToHistory('Revealing complete interface...');
        const allSections = [
          { id: 'header', component: <HeaderSection key="header" /> },
          { id: 'hero', component: <HeroSection key="hero" /> },
          { id: 'features', component: <FeaturesSection key="features" /> },
          { id: 'specs', component: <SpecsSection key="specs" /> },
          { id: 'pricing', component: <PricingSection key="pricing" onStartPayment={onStartPayment} /> },
          { id: 'contact', component: <ContactSection key="contact" /> }
        ];
        
        allSections.forEach((section, index) => {
          if (!isAlreadyRevealed(section.id)) {
            setTimeout(() => {
              revealSection(section.id, section.component);
            }, index * 500);
          }
        });
        break;

      default:
        // Handle theme commands
        if (cmd.startsWith('theme ')) {
          const themeName = cmd.split(' ')[1];
          if (THEMES[themeName as keyof typeof THEMES]) {
            setCurrentTheme(themeName);
            addToHistory(`Theme changed to: ${THEMES[themeName as keyof typeof THEMES].name}`);
          } else {
            addToHistory(`Unknown theme: ${themeName}. Type "themes" to see available options.`);
          }
        }
        // Natural language processing
        else if (cmd.includes('show') || cmd.includes('display') || cmd.includes('reveal')) {
          if (cmd.includes('header')) {
            executeCommand('show header');
          } else if (cmd.includes('hero') || cmd.includes('main')) {
            executeCommand('show hero');
          } else if (cmd.includes('feature')) {
            executeCommand('show features');
          } else if (cmd.includes('spec') || cmd.includes('technical')) {
            executeCommand('show specs');
          } else if (cmd.includes('pricing') || cmd.includes('price') || cmd.includes('cost')) {
            executeCommand('show pricing');
          } else if (cmd.includes('contact') || cmd.includes('support')) {
            executeCommand('show contact');
          } else if (cmd.includes('all') || cmd.includes('everything')) {
            executeCommand('reveal all');
          } else {
            addToHistory(`I understood you want to show something, but not sure what.`);
            addToHistory(`   Try: "show header", "show pricing", etc. Type "help" for all options.`);
          }
        }
        else {
          addToHistory(`Command not recognized: ${command}`);
          addToHistory(`   Type "help" to see available commands.`);
        }
        break;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (input.trim()) {
        executeCommand(input);
        setInput('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono crt-screen scanlines">
      {/* Revealed sections appear above the terminal */}
      <div className="space-y-0">
        {revealedSections.map((section) => (
          <div 
            key={section.id}
            className="animate-in slide-in-from-top-4 fade-in duration-700"
            style={{ animationDelay: '0ms' }}
          >
            {section.component}
          </div>
        ))}
      </div>

      {/* Main Command Terminal - Always at bottom */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-primary/20 p-6">
        <Card className="bg-background/90 border-primary/30 terminal-window crt-screen electric-glow">
          <div className="bg-card border-b border-primary/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="ml-4 text-sm font-mono text-muted-foreground">
                  agent_discovery_terminal.exe
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                INTERACTIVE_MODE_ACTIVE
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {/* Terminal Output */}
            <div 
              ref={terminalRef}
              className="min-h-[200px] max-h-[300px] overflow-y-auto space-y-1 text-sm font-mono mb-4"
            >
              {!showHelp && history.length === 0 && (
                <div className="space-y-2 text-muted-foreground">
                  <div className="text-primary">Welcome to Agent For All Discovery Terminal</div>
                  <div>Type <span className="text-primary">"help"</span> to explore our UI interactively</div>
                  <div>or try <span className="text-primary">"show hero"</span> to get started!</div>
                </div>
              )}
              
              {history.map((line, index) => (
                <div key={index} className={line.startsWith('>') ? 'text-primary' : 'text-muted-foreground'}>
                  {line}
                </div>
              ))}
            </div>

            {/* Command Input */}
            <div className="flex items-center gap-2">
              <span className="text-primary">{'>'}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-foreground font-mono placeholder:text-muted-foreground"
                placeholder="Type a command... (try 'help')"
                data-testid="input-command"
              />
              <div className="text-xs text-muted-foreground">
                Press Enter to execute
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Section Components
function HeaderSection() {
  return (
    <div className="border-b border-primary/20 bg-card/50">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold phosphor-text matrix-text">AGENT FOR ALL</span>
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
  );
}

function HeroSection() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
      
      <div className="relative max-w-6xl mx-auto px-6 py-20">
        <Card className="bg-background/90 border-primary/30 overflow-hidden mb-12 terminal-window crt-screen electric-glow">
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
                  
                  <h1 className="text-4xl lg:text-6xl font-bold tracking-tight phosphor-text">
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
                  <strong>ENOUGH.</strong> AI belongs to <strong>everyone</strong>, not just Silicon Valley elites hoarding intelligence behind $100/month paywalls. 
                  Get <span className="text-primary font-mono">UNIVERSAL-1</span> — your personal AI agent that's <strong>yours</strong> for 24 hours. 
                  Break free from subscription slavery. <span className="text-primary">AI democracy starts with $1.</span>
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="grid md:grid-cols-3 gap-6">
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
              <strong>True ownership</strong> for 24 hours. No rental fees, no usage surveillance, 
              no corporate middlemen extracting profits from <em>your</em> intelligence.
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
              <strong>Complete transparency</strong> — no more black-box corporate AI controlling you. 
              <em>You</em> watch every decision, <em>you</em> control every action, <em>you</em> own every result.
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
              <strong>Your privacy fortress.</strong> Isolated sessions, zero tracking, 
              no Big Tech surveillance. What you create is <em>yours alone</em> — not theirs to monetize.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SpecsSection() {
  return (
    <div className="bg-card/30 border-y border-primary/10">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-mono mb-4">
            TECHNICAL_SPECIFICATIONS
          </h2>
          <p className="text-muted-foreground font-sans">
            Enterprise-grade power in the hands of real people, not just corporate overlords
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
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
  );
}

function PricingSection({ onStartPayment }: { onStartPayment: () => void }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h2 className="text-4xl font-bold font-mono">
            READY_TO_DEPLOY?
          </h2>
          <p className="text-xl text-muted-foreground font-sans max-w-2xl mx-auto">
            <strong>AI for everyone</strong>, not just the wealthy. <span className="text-primary">One dollar breaks down their barriers.</span>
          </p>
        </div>
        
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
              <div className="text-6xl font-bold text-primary font-mono phosphor-text">$1</div>
              <div className="text-lg font-mono text-muted-foreground">
                24_HOUR_SESSION
              </div>
              
              <div className="bg-card/50 rounded border border-primary/10 p-4 space-y-2 text-left font-mono text-sm">
                <div className="text-muted-foreground">// AI Revolution includes:</div>
                <div className="text-chart-2">✓ Full UNIVERSAL-1 ownership (not rental)</div>
                <div className="text-chart-2">✓ Zero usage restrictions (unlimited power)</div>
                <div className="text-chart-2">✓ Complete browser control (true automation)</div>
                <div className="text-chart-2">✓ No corporate monitoring (your data only)</div>
                <div className="text-chart-2">✓ Privacy-first isolation (Big Tech blocked)</div>
              </div>
              
              <Button 
                size="lg" 
                className="w-full text-lg py-6 font-mono"
                onClick={onStartPayment}
                data-testid="button-initialize-payment"
              >
                <Command className="w-5 h-5 mr-2" />
                BREAK THE AI GATEKEEPERS • $1
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ContactSection() {
  return (
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
          <div>AGENT FOR ALL © 2025 • <span className="text-primary">Liberating AI from corporate control</span></div>
          <div>Built by rebels who believe AI should empower people, not exploit them</div>
        </div>
      </div>
    </div>
  );
}