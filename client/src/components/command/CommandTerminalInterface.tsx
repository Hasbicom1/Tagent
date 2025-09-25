import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
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
  Zap,
  Minus,
  Maximize2
} from 'lucide-react';

interface CommandTerminalInterfaceProps {
  onStartPayment: () => void;
}

interface RevealedSection {
  id: string;
  component: React.ReactNode;
  timestamp: number;
}

interface HistoryEntry {
  text: string;
  color: string;
  isCommand?: boolean;
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

// Revolutionary portrait ASCII art with tech elements
const CHE_ASCII = `
    @@@@@@@@@@@@@@@@@@@
  @@@@@@@@%@@@@@@@@@@@@
  @@@@@@@@@**@@@@@@@@@@@
 @@@@@@@@@@#-@%*++=---=+
 @@@@@@@@@@@@@@@@@@@@%*%
 @@@@@@@@@@@@@@@@@@@@#:%
 @@@@@@@@@@@@@@@@@@%=%+
 @@@@@@@@@@@@@@@@@%.%*%
  @@@@@@@@@@@@@@-.. #*@
    @@@@@@@@@@@@#%#+#:
      @@@@@@@@@@@@@
      [REVOLUTION]
     {AI FOR ALL}
`;

export function CommandTerminalInterface({ onStartPayment }: CommandTerminalInterfaceProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [revealedSections, setRevealedSections] = useState<RevealedSection[]>([]);
  const [currentTheme, setCurrentTheme] = useState('default');
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
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

  const addToHistory = (text: string, isCommand = false, color = 'default') => {
    const colorClass = color === 'success' ? 'text-chart-2' : 
                       color === 'error' ? 'text-destructive' :
                       color === 'command' ? 'text-primary' : 'text-muted-foreground';
    setHistory(prev => [...prev, { text, color: colorClass, isCommand }]);
    if (isCommand) {
      setCommandHistory(prev => [...prev, text]);
      setHistoryIndex(-1);
    }
  };

  const animateLoading = (text: string, callback: () => void) => {
    setIsLoading(true);
    setLoadingText(text);
    setLoadingProgress(0);
    
    const totalSteps = 20;
    let step = 0;
    
    const interval = setInterval(() => {
      step++;
      setLoadingProgress((step / totalSteps) * 100);
      
      if (step >= totalSteps) {
        clearInterval(interval);
        setIsLoading(false);
        setLoadingProgress(0);
        callback();
      }
    }, 80);
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
    addToHistory(`> ${command}`, true, 'command');

    // Short command aliases
    const aliasMap: { [key: string]: string } = {
      'h': 'hero',
      'f': 'features', 
      'p': 'pricing',
      's': 'specs',
      'c': 'contact',
      'a': 'about',
      'all': 'reveal all',
      't': 'themes'
    };

    const actualCmd = aliasMap[cmd] || cmd;

    switch (actualCmd) {
      case 'help':
        setShowHelp(true);
        addToHistory('COMMANDS: h(hero) f(features) p(pricing) s(specs) c(contact) a(about) expand all t(themes)', false, 'success');
        addToHistory('ADVANCED: theme <name>, clear, reset | Natural language: "show pricing"', false);
        break;

      case 'themes':
        addToHistory('AVAILABLE THEMES:', false, 'success');
        Object.entries(THEMES).forEach(([key, theme]) => {
          addToHistory(`  ${key.padEnd(10)} - ${theme.name}`, false);
        });
        addToHistory('', false);
        addToHistory('Usage: theme <name> (e.g., "theme neon")', false);
        break;

      case 'clear':
        setHistory([]);
        break;

      case 'reset':
        setHistory([]);
        setRevealedSections([]);
        setShowHelp(false);
        addToHistory('Interface reset. Type "help" to start exploring!', false, 'success');
        break;

      case 'hero':
        if (!isAlreadyRevealed('hero')) {
          animateLoading('Initializing hero section', () => {
            addToHistory('Hero section loaded!', false, 'success');
            revealSection('hero', <HeroSection key="hero" />);
          });
        } else {
          addToHistory('Hero already revealed', false, 'error');
        }
        break;

      case 'features':
        if (!isAlreadyRevealed('features')) {
          animateLoading('Loading feature cards', () => {
            addToHistory('Features loaded!', false, 'success');
            revealSection('features', <FeaturesSection key="features" />);
          });
        } else {
          addToHistory('Features already revealed', false, 'error');
        }
        break;

      case 'specs':
        if (!isAlreadyRevealed('specs')) {
          animateLoading('Displaying technical specifications', () => {
            addToHistory('Technical specs loaded!', false, 'success');
            revealSection('specs', <SpecsSection key="specs" />);
          });
        } else {
          addToHistory('Specs already revealed', false, 'error');
        }
        break;

      case 'pricing':
        if (!isAlreadyRevealed('pricing')) {
          animateLoading('Revealing pricing information', () => {
            addToHistory('Pricing information loaded!', false, 'success');
            revealSection('pricing', <PricingSection key="pricing" onStartPayment={onStartPayment} />);
          });
        } else {
          addToHistory('Pricing already revealed', false, 'error');
        }
        break;

      case 'contact':
        if (!isAlreadyRevealed('contact')) {
          animateLoading('Loading contact information', () => {
            addToHistory('Contact info loaded!', false, 'success');
            revealSection('contact', <ContactSection key="contact" />);
          });
        } else {
          addToHistory('Contact already revealed', false, 'error');
        }
        break;

      case 'about':
        if (!isAlreadyRevealed('about')) {
          animateLoading('Initializing hacker interface', () => {
            addToHistory('Hacker interface loaded!', false, 'success');
            revealSection('about', <AboutSection key="about" />);
          });
        } else {
          addToHistory('About already revealed', false, 'error');
        }
        break;

      case 'expand':
        const expandOption = input.split(' ')[1];
        if (expandOption === 'window') {
          setIsExpanded(true);
          addToHistory('Window expanded to full screen!', false, 'success');
        } else if (expandOption === 'content') {
          addToHistory('Content area expanded!', false, 'success');
        } else if (expandOption === 'fullscreen') {
          setIsExpanded(true);
          addToHistory('Fullscreen mode activated!', false, 'success');
        } else {
          addToHistory('EXPAND OPTIONS:', false, 'success');
          addToHistory('  fullscreen - Expand to fullscreen mode', false);
          addToHistory('  window   - Expand window to full screen', false);
          addToHistory('  content  - Expand content area', false);
          addToHistory('Usage: expand <option>', false);
        }
        break;

      case 'reveal all':
        addToHistory('Revealing complete interface...', false, 'success');
        const allSections = [
          { id: 'hero', component: <HeroSection key="hero" /> },
          { id: 'features', component: <FeaturesSection key="features" /> },
          { id: 'specs', component: <SpecsSection key="specs" /> },
          { id: 'pricing', component: <PricingSection key="pricing" onStartPayment={onStartPayment} /> },
          { id: 'contact', component: <ContactSection key="contact" /> },
          { id: 'about', component: <AboutSection key="about" /> }
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
            addToHistory(`Theme changed to: ${THEMES[themeName as keyof typeof THEMES].name}`, false, 'success');
          } else {
            addToHistory(`Unknown theme: ${themeName}. Type "themes" to see available options.`, false, 'error');
          }
        }
        // Natural language processing
        else if (cmd.includes('show') || cmd.includes('display') || cmd.includes('reveal')) {
          if (cmd.includes('hero') || cmd.includes('main')) {
            executeCommand('hero');
          } else if (cmd.includes('feature')) {
            executeCommand('features');
          } else if (cmd.includes('spec') || cmd.includes('technical')) {
            executeCommand('specs');
          } else if (cmd.includes('pricing') || cmd.includes('price') || cmd.includes('cost')) {
            executeCommand('pricing');
          } else if (cmd.includes('contact') || cmd.includes('support')) {
            executeCommand('contact');
          } else if (cmd.includes('all') || cmd.includes('everything')) {
            executeCommand('reveal all');
          } else {
            addToHistory('I understood you want to show something, but not sure what.', false, 'error');
            addToHistory('Try: "h", "f", "p" or "hero", "features", "pricing". Type "help" for all options.', false);
          }
        }
        else {
          addToHistory(`Command not recognized: ${command}`, false, 'error');
          addToHistory('Type "help" to see available commands.', false);
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

  const ProgressBar = ({ progress }: { progress: number }) => {
    const filled = Math.floor(progress / 5);
    const blocks = Array.from({ length: 20 }, (_, i) => i < filled ? '█' : '▒');
    return <span className="font-mono">{blocks.join('')}</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono crt-screen scanlines">
      {/* Terminal at TOP - Fixed Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-primary/20 p-4 z-50">
        <Card className="bg-background/90 border-primary/30 terminal-window crt-screen electric-glow">
          <div className="bg-card border-b border-primary/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="ml-4 text-sm font-mono text-muted-foreground">
                  dream_terminal.exe
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-primary/20"
                  onClick={() => setIsMinimized(!isMinimized)}
                  data-testid="button-minimize-terminal"
                >
                  {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </Button>
                <div className="text-xs text-muted-foreground font-mono">
                  AI_DREAMS_ACTIVE
                </div>
              </div>
            </div>
          </div>
          
          {!isMinimized && (
            <div className="p-4">
              {/* Terminal Output */}
              <div 
                ref={terminalRef}
                className="min-h-[80px] max-h-[120px] overflow-y-auto space-y-1 text-sm font-mono mb-4"
              >
              {!showHelp && history.length === 0 && (
                <div className="space-y-4 text-center">
                  <pre className="text-xs text-primary/60 leading-none">
                    {CHE_ASCII}
                  </pre>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="text-primary">AI dreams shouldn't cost more than a coffee</div>
                    <div>Type <span className="text-primary">"help"</span> to discover the interface</div>
                    <div>or try <span className="text-primary">"h"</span> for hero section!</div>
                  </div>
                </div>
              )}
              
              {history.map((entry, index) => (
                <div key={index} className={entry.color}>
                  {entry.text}
                </div>
              ))}

              {isLoading && (
                <div className="space-y-1">
                  <div className="text-primary">{loadingText}...</div>
                  <div className="flex items-center gap-2">
                    <ProgressBar progress={loadingProgress} />
                    <span className="text-chart-2">{Math.round(loadingProgress)}%</span>
                  </div>
                </div>
              )}
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
                disabled={isLoading}
                className="flex-1 bg-transparent border-none outline-none text-primary font-mono placeholder:text-muted-foreground caret-primary"
                placeholder="Type a command... (try 'help' or 'h')"
                data-testid="input-command"
              />
              <div className="text-xs text-muted-foreground">
                Press Enter
              </div>
            </div>
          </div>
          )}
        </Card>
      </div>

      {/* Revealed sections appear below terminal */}
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
    </div>
  );
}

// Section Components - UPDATED MESSAGING
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
                  dream_accelerator.exe
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                DREAMS_LOADING
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-6 min-h-[400px]">
            <div className="space-y-4">
              <div className="text-primary font-mono text-sm">
                $ ./activate_dream_accelerator --affordable
              </div>
              <div className="text-muted-foreground font-mono text-sm space-y-1">
                <div>Loading AI dreams for everyone...</div>
                <div>Breaking price barriers... ████████████ 100%</div>
                <div>Connecting dreamers worldwide... ✓</div>
                <div>Status: <span className="text-chart-2">DREAMS_READY</span></div>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-primary/10">
              <div className="text-center space-y-6">
                <div className="space-y-4">
                  <Badge variant="secondary" className="text-sm font-mono border-primary/30">
                    <Activity className="w-3 h-3 mr-2" />
                    DREAMS_FOR_EVERYONE
                  </Badge>
                  
