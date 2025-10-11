import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Zap, ArrowRight, CheckCircle, Play, Bot, Monitor, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Animation timing constants
const timing = {
  typeSpeed: 30,        // ms per character
  commandDelay: 200,    // ms before executing
  sectionFade: 300,     // ms section transition
  slideIn: 400,         // ms content slide
  glow: 2000,          // ms glow pulse cycle
};

// Command definitions
const commands = {
  h: { name: 'help', description: 'Show available commands', section: 'hero' },
  f: { name: 'features', description: 'View AI Agent capabilities', section: 'features' },
  p: { name: 'pricing', description: 'View pricing information', section: 'pricing' },
  s: { name: 'specs', description: 'View technical specifications', section: 'specs' },
  c: { name: 'contact', description: 'Get in touch', section: 'contact' },
  a: { name: 'about', description: 'About the system', section: 'about' },
  sound: { name: 'sound', description: 'Toggle sound effects', section: 'sound' },
};

// Matrix background component
const MatrixBackground = () => {
  const [drops, setDrops] = useState<Array<{ id: number; char: string; delay: number }>>([]);

  useEffect(() => {
    const newDrops = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      char: Math.random().toString(36)[2],
      delay: Math.random() * 5 + 3,
    }));
    setDrops(newDrops);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute text-green-500/5 font-mono text-sm"
          style={{ left: `${drop.id * 5}%` }}
          animate={{ y: ['-100%', '100%'] }}
          transition={{
            duration: drop.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {drop.char}
        </motion.div>
      ))}
    </div>
  );
};

// Boot sequence component
const BootSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const bootLines = [
    "> INITIALIZING AI_AGENT_SYSTEM...",
    "> LOADING NEURAL NETWORKS...",
    "> ESTABLISHING SECURE CONNECTION...",
    "> AGENTS ONLINE. AWAITING COMMANDS.",
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentLine < bootLines.length) {
        setCurrentLine(currentLine + 1);
        if (currentLine === 1) {
          // Animate progress bar
          const progressTimer = setInterval(() => {
            setProgress(prev => {
              if (prev >= 100) {
                clearInterval(progressTimer);
                return 100;
              }
              return prev + 2;
            });
          }, 30);
        }
      } else {
        setIsComplete(true);
        setTimeout(onComplete, 1000);
      }
    }, currentLine === 1 ? 2000 : 800);

    return () => clearTimeout(timer);
  }, [currentLine, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-2 font-mono text-green-500"
    >
      {bootLines.slice(0, currentLine + 1).map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          {line}
          {index === 1 && (
            <div className="w-32 h-2 bg-gray-800 rounded overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          )}
        </motion.div>
      ))}
      
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-green-400 mt-4"
        >
            &gt; Type "help" to begin or press any key...
        </motion.div>
      )}
    </motion.div>
  );
};

