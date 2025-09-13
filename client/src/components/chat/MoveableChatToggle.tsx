import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  MessageSquare, 
  Minimize2,
  Zap,
  Code,
  CreditCard,
  Shield,
  Mail,
  ChevronRight,
  Activity
} from 'lucide-react';

interface MoveableChatToggleProps {
  onViralCommand: (command: string, data?: any) => void;
}

interface HistoryEntry {
  text: string;
  color: string;
  isCommand?: boolean;
}

interface Position {
  x: number;
  y: number;
}

export function MoveableChatToggle({ onViralCommand }: MoveableChatToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  
  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Handle dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === toggleRef.current || toggleRef.current?.contains(e.target as Node)) {
      const rect = toggleRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      e.preventDefault();
    }
  };

  const addToHistory = (text: string, isCommand = false, color = 'default') => {
    const colorClass = color === 'success' ? 'text-chart-2' : 
                       color === 'error' ? 'text-destructive' :
                       color === 'command' ? 'text-primary' : 'text-muted-foreground';
    setHistory(prev => [...prev, { text, color: colorClass, isCommand }]);
  };

  const executeViralCommand = (command: string) => {
    const cmd = command.toLowerCase().trim();
    addToHistory(`> ${command}`, true, 'command');

    // Short command aliases
    const aliasMap: { [key: string]: string } = {
      'h': 'hero',
      'f': 'features', 
      'p': 'pricing',
      's': 'specs',
      'c': 'contact',
      'all': 'reveal all',
      't': 'themes'
    };

    const actualCmd = aliasMap[cmd] || cmd;

    // DISCOVERY COMMANDS - Web App Sections
    if (actualCmd === 'hero' || actualCmd === 'main') {
      setIsLoading(true);
      addToHistory('Loading hero section...', false, 'success');
      onViralCommand('show_hero');
      setTimeout(() => setIsLoading(false), 1000);
      
    } else if (actualCmd === 'features') {
      setIsLoading(true);
      addToHistory('Loading features...', false, 'success');
      onViralCommand('show_features');
      setTimeout(() => setIsLoading(false), 1000);
      
    } else if (actualCmd === 'pricing') {
      setIsLoading(true);
      addToHistory('Loading pricing...', false, 'success');
      onViralCommand('show_pricing');
      setTimeout(() => setIsLoading(false), 1000);
      
    } else if (actualCmd === 'specs') {
      setIsLoading(true);
      addToHistory('Loading technical specs...', false, 'success');
      onViralCommand('show_specs');
      setTimeout(() => setIsLoading(false), 1000);
      
    } else if (actualCmd === 'contact') {
      setIsLoading(true);
      addToHistory('Loading contact info...', false, 'success');
      onViralCommand('show_contact');
      setTimeout(() => setIsLoading(false), 1000);
      
    } else if (actualCmd === 'reveal all' || actualCmd === 'all') {
      addToHistory('Revealing complete interface...', false, 'success');
      onViralCommand('show_all');
      
    } else if (actualCmd === 'themes') {
      addToHistory('Available themes:', false, 'success');
      addToHistory('  default - Default Blue', false);
      addToHistory('  neon    - Neon Green', false);
      addToHistory('  purple  - Electric Purple', false);
      addToHistory('Usage: theme <name>', false);

    // HELP COMMAND
    } else if (cmd === 'help' || cmd === '?') {
      addToHistory('DISCOVERY COMMANDS:', false, 'success');
      addToHistory('  h        - Show hero section', false);
      addToHistory('  f        - Show features', false);
      addToHistory('  p        - Show pricing', false);
      addToHistory('  s        - Show specs', false);
      addToHistory('  c        - Show contact', false);
      addToHistory('  all      - Reveal everything', false);
      addToHistory('  t        - List themes', false);
      addToHistory('', false);
      addToHistory('Try: "h" for hero or "p" for pricing!', false);

    // Handle theme commands
    } else if (cmd.startsWith('theme ')) {
      const themeName = cmd.split(' ')[1];
      addToHistory(`Switching to ${themeName} theme...`, false, 'success');
      // Theme switching logic would go here
      
    } else {
      // Try to understand intent
      if (cmd.includes('show') || cmd.includes('display')) {
        if (cmd.includes('hero')) {
          executeViralCommand('h');
        } else if (cmd.includes('feature')) {
          executeViralCommand('f');
        } else if (cmd.includes('pricing')) {
          executeViralCommand('p');
        } else if (cmd.includes('specs')) {
          executeViralCommand('s');
        } else if (cmd.includes('contact')) {
          executeViralCommand('c');
        } else {
          addToHistory('Try: h, f, p, s, c or "help"', false, 'error');
        }
      } else {
        addToHistory(`Command not recognized: ${command}`, false, 'error');
        addToHistory('Type "help" or try: h, f, p, s, c', false);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim() && !isLoading) {
      executeViralCommand(input);
      setInput('');
    }
  };

  const handleToggleClick = () => {
    if (!isDragging) {
      setIsExpanded(!isExpanded);
      if (!isExpanded && history.length === 0) {
        // Show welcome message when first opened
        setTimeout(() => {
          addToHistory('Welcome to Agent For All!', false, 'success');
          addToHistory('Type "h" for hero, "p" for pricing!', false);
          addToHistory('Or try "help" for all commands.', false);
        }, 100);
      }
    }
  };

  return (
    <div 
      className="fixed z-50"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {!isExpanded ? (
        // Minimized floating toggle
        <div
          ref={toggleRef}
          className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-primary/30 rounded-full px-4 py-2 shadow-lg hover-elevate active-elevate-2 transition-all duration-200"
          onMouseDown={handleMouseDown}
          onClick={handleToggleClick}
          data-testid="chat-toggle-button"
        >
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="text-sm font-mono text-primary hidden sm:inline">
            Explore AI
          </span>
          <Badge variant="secondary" className="text-xs animate-pulse">
            $1
          </Badge>
        </div>
      ) : (
        // Expanded chat interface
        <Card className="w-80 bg-background/95 backdrop-blur-sm border-primary/30 terminal-window crt-screen electric-glow">
          <div 
            ref={toggleRef}
            className="bg-card border-b border-primary/20 p-3 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="ml-2 text-sm font-mono text-primary">
                  discovery_terminal.exe
                </div>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                data-testid="button-minimize-chat"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="p-4">
            {/* Chat History */}
            <div 
              ref={chatRef}
              className="min-h-[150px] max-h-[300px] overflow-y-auto space-y-1 text-sm font-mono mb-4 scroll-smooth"
            >
              {history.length === 0 && (
                <div className="text-center space-y-2 text-muted-foreground">
                  <Terminal className="w-6 h-6 text-primary mx-auto" />
                  <div>Explore our AI platform!</div>
                  <div className="text-xs">Try "h" for hero or "p" for pricing</div>
                </div>
              )}
              
              {history.map((entry, index) => (
                <div key={index} className={entry.color}>
                  {entry.text}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-primary animate-pulse">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="ml-2">Loading section...</span>
                </div>
              )}
            </div>

            {/* Command Input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-primary">{'>'}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none outline-none text-foreground font-mono placeholder:text-muted-foreground text-sm"
                  placeholder="Try: h, f, p, s, or c"
                  data-testid="input-viral-command"
                />
              </div>
              
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => executeViralCommand('h')}
                  disabled={isLoading}
                  className="text-xs h-6 px-2"
                  data-testid="button-quick-hero"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Hero
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => executeViralCommand('f')}
                  disabled={isLoading}
                  className="text-xs h-6 px-2"
                  data-testid="button-quick-features"
                >
                  <Code className="w-3 h-3 mr-1" />
                  Features
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => executeViralCommand('p')}
                  disabled={isLoading}
                  className="text-xs h-6 px-2"
                  data-testid="button-quick-pricing"
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  Pricing
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground text-center">
                Drag me around • Discover our platform!
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}