                  <h1 className="text-4xl lg:text-6xl font-bold tracking-tight phosphor-text">
                    <span className="text-foreground">AI SHOULD COST</span>
                    <br />
                    <span className="text-primary text-5xl lg:text-7xl">JUST $1</span>
                    <br />
                    <span className="text-foreground">NOT </span>
                    <span className="text-primary text-5xl lg:text-7xl">$100</span>
                    <span className="text-foreground">/MONTH</span>
                  </h1>
                </div>
                
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto font-sans">
                  <strong>Your dreams matter.</strong> Poor people have dreams too. 
                  Maybe <span className="text-primary font-mono">$1 and 24 hours</span> is all someone needs to speed up their dream. 
                  Why should brilliant minds be stuck in $100/month subscriptions when 
                  <span className="text-primary"> that money could change lives in countless other ways?</span>
                </p>
                
                <div className="bg-card/50 rounded border border-primary/10 p-6 max-w-2xl mx-auto">
                  <div className="text-center space-y-2">
                    <div className="text-primary font-mono text-2xl">Maybe $1 + 24h = Life Change</div>
                    <div className="text-muted-foreground font-sans text-sm">
                      For millions of dreamers worldwide who deserve their shot at AI-powered acceleration
                    </div>
                  </div>
                </div>
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
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold font-mono mb-4">
          WHY_JUST_A_DOLLAR?
        </h2>
        <p className="text-muted-foreground font-sans">
          Because everyone deserves a chance to accelerate their dreams
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-card/50 border-primary/20 p-6 hover-elevate">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold font-mono">24H_DREAMS</h3>
                <div className="text-sm text-muted-foreground font-mono">--full-ownership</div>
              </div>
            </div>
            <p className="text-muted-foreground font-sans text-sm">
              <strong>24 hours to chase your dream.</strong> No monthly chains, no recurring anxiety. 
              Just pure focus on what matters - <em>your vision, your breakthrough, your moment.</em>
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
                <h3 className="font-bold font-mono">DREAM_TRANSPARENCY</h3>
                <div className="text-sm text-muted-foreground font-mono">--watch-it-work</div>
              </div>
            </div>
            <p className="text-muted-foreground font-sans text-sm">
              <strong>See every step of your journey.</strong> No black boxes hiding your progress. 
              <em>You</em> watch your AI work, <em>you</em> understand each decision, <em>you</em> learn as you grow.
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
                <h3 className="font-bold font-mono">DREAM_PRIVACY</h3>
                <div className="text-sm text-muted-foreground font-mono">--yours-alone</div>
              </div>
            </div>
            <p className="text-muted-foreground font-sans text-sm">
              <strong>Your dreams are sacred.</strong> Private sessions, zero tracking, 
              no corporate surveillance. What you create is <em>yours to keep</em> - not ours to monetize.
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
            DREAM_SPECIFICATIONS
          </h2>
          <p className="text-muted-foreground font-sans">
            Enterprise-level power at coffee shop pricing
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-background/50 border-primary/20 p-6">
            <h3 className="text-xl font-bold font-mono mb-4 text-primary">
              AI_CAPABILITIES
            </h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dream Analysis:</span>
                <span className="text-chart-2">DEEP_LEARNING</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Task Automation:</span>
                <span className="text-chart-2">FULL_BROWSER</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Response Speed:</span>
                <span className="text-chart-2">INSTANT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Learning Mode:</span>
                <span className="text-chart-2">YOUR_STYLE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dream Scaling:</span>
                <span className="text-chart-2">UNLIMITED</span>
              </div>
            </div>
          </Card>

