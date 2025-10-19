import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useLocation } from 'wouter';
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
  Maximize2,
  Bot,
  Settings
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
    @@@@@@@@@@#%#+#:
      @@@@@@@@@@@
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
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [, setLocation] = useLocation();

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

  // About Section with 3 Hacker Windows
  const AboutSection = () => {
    const handleCardClick = (cardType: string) => {
      setActivePopup(cardType);
      setMatrixEffect(true);
      setTypewriterText('');
      setShowSkipButton(false);
      setShowColorChoice(true);
      setTextReady(false);
      setCustomColor('');
      setShowSettings(false);

      // Play matrix effect briefly, then keep user on the page
      setTimeout(() => {
        setMatrixEffect(false);
        setShowColorChoice(true);
        setTextReady(false);
      }, 1200);
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
• Advanced AI agent capabilities
• Real-time browser automation
• Multi-modal AI interactions
• Enterprise-grade security

🚀 GET STARTED NOW
// ================
Ready to revolutionize your workflow? Join the whitelist today!`,
        concept: `$ ./explain_concept --ai-revolution
// 🧠 CONCEPT EXPLANATION 🧠
// =========================

🌟 THE AI REVOLUTION IS HERE
// ===========================
We're not just building another AI tool - we're creating a movement.

💡 CORE PHILOSOPHY
// ================
• AI should be accessible to everyone
• Technology should empower, not exclude
• Community-driven innovation

🚀 WHY IT MATTERS
// ================
AI should be affordable, transparent, and human-centered.
We believe in a future where AI empowers everyone.`,
        collaboration: `$ ./collaborate --dream-team
// 🤝 COLLABORATION INVITATION 🤝
// ==============================

🌟 JOIN THE DREAM TEAM
// ====================
We're not just building a product - we're building a community.

👥 WHO WE'RE LOOKING FOR
// ======================
• Visionaries who see AI's potential
• Builders who want to create impact
• Dreamers who believe in accessibility
• Innovators who think differently

🚀 COLLABORATION OPPORTUNITIES
// ============================
• Technical partnerships
• Community building
• Content creation
• Feedback and testing
• Strategic advisory

💫 TOGETHER WE BUILD
// =================
The future of AI is collaborative. Join us in making AI
accessible to everyone, everywhere, for just $1.

Ready to change the world? Let's build together!`
      };

      setTypewriterText(texts[activePopup as keyof typeof texts] || '');
      setShowSkipButton(false);
      
      let index = 0;
      typewriterIntervalRef.current = setInterval(() => {
        setTypewriterText(texts[cardType as keyof typeof texts].slice(0, index + 1));
        index++;
        
        if (index >= texts[cardType as keyof typeof texts].length) {
          if (typewriterIntervalRef.current) {
            clearInterval(typewriterIntervalRef.current);
            typewriterIntervalRef.current = null;
          }
          setShowSkipButton(true);
        }
      }, 30);
    };

    const skipTypewriter = () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      setShowSkipButton(false);
      setTextReady(true);

      // Immediately reveal full text without redirect
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
• Advanced AI agent capabilities
• Real-time browser automation
• Multi-modal AI interactions
• Enterprise-grade security

🚀 GET STARTED NOW
// ================
Ready to revolutionize your workflow? Join the whitelist today!`,
        concept: `$ ./explain_concept --ai-revolution
// 🧠 CONCEPT EXPLANATION 🧠
// =========================

🌟 THE AI REVOLUTION IS HERE
// ===========================
We're not just building another AI tool - we're creating a movement.

💡 CORE PHILOSOPHY
// ================
• AI should be accessible to everyone
• Technology should empower, not exclude
• Innovation should serve humanity
• The future is collaborative, not competitive

🎯 OUR MISSION
// ============
To democratize AI technology and make it available to anyone,
regardless of their technical background or financial resources.

🌍 IMPACT VISION
// ==============
Imagine a world where:
• Every small business has AI assistance
• Every student can access advanced AI tools
• Every creative can leverage AI for their art
• Every dreamer can build with AI

This is the world we're building.`,
        collaboration: `$ ./collaborate --dream-team
// 🤝 COLLABORATION INVITATION 🤝
// ==============================

🌟 JOIN THE DREAM TEAM
// ====================
We're not just building a product - we're building a community.

👥 WHO WE'RE LOOKING FOR
// ======================
• Visionaries who see AI's potential
• Builders who want to create impact
• Dreamers who believe in accessibility
• Innovators who think differently

🚀 COLLABORATION OPPORTUNITIES
// ============================
• Technical partnerships
• Community building
• Content creation
• Feedback and testing
• Strategic advisory

💫 TOGETHER WE BUILD
// =================
The future of AI is collaborative. Join us in making AI
accessible to everyone, everywhere, for just $1.

Ready to change the world? Let's build together!`
      };

      if (activePopup) {
        setTypewriterText(texts[activePopup as keyof typeof texts] || '');
      }
    };

    const skipTypewriter = () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      setShowSkipButton(false);
      setTextReady(true);
      const routeMap: Record<string, string> = { project: '/classic', concept: '/live', collaboration: '/browser-chat' };
      if (activePopup) {
        setLocation(routeMap[activePopup] || '/classic');
      }
    };

    const handleColorSelect = (color: string) => {
      setCustomColor(color);
      setShowColorChoice(false);
      setTextReady(true);
      startTypewriterEffect(activePopup!);
    };

    const handleColorConfirm = () => {
      setShowColorChoice(false);
      setTextReady(true);
      startTypewriterEffect(activePopup!);
    };

    const handleColorInput = (color: string) => {
      setCustomColor(color);
      setShowColorInput(false);
    };

    const handleColorInputConfirm = (color: string) => {
      setCustomColor(color);
      setShowColorChoice(false);
      setTextReady(true);
      startTypewriterEffect(activePopup!);
    };

    const getTextColor = () => {
      if (customColor) {
        const colorMap: { [key: string]: string } = {
          'red': 'text-red-400',
          'green': 'text-green-400',
          'blue': 'text-blue-400',
          'yellow': 'text-yellow-400',
          'purple': 'text-purple-400',
          'cyan': 'text-cyan-400',
          'pink': 'text-pink-400',
          'orange': 'text-orange-400'
        };
        return colorMap[customColor.toLowerCase()] || 'text-primary';
      }
      return 'text-primary';
    };

    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-primary">About the Project</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover the revolutionary AI platform that's changing how we interact with technology
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Project Card */}
          <div 
            className="bg-card/50 border border-primary/20 rounded-lg p-6 cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            onClick={() => handleCardClick('project')}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Project</h3>
              <p className="text-sm text-muted-foreground">
                Revolutionary AI platform with exclusive whitelist access
              </p>
            </div>
          </div>

          {/* Concept Card */}
          <div 
            className="bg-card/50 border border-primary/20 rounded-lg p-6 cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            onClick={() => handleCardClick('concept')}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Concept</h3>
              <p className="text-sm text-muted-foreground">
                The AI revolution philosophy and mission
              </p>
            </div>
          </div>

          {/* Collaboration Card */}
          <div 
            className="bg-card/50 border border-primary/20 rounded-lg p-6 cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            onClick={() => handleCardClick('collaboration')}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Settings className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Join the dream team and build the future
              </p>
            </div>
          </div>
        </div>
      </div>
    );
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