// Reactive prompt component
const ReactivePrompt = ({ 
  state, 
  input, 
  onInputChange, 
  onKeyDown 
}: { 
  state: 'idle' | 'typing' | 'processing' | 'executed';
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) => {
  const promptTexts = {
    idle: 'AWAITING_INPUT',
    typing: 'PROCESSING',
    processing: 'EXECUTING',
    executed: 'COMMAND_EXECUTED'
  };

  return (
    <motion.div
      className="flex items-center gap-2 font-mono text-green-500"
      animate={{ scale: state === 'typing' ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
    >
        <span className="text-green-500">&gt;</span>
      <motion.span
        className="flex items-center gap-1"
        animate={{ 
          opacity: [1, 0.5, 1],
          textShadow: state === 'typing' ? ['0 0 5px #10b981', '0 0 10px #10b981', '0 0 5px #10b981'] : 'none'
        }}
        transition={{ 
          duration: timing.glow / 1000,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {state === 'executed' && <CheckCircle className="w-4 h-4 text-green-400" />}
        {promptTexts[state]}
      </motion.span>
      <motion.span
        className="w-2 h-4 bg-green-500"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      <input
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="bg-transparent border-none outline-none text-green-500 font-mono flex-1"
        placeholder=""
        autoFocus
      />
    </motion.div>
  );
};

// Mini-map navigation component
const MiniMap = ({ 
  currentSection, 
  onNavigate 
}: { 
  currentSection: string;
  onNavigate: (section: string) => void;
}) => {
  const sections = [
    { key: 'hero', label: 'HERO', shortcut: 'h' },
    { key: 'features', label: 'FEATURES', shortcut: 'f' },
    { key: 'pricing', label: 'PRICING', shortcut: 'p' },
    { key: 'specs', label: 'SPECS', shortcut: 's' },
    { key: 'contact', label: 'CONTACT', shortcut: 'c' },
    { key: 'about', label: 'ABOUT', shortcut: 'a' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm border border-green-500/30 rounded-lg p-3 font-mono text-xs"
    >
      <div className="text-green-400 mb-2 font-bold">┌─ SYSTEM MAP ────┐</div>
      {sections.map((section) => (
        <motion.div
          key={section.key}
          className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer hover:bg-green-500/10 ${
            currentSection === section.key ? 'bg-green-500/20' : ''
          }`}
          onClick={() => onNavigate(section.key)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="flex items-center gap-2">
            {currentSection === section.key ? (
              <CheckCircle className="w-3 h-3 text-green-400" />
            ) : (
              <div className="w-3 h-3 border border-green-500/50 rounded" />
            )}
            <span className="text-green-300">{section.label}</span>
          </span>
          <span className="text-green-500/70">[{section.shortcut}]</span>
        </motion.div>
      ))}
      <div className="text-green-400 mt-2 font-bold">└─────────────────┘</div>
    </motion.div>
  );
};

// Status bar component
const StatusBar = () => {
  const [stats, setStats] = useState({
    agents: 'ONLINE',
    latency: Math.floor(Math.random() * 20) + 5,
    commands: Math.floor(Math.random() * 100) + 1,
    time: new Date().toLocaleTimeString(),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        latency: Math.floor(Math.random() * 20) + 5,
        commands: prev.commands + Math.floor(Math.random() * 3),
        time: new Date().toLocaleTimeString(),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-green-500/30 p-2 font-mono text-xs"
    >
      <div className="flex items-center justify-between text-green-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            AGENTS: {stats.agents}
          </span>
          <span>LATENCY: {stats.latency}ms</span>
          <span>COMMANDS: {stats.commands}</span>
        </div>
        <span>TIME: {stats.time}</span>
      </div>
    </motion.div>
  );
};

// Autocomplete component
const AutocompleteDropdown = ({ 
  input, 
  onSelect 
}: { 
  input: string;
  onSelect: (command: string) => void;
}) => {
  const matches = Object.entries(commands).filter(([key, cmd]) =>
    cmd.name.startsWith(input.toLowerCase()) || key.startsWith(input.toLowerCase())
  );

  if (!input || matches.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-full left-0 right-0 bg-black/95 backdrop-blur-sm border border-green-500/30 rounded-lg p-2 font-mono text-sm z-50"
    >
      {matches.map(([key, cmd]) => (
        <motion.div
          key={key}
          className="flex items-center justify-between py-2 px-3 rounded cursor-pointer hover:bg-green-500/10"
          onClick={() => onSelect(cmd.name)}
          whileHover={{ scale: 1.02 }}
        >
          <span className="text-green-300">{cmd.name}</span>
          <span className="text-green-500/70">{cmd.description}</span>
        </motion.div>
      ))}
    </motion.div>
  );
};

// Keyboard hints component
const KeyboardHints = ({ 
  currentSection, 
  input 
}: { 
  currentSection: string;
  input: string;
}) => {
  const getHints = () => {
    if (!input) {
      return "Hint: Press [h] for help or [?] for shortcuts";
    }
    if (input.length === 1) {
      return "Press [↓] to see more commands or [Enter] to execute";
    }
    if (currentSection !== 'hero') {
      return "Press [Esc] to return or [←→] to navigate sections";
    }
    return "Press [Tab] for autocomplete or [Enter] to execute";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute bottom-12 left-0 right-0 text-center font-mono text-xs text-green-500/70"
    >
      {getHints()}
    </motion.div>
  );
};

// Main enhanced terminal interface
export default function EnhancedTerminalInterface() {
  const [currentSection, setCurrentSection] = useState('hero');
  const [input, setInput] = useState('');
  const [promptState, setPromptState] = useState<'idle' | 'typing' | 'processing' | 'executed'>('idle');
  const [showBootSequence, setShowBootSequence] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle command execution
  const executeCommand = useCallback((command: string) => {
    setPromptState('processing');
    
    // Play sound effect if enabled
    if (soundEnabled) {
      // Add sound effect here
    }

    setTimeout(() => {
      const cmd = commands[command as keyof typeof commands];
      if (cmd) {
        setCurrentSection(cmd.section);
        setPromptState('executed');
        setTimeout(() => {
          setPromptState('idle');
          setInput('');
        }, 1000);
      }
    }, timing.commandDelay);
  }, [soundEnabled]);

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInput(value);
    setPromptState(value ? 'typing' : 'idle');
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      executeCommand(input.trim());
    } else if (e.key === 'Escape') {
      setCurrentSection('hero');
      setInput('');
      setPromptState('idle');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Handle autocomplete
    }
  };

  // Handle checkout
  const handleStartSession = async () => {
    try {
      setIsCreatingCheckout(true);
      
      const csrfResponse = await apiRequest('GET', '/api/csrf-token');
      const { csrfToken } = await csrfResponse.json();

      const response = await apiRequest('POST', '/api/create-checkout-session', {
        csrfToken
      });

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Liberation Protocol Error",
        description: error.message || "Failed to initialize payment gateway",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  // Render section content
  const renderSectionContent = () => {
    switch (currentSection) {
      case 'hero':
        return (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: timing.slideIn / 1000 }}
            className="space-y-8"
          >
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <Badge variant="outline" className="mb-8 px-6 py-3 border-primary/30 bg-primary/10 hover:bg-primary/15 transition-all duration-500 text-sm font-medium">
                  <Terminal className="w-4 h-4 mr-2" />
                  PHOENIX-7742 Agent System
                </Badge>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-7xl font-bold mb-8 bg-gradient-to-r from-primary via-blue-500 to-primary/60 bg-clip-text text-transparent animate-gradient leading-tight"
              >
                AI Browser Agent
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed font-light"
              >
                Autonomous AI agent that controls real browsers with live visual streaming. 
                Watch your tasks execute in real-time with mouse tracking and automation.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center justify-center gap-8 mb-12 flex-wrap"
              >
                <div className="flex items-center gap-3 text-base text-muted-foreground hover:text-green-500 transition-all duration-300 group cursor-pointer">
                  <CheckCircle className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium">Live Browser Control</span>
                  <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </div>
                <div className="flex items-center gap-3 text-base text-muted-foreground hover:text-blue-500 transition-all duration-300 group cursor-pointer">
                  <CheckCircle className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium">Real-time VNC Streaming</span>
                  <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </div>
                <div className="flex items-center gap-3 text-base text-muted-foreground hover:text-purple-500 transition-all duration-300 group cursor-pointer">
                  <CheckCircle className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium">AI-Powered Automation</span>
                  <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <Button 
                  size="lg" 
                  onClick={handleStartSession}
                  disabled={isCreatingCheckout}
                  className="px-12 py-8 text-xl font-semibold hover:scale-105 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/30 group rounded-2xl"
                >
                  {isCreatingCheckout ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                      <span>Initializing Payment...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                      <span>Start 24-Hour Session - $1.00</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  )}
                </Button>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="text-base text-muted-foreground mt-6 font-medium"
              >
                🔒 Secure payment via Stripe • 💯 Full refund if not satisfied
              </motion.p>
            </div>
          </motion.div>
        );

      case 'features':
        return (
          <motion.div
            key="features"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: timing.sectionFade / 1000 }}
            className="grid md:grid-cols-3 gap-10"
          >
            <Card className="p-8 hover:scale-105 hover:shadow-xl hover:shadow-primary/15 transition-all duration-500 group border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-muted/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-500">
                  <Monitor className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Live Browser View</h3>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-lg leading-relaxed">
                Watch the AI agent control browsers in real-time with VNC streaming. 
                See every click, scroll, and interaction as it happens.
              </p>
            </Card>

            <Card className="p-8 hover:scale-105 hover:shadow-xl hover:shadow-primary/15 transition-all duration-500 group border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-muted/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-500">
                  <Bot className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">AI Automation</h3>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-lg leading-relaxed">
                Powered by advanced AI planning and Playwright engine. 
                Handles complex multi-step tasks with precision and reliability.
              </p>
            </Card>

            <Card className="p-8 hover:scale-105 hover:shadow-xl hover:shadow-primary/15 transition-all duration-500 group border-primary/20 hover:border-primary/40 bg-gradient-to-br from-background to-muted/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-500">
                  <Play className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Real-time Updates</h3>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300 text-lg leading-relaxed">
                Live task progress, logs, and status updates via WebSocket. 
                Complete transparency into every automation step.
              </p>
            </Card>
          </motion.div>
        );

      case 'pricing':
        return (
          <motion.div
            key="pricing"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: timing.sectionFade / 1000 }}
            className="text-center"
          >
            <h2 className="text-4xl font-bold mb-8">Pricing</h2>
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-2xl font-bold mb-4">24-Hour Session</h3>
              <div className="text-4xl font-bold text-green-500 mb-4">$1.00</div>
              <p className="text-muted-foreground mb-6">
                Full access to AI agent system for 24 hours
              </p>
              <Button 
                onClick={handleStartSession}
                disabled={isCreatingCheckout}
                className="w-full"
              >
                {isCreatingCheckout ? 'Processing...' : 'Start Session'}
              </Button>
            </div>
          </motion.div>
        );

      default:
        return (
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: timing.slideIn / 1000 }}
            className="text-center"
          >
            <h2 className="text-4xl font-bold mb-8 capitalize">{currentSection}</h2>
            <p className="text-muted-foreground">
              This section is under development. More content coming soon!
            </p>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* Matrix Background */}
      <MatrixBackground />
      
      {/* Status Bar */}
      <StatusBar />
      
      {/* Mini Map */}
      <MiniMap currentSection={currentSection} onNavigate={setCurrentSection} />
      
      <div className="container mx-auto px-6 py-20 relative z-10 max-w-7xl">
        {/* Boot Sequence */}
        <AnimatePresence>
          {showBootSequence && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <BootSequence onComplete={() => setShowBootSequence(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Terminal Interface */}
        {!showBootSequence && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/90 backdrop-blur-sm border border-green-500/30 rounded-lg p-6 font-mono"
          >
            {/* Command Prompt */}
            <div className="relative">
              <ReactivePrompt
                state={promptState}
                input={input}
                onInputChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              
              {/* Autocomplete Dropdown */}
              <AutocompleteDropdown
                input={input}
                onSelect={(command) => {
                  setInput(command);
                  executeCommand(command);
                }}
              />
            </div>
            
            {/* Keyboard Hints */}
            <KeyboardHints currentSection={currentSection} input={input} />
          </motion.div>
        )}

        {/* Section Content */}
        <AnimatePresence mode="wait">
          {!showBootSequence && (
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: timing.sectionFade / 1000 }}
              className="mt-8"
            >
              {renderSectionContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