          <Card className="bg-background/50 border-primary/20 p-6">
            <h3 className="text-xl font-bold font-mono mb-4 text-primary">
              ACCESSIBILITY_PROMISE
            </h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="text-foreground">JUST_ONE_DOLLAR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dream Equality:</span>
                <span className="text-foreground">FOR_EVERYONE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">No Subscriptions:</span>
                <span className="text-foreground">NEVER</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hidden Fees:</span>
                <span className="text-foreground">ZERO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dream Support:</span>
                <span className="text-foreground">24/7</span>
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
            READY_TO_DREAM?
          </h2>
          <p className="text-xl text-muted-foreground font-sans max-w-2xl mx-auto">
            <strong>Just one dollar</strong> to accelerate your dreams. <span className="text-primary">Because that's all it should cost.</span>
          </p>
        </div>
        
        <Card className="bg-background/90 border-primary/30 max-w-2xl mx-auto">
          <div className="bg-card border-b border-primary/20 p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-chart-3" />
              <div className="w-3 h-3 rounded-full bg-chart-2" />
              <div className="ml-4 text-sm font-mono text-muted-foreground">
                dream_pricing.json
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="text-6xl font-bold text-primary font-mono phosphor-text">$1</div>
              <div className="text-lg font-mono text-muted-foreground">
                24_HOUR_DREAM_SESSION
              </div>
              
              <div className="bg-card/50 rounded border border-primary/10 p-4 space-y-2 text-left font-mono text-sm">
                <div className="text-muted-foreground">// Dream Package includes:</div>
                <div className="text-chart-2">✓ Full AI agent ownership (24 hours yours)</div>
                <div className="text-chart-2">✓ Unlimited dream exploration (no restrictions)</div>
                <div className="text-chart-2">✓ Complete browser automation (real tasks)</div>
                <div className="text-chart-2">✓ Zero surveillance (your privacy protected)</div>
                <div className="text-chart-2">✓ Dream acceleration guaranteed (or refund)</div>
              </div>
              
              <Button 
                size="lg" 
                className="w-full text-lg py-6 font-mono"
                onClick={onStartPayment}
                data-testid="button-initialize-payment"
              >
                <Command className="w-5 h-5 mr-2" />
                START YOUR DREAM • $1
              </Button>
            </div>
          </div>
        </Card>

        <div className="text-sm text-muted-foreground font-mono space-y-1">
          <div>Dreams for everyone • Not just the wealthy • Your breakthrough awaits</div>
          <div>One dollar can change a life • Why should AI cost more?</div>
        </div>
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
                dream_support.sh
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="text-primary font-mono text-sm">
                $ contact --support --dream-acceleration
              </div>
              <div className="text-muted-foreground font-mono text-sm space-y-2">
                <div>Connecting to dream support network...</div>
                <div>Dream acceleration support: <span className="text-chart-2">ACTIVE</span></div>
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
                  href="mailto:dreams@agentforall.ai" 
                  className="font-mono text-sm text-primary hover:text-primary/80 transition-colors"
                  data-testid="link-email"
                >
                  dreams@agentforall.ai
                </a>
              </div>
            </div>
            
            <div className="text-xs font-mono text-muted-foreground">
              Dream support channels active • Affordable AI advocacy ready
            </div>
          </div>
        </Card>
        
        <div className="text-center space-y-2 text-sm font-mono text-muted-foreground">
          <div>AGENT FOR ALL © 2025 • <span className="text-primary">Making AI dreams accessible to everyone</span></div>
          <div>Built by dreamers who believe $1 can change a life</div>
        </div>
      </div>
    </div>
  );
}

// About Section with 3 Hacker Windows
function AboutSection() {
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [matrixEffect, setMatrixEffect] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [showColorInput, setShowColorInput] = useState(false);
  const [showColorChoice, setShowColorChoice] = useState(false);
  const [textReady, setTextReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fontSize, setFontSize] = useState('text-base');
  const [fontStyle, setFontStyle] = useState('font-mono');
  const [showSettings, setShowSettings] = useState(false);
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const handleCardClick = (cardType: string) => {
    setActivePopup(cardType);
    setMatrixEffect(true);
    setTypewriterText('');
    setShowSkipButton(false);
    setShowColorChoice(true);
    setTextReady(false);
    setCustomColor('');
    setShowSettings(false);
    
    // Start matrix effect
    setTimeout(() => {
      setMatrixEffect(false);
      setShowColorChoice(true);
    }, 2000);
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const startTypewriterEffect = (cardType: string) => {
    // Clear any existing typewriter interval
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    const texts = {
      project: `$ ./announce_project --whitelist
// 🚀 PROJECT ANNOUNCEMENT 🚀
// ==========================

🎉 BREAKING: Revolutionary AI Platform Launched!
// =============================================

🔥 EXCLUSIVE WHITELIST ACCESS 🔥
// =============================
• Early access to cutting-edge AI technology
• Priority support and exclusive features
• Limited spots available - first come, first served
• Join the future of AI before everyone else

💎 PREMIUM FEATURES UNLOCKED
// ==========================
• Advanced AI agent integration
• Real-time browser automation
• VNC streaming capabilities
• Multi-agent orchestration
• Enterprise-grade security

🎯 WHY JOIN OUR WHITELIST?
// ========================
• Be among the first to experience next-gen AI
• Exclusive access to beta features
• Direct feedback channel to developers
• Early bird pricing advantages
• Community of AI pioneers

⚡ LIMITED TIME OFFER ⚡
// ====================
• Only 1000 whitelist spots available
• Registration closes in 48 hours
• Don't miss your chance to be part of history

// Ready to revolutionize your workflow?
// Join the whitelist now!`,
      concept: `$ ./reveal_vision --revolutionary
// 🌟 REVOLUTIONARY VISION 🌟
// ==========================

🚀 THE FUTURE OF AI IS HERE!
// ==========================

💡 BREAKTHROUGH TECHNOLOGY
// ========================
• First-of-its-kind AI agent platform
• Revolutionary browser automation
• Real-time AI-human collaboration
• Next-generation workflow optimization
• Game-changing productivity boost

🎯 MISSION: DEMOCRATIZE AI
// ========================
• Make advanced AI accessible to everyone
• Break down barriers to AI adoption
• Empower individuals and businesses
• Create equal opportunities
• Transform how we work and live

⚡ REVOLUTIONARY FEATURES
// =======================
• Multi-agent AI orchestration
• Real-time browser control
• VNC streaming integration
• Advanced automation capabilities
• Enterprise-grade security

🌟 WHY THIS CHANGES EVERYTHING
// =============================
• No more complex AI setup
• Instant productivity gains
• Seamless human-AI collaboration
• Revolutionary user experience
• The future is now

// Join the AI revolution!
// Be part of something bigger!`,
      collaboration: `$ ./join_community --exclusive
// 🤝 EXCLUSIVE COMMUNITY ACCESS 🤝
// =================================

🎉 JOIN THE ELITE WHITELIST COMMUNITY!
// ====================================

🔥 EXCLUSIVE BENEFITS FOR WHITELIST MEMBERS
// ========================================
• Direct access to development team
• Early access to new features
• Exclusive community channels
• Priority customer support
• Special pricing and discounts

💎 PREMIUM COMMUNITY FEATURES
// ===========================
• Private Discord server access
• Monthly AMA sessions with founders
• Exclusive beta testing opportunities
• Community-driven feature requests
• Networking with like-minded innovators

🚀 PARTNERSHIP OPPORTUNITIES
// ===========================
• Strategic business partnerships
• Joint venture possibilities
• Revenue sharing programs
• Co-marketing opportunities
• Technical collaboration projects

🌟 WHY JOIN OUR COMMUNITY?
// ========================
• Connect with AI pioneers
• Shape the future of technology
• Access to exclusive resources
• Be part of something revolutionary
• Network with industry leaders

⚡ LIMITED SPOTS AVAILABLE
// =======================
• Only 1000 community members
• Exclusive whitelist access
• First-come, first-served basis
• Don't miss your chance!

// Ready to join the revolution?
// Apply for whitelist access now!

// 🎨 PROJECT DISCOVERED:
// ======================
// NAME: tokensclubhouse
// VISION: NFT Revival Technology
// MISSION: Transform static images → Living characters
// INTEGRATION: Mobile + AI technology
// REVOLUTION: Your NFTs will breathe, move, and interact

// 🚀 TECHNOLOGY BREAKTHROUGH:
// ===========================
// • Static NFT images → Living characters
// • AI-powered animation system
// • Mobile-first experience
// • Real-time character interaction
// • Blockchain + AI integration

// 🎁 DISCOVERY REWARDS:
// =====================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎪 PUZZLE SOLVED! 🎉
// ====================
// You've discovered the future of NFTs!
// Ready to bring your digital art to life?

// 🔗 DISCOVER THE PROJECT:
// ========================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎮 GAME COMPLETE! 🎉
// ===================
// You've unlocked the mystery!
// Ready to bring your NFTs to life?

// 🎨 PROJECT DISCOVERED:
// ======================
// NAME: tokensclubhouse
// VISION: NFT Revival Technology
// MISSION: Transform static images → Living characters
// INTEGRATION: Mobile + AI technology
// REVOLUTION: Your NFTs will breathe, move, and interact

// 🚀 TECHNOLOGY BREAKTHROUGH:
// ===========================
// • Static NFT images → Living characters
// • AI-powered animation system
// • Mobile-first experience
// • Real-time character interaction
// • Blockchain + AI integration

// 🎁 DISCOVERY REWARDS:
// =====================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎪 PUZZLE SOLVED! 🎉
// ====================
// You've discovered the future of NFTs!
// Ready to bring your digital art to life?
// 🔗 DISCOVER THE PROJECT:
// ========================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎮 GAME COMPLETE! 🎉
// ===================
// You've unlocked the mystery!
// Ready to bring your NFTs to life?`
    };

    const text = texts[cardType as keyof typeof texts] || '';
    let index = 0;
    setShowSkipButton(true);
    
    typewriterIntervalRef.current = setInterval(() => {
      if (index < text.length) {
        setTypewriterText(text.slice(0, index + 1));
        index++;
      } else {
        if (typewriterIntervalRef.current) {
          clearInterval(typewriterIntervalRef.current);
          typewriterIntervalRef.current = null;
        }
      }
    }, 30);
  };

  const skipTypewriter = () => {
    // Clear any existing typewriter interval
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    const texts = {
      project: `$ ./announce_project --whitelist
// 🚀 PROJECT ANNOUNCEMENT 🚀
// ==========================

🎉 BREAKING: Revolutionary AI Platform Launched!
// =============================================

🔥 EXCLUSIVE WHITELIST ACCESS 🔥
// =============================
• Early access to cutting-edge AI technology
• Priority support and exclusive features
• Limited spots available - first come, first served
• Join the future of AI before everyone else

💎 PREMIUM FEATURES UNLOCKED
// ==========================
• Advanced AI agent integration
• Real-time browser automation
• VNC streaming capabilities
• Multi-agent orchestration
• Enterprise-grade security

🎯 WHY JOIN OUR WHITELIST?
// ========================
• Be among the first to experience next-gen AI
• Exclusive access to beta features
• Direct feedback channel to developers
• Early bird pricing advantages
• Community of AI pioneers

⚡ LIMITED TIME OFFER ⚡
// ====================
• Only 1000 whitelist spots available
• Registration closes in 48 hours
• Don't miss your chance to be part of history

// Ready to revolutionize your workflow?
// Join the whitelist now!`,
      concept: `$ ./reveal_vision --revolutionary
// 🌟 REVOLUTIONARY VISION 🌟
// ==========================

🚀 THE FUTURE OF AI IS HERE!
// ==========================

💡 BREAKTHROUGH TECHNOLOGY
// ========================
• First-of-its-kind AI agent platform
• Revolutionary browser automation
• Real-time AI-human collaboration
• Next-generation workflow optimization
• Game-changing productivity boost

🎯 MISSION: DEMOCRATIZE AI
// ========================
• Make advanced AI accessible to everyone
• Break down barriers to AI adoption
• Empower individuals and businesses
• Create equal opportunities
• Transform how we work and live

⚡ REVOLUTIONARY FEATURES
// =======================
• Multi-agent AI orchestration
• Real-time browser control
• VNC streaming integration
• Advanced automation capabilities
• Enterprise-grade security

🌟 WHY THIS CHANGES EVERYTHING
// =============================
• No more complex AI setup
• Instant productivity gains
• Seamless human-AI collaboration
• Revolutionary user experience
• The future is now

// Join the AI revolution!
// Be part of something bigger!`,
      collaboration: `$ ./join_community --exclusive
// 🤝 EXCLUSIVE COMMUNITY ACCESS 🤝
// =================================

🎉 JOIN THE ELITE WHITELIST COMMUNITY!
// ====================================

🔥 EXCLUSIVE BENEFITS FOR WHITELIST MEMBERS
// ========================================
• Direct access to development team
• Early access to new features
• Exclusive community channels
• Priority customer support
• Special pricing and discounts

💎 PREMIUM COMMUNITY FEATURES
// ===========================
• Private Discord server access
• Monthly AMA sessions with founders
• Exclusive beta testing opportunities
• Community-driven feature requests
• Networking with like-minded innovators

🚀 PARTNERSHIP OPPORTUNITIES
// ===========================
• Strategic business partnerships
• Joint venture possibilities
• Revenue sharing programs
• Co-marketing opportunities
• Technical collaboration projects

🌟 WHY JOIN OUR COMMUNITY?
// ========================
• Connect with AI pioneers
• Shape the future of technology
• Access to exclusive resources
• Be part of something revolutionary
• Network with industry leaders

⚡ LIMITED SPOTS AVAILABLE
// =======================
• Only 1000 community members
• Exclusive whitelist access
• First-come, first-served basis
• Don't miss your chance!

// Ready to join the revolution?
// Apply for whitelist access now!

// 🎨 PROJECT DISCOVERED:
// ======================
// NAME: tokensclubhouse
// VISION: NFT Revival Technology
// MISSION: Transform static images → Living characters
// INTEGRATION: Mobile + AI technology
// REVOLUTION: Your NFTs will breathe, move, and interact

// 🚀 TECHNOLOGY BREAKTHROUGH:
// ===========================
// • Static NFT images → Living characters
// • AI-powered animation system
// • Mobile-first experience
// • Real-time character interaction
// • Blockchain + AI integration

// 🎁 DISCOVERY REWARDS:
// =====================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎪 PUZZLE SOLVED! 🎉
// ====================
// You've discovered the future of NFTs!
// Ready to bring your digital art to life?

// 🔗 DISCOVER THE PROJECT:
// ========================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎮 GAME COMPLETE! 🎉
// ===================
// You've unlocked the mystery!
// Ready to bring your NFTs to life?

// 🎨 PROJECT DISCOVERED:
// ======================
// NAME: tokensclubhouse
// VISION: NFT Revival Technology
// MISSION: Transform static images → Living characters
// INTEGRATION: Mobile + AI technology
// REVOLUTION: Your NFTs will breathe, move, and interact

// 🚀 TECHNOLOGY BREAKTHROUGH:
// ===========================
// • Static NFT images → Living characters
// • AI-powered animation system
// • Mobile-first experience
// • Real-time character interaction
// • Blockchain + AI integration

// 🎁 DISCOVERY REWARDS:
// =====================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎪 PUZZLE SOLVED! 🎉
// ====================
// You've discovered the future of NFTs!
// Ready to bring your digital art to life?
// 🔗 DISCOVER THE PROJECT:
// ========================
// 🌐 Website: www.tokensclubhouse.com
// 🐦 Twitter: @tokensclubhouse
// 📱 Mobile integration ready
// 🤖 AI character system active

// 🎮 GAME COMPLETE! 🎉
// ===================
// You've unlocked the mystery!
// Ready to bring your NFTs to life?`
    };
    
    setTypewriterText(texts[activePopup as keyof typeof texts] || '');
    setShowSkipButton(false);
  };

  const closePopup = () => {
    // Clear any existing typewriter interval
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    
    setActivePopup(null);
    setMatrixEffect(false);
    setTypewriterText('');
    setShowSkipButton(false);
    setShowColorInput(false);
    setShowColorChoice(false);
    setTextReady(false);
    setCustomColor('');
  };

  const handleColorInput = (color: string) => {
    setCustomColor(color);
    setShowColorInput(false);
  };

  const handleColorChoice = (color: string) => {
    setCustomColor(color);
    setShowColorChoice(false);
    setTextReady(true);
    startTypewriterEffect(activePopup!);
  };


  const handleSkipColorChoice = () => {
    setShowColorChoice(false);
    setTextReady(true);
    startTypewriterEffect(activePopup!);
  };

  const handleStartReading = () => {
    setShowColorChoice(false);
    setTextReady(true);
    startTypewriterEffect(activePopup!);
  };

  const getTextColor = () => {
    // Simple color mapping for text
    if (customColor) {
      const colorMap: { [key: string]: string } = {
        'red': 'text-red-400',
        'blue': 'text-blue-400',
        'green': 'text-green-400',
        'yellow': 'text-yellow-400',
        'purple': 'text-purple-400',
        'pink': 'text-pink-400',
        'cyan': 'text-cyan-400',
        'orange': 'text-orange-400',
        'white': 'text-white',
        'black': 'text-black',
        'gray': 'text-gray-400'
      };
      return colorMap[customColor.toLowerCase()] || 'text-primary';
    }
    return 'text-primary';
  };




  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">ABOUT_SECTION</h2>
        <p className="text-muted-foreground font-mono">Three information windows available</p>
      </div>

      {/* 3 Hacker Windows - Organized Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        
        {/* Window 1: Project Whitepaper */}
        <Card 
          className="bg-black/50 border-primary/20 hover:border-primary/40 hover:bg-black/60 cursor-pointer transition-all duration-300 hover:scale-105 h-64"
          onClick={() => handleCardClick('project')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-mono text-primary ml-2 font-bold">project_info.exe</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              <div className="font-mono text-xs">
                <div className="text-primary font-semibold mb-2">$ ./view_whitepaper --details</div>
                <div className="space-y-1">
                  <div className="text-chart-2 font-medium">// Technical documentation</div>
                  <div className="text-chart-2 font-medium">// Architecture overview</div>
                  <div className="text-chart-2 font-medium">// Implementation details</div>
                  <div className="text-chart-2 font-medium">// API specifications</div>
                  <div className="text-chart-2 font-medium">// Deployment guide</div>
                </div>
                <div className="text-muted-foreground text-xs mt-3 font-medium">// Comprehensive project info</div>
                <div className="text-primary text-xs mt-2 font-bold">Click to view →</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Window 2: Project Concept */}
        <Card 
          className="bg-black/50 border-primary/20 hover:border-primary/40 hover:bg-black/60 cursor-pointer transition-all duration-300 hover:scale-105 h-64"
          onClick={() => handleCardClick('concept')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-mono text-primary ml-2 font-bold">concept_info.exe</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              <div className="font-mono text-xs">
                <div className="text-primary font-semibold mb-2">$ ./view_concept --overview</div>
                <div className="space-y-1">
                  <div className="text-chart-2 font-medium">// Project vision</div>
                  <div className="text-chart-2 font-medium">// Core principles</div>
                  <div className="text-chart-2 font-medium">// Mission statement</div>
                  <div className="text-chart-2 font-medium">// Target audience</div>
                  <div className="text-chart-2 font-medium">// Value proposition</div>
                </div>
                <div className="text-muted-foreground text-xs mt-3 font-medium">// Project concept details</div>
                <div className="text-primary text-xs mt-2 font-bold">Click to view →</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Window 3: Collaboration */}
        <Card 
          className="bg-black/50 border-primary/20 hover:border-primary/40 hover:bg-black/60 cursor-pointer transition-all duration-300 hover:scale-105 h-64"
          onClick={() => handleCardClick('collaboration')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-mono text-primary ml-2 font-bold">collaboration_info.exe</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              <div className="font-mono text-xs">
                <div className="text-primary font-semibold mb-2">$ ./view_collaboration --partners</div>
                <div className="space-y-1">
                  <div className="text-chart-2 font-medium">// Partner network</div>
                  <div className="text-chart-2 font-medium">// Collaboration opportunities</div>
                  <div className="text-chart-2 font-medium">// Integration possibilities</div>
                  <div className="text-chart-2 font-medium">// Partnership benefits</div>
                  <div className="text-chart-2 font-medium">// Contact information</div>
                </div>
                <div className="text-muted-foreground text-xs mt-3 font-medium">// Collaboration details</div>
                <div className="text-primary text-xs mt-2 font-bold">Click to view →</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center space-y-2 text-sm font-mono text-muted-foreground">
        <div>ABOUT_SECTION_READY • <span className="text-primary">Three information windows available</span></div>
        <div>Click any card to view detailed information</div>
      </div>

      {/* Popup Windows */}
      {activePopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          {/* Matrix Effect Overlay */}
          {matrixEffect && (
            <div className="absolute inset-0 bg-green-500/10 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/20 to-transparent animate-pulse"></div>
            </div>
          )}
          
          {/* Popup Window */}
          <div className={`relative w-full ${isExpanded ? 'max-w-none w-screen h-screen fixed inset-0 z-50' : 'max-w-6xl mx-4'} bg-black/95 border border-primary/30 rounded-lg overflow-hidden`}>
            {/* Window Header */}
            <div className="flex items-center justify-between p-4 border-b border-primary/20">
              <div className="flex items-center gap-2">
                {activePopup === 'project' && (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-mono text-primary ml-2">project_analysis.exe</span>
                  </>
                )}
                {activePopup === 'concept' && (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-mono text-primary ml-2">concept_analysis.exe</span>
                  </>
                )}
                {activePopup === 'collaboration' && (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-mono text-primary ml-2">collaboration_analysis.exe</span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {/* Settings Button */}
                <button
                  onClick={handleSettingsClick}
                  className="px-2 py-1 text-xs font-mono bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-primary transition-colors"
                  title="Settings"
                >
                  ⚙️
                </button>
                
                {/* Social Media Icons */}
                <a href="https://www.website.com" target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs font-mono bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-primary transition-colors" title="Website">
                  🌐
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs font-mono bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-primary transition-colors" title="Twitter">
                  🐦
                </a>
                <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs font-mono bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-primary transition-colors" title="Telegram">
                  📱
                </a>
                
                {/* Simple Control Buttons */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-2 py-1 text-xs font-mono bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-primary transition-colors"
                >
                  {isExpanded ? '⤓' : '⤢'}
                </button>
                <button
                  onClick={closePopup}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Window Content */}
            <div className={`p-8 ${isExpanded ? 'h-full' : 'max-h-[600px]'} overflow-y-auto`}>
              {/* Color Selection */}
              {showColorChoice && !textReady && (
                <div className="text-center space-y-6">
                  <div className="text-lg font-mono text-primary mb-6">Choose Text Color</div>
                  
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {['pink', 'red', 'white', 'blue', 'green', 'yellow', 'purple', 'cyan', 'orange'].map(color => (
                      <button
                        key={color}
                        onClick={() => handleColorChoice(color)}
                        className="px-6 py-3 rounded text-sm font-mono transition-colors border bg-black/30 text-muted-foreground hover:bg-primary/20 hover:text-primary border-primary/30 hover:border-primary/50"
                      >
                        {color}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4 justify-center mt-8">
                    <button
                      onClick={handleSkipColorChoice}
                      className="bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded px-6 py-2 text-sm font-mono text-primary transition-colors"
                    >
                      $ continue
                    </button>
                    <button
                      onClick={closePopup}
                      className="bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 rounded px-6 py-2 text-sm font-mono text-gray-400 transition-colors"
                    >
                      $ cancel
                    </button>
                  </div>
                </div>
              )}

               {/* Settings Panel */}
               {showSettings && (
                 <div className="bg-gray-100 border border-gray-300 rounded mb-4 shadow-lg w-full">
                   <div className="bg-gray-200 border-b border-gray-300 px-3 py-2">
                     <div className="flex items-center gap-4 text-sm flex-wrap">
                       {/* Font Size Section */}
                       <div className="flex items-center gap-2 flex-shrink-0">
                         <span className="text-gray-700 font-medium">Size:</span>
                         <div className="flex gap-1 flex-wrap">
                           {['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'].map((size) => (
                             <button
                               key={size}
                               onClick={() => setFontSize(size)}
                               className={`px-2 py-1 text-xs rounded border ${
                                 fontSize === size 
                                   ? 'bg-blue-100 border-blue-300 text-blue-700' 
                                   : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                               }`}
                             >
                               {size.replace('text-', '').toUpperCase()}
                             </button>
                           ))}
                         </div>
                       </div>
                       
                       {/* Font Style Section */}
                       <div className="flex items-center gap-2 flex-shrink-0">
                         <span className="text-gray-700 font-medium">Style:</span>
                         <div className="flex gap-1 flex-wrap">
                           {[
                             { value: 'font-mono', label: 'Mono' },
                             { value: 'font-sans font-medium', label: 'Sans' },
                             { value: 'font-serif font-medium', label: 'Serif' },
                             { value: 'font-mono font-bold', label: 'Bold' }
                           ].map((style) => (
                             <button
                               key={style.value}
                               onClick={() => setFontStyle(style.value)}
                               className={`px-2 py-1 text-xs rounded border ${
                                 fontStyle === style.value 
                                   ? 'bg-blue-100 border-blue-300 text-blue-700' 
                                   : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                               }`}
                             >
                               {style.label}
                             </button>
                           ))}
                         </div>
                       </div>
                       
                       {/* Color Section */}
                       <div className="flex items-center gap-2 flex-shrink-0">
                         <span className="text-gray-700 font-medium">Color:</span>
                         <div className="flex gap-1 flex-wrap">
                           {['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'cyan', 'orange', 'white'].map((color) => (
                             <button
                               key={color}
                               onClick={() => setCustomColor(color)}
                               className={`px-2 py-1 text-xs rounded border ${
                                 customColor === color 
                                   ? 'bg-blue-100 border-blue-300 text-blue-700' 
                                   : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                               }`}
                             >
                               {color.charAt(0).toUpperCase() + color.slice(1)}
                             </button>
                           ))}
                         </div>
                       </div>
                       
                       {/* Action Buttons */}
                       <div className="flex gap-2 ml-auto flex-shrink-0">
                         <button
                           onClick={() => setShowSettings(false)}
                           className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-xs rounded border border-blue-600 transition-colors"
                         >
                           Apply
                         </button>
                         <button
                           onClick={() => setShowSettings(false)}
                           className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 text-xs rounded border border-gray-400 transition-colors"
                         >
                           Cancel
                         </button>
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               {/* Text Content */}
               {textReady && (
                 <>
                   <div className={`${fontStyle} ${fontSize} whitespace-pre-wrap leading-relaxed antialiased ${getTextColor()} tracking-wide`}>
                     {typewriterText}
                   </div>
                   
                   {/* Controls */}
                   <div className="mt-4 flex flex-wrap gap-2 justify-center">
                     {showSkipButton && (
                       <button
                         onClick={skipTypewriter}
                         className="bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded px-3 py-1 text-xs font-mono text-primary transition-colors"
                       >
                         $ skip
                       </button>
                     )}
                     
                     <button
                       onClick={closePopup}
                       className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded px-3 py-1 text-xs font-mono text-red-400 transition-colors"
                     >
                       $ exit
                     </button>
                   </div>
                 </>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}