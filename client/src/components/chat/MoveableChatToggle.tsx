import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  MessageSquare, 
  Maximize2, 
  Minimize2, 
  X,
  Zap,
  Dog,
  Cat,
  Twitter,
  Instagram,
  Share,
  Bitcoin,
  ChevronRight,
  Rabbit,
  Fish,
  Smartphone,
  Camera,
  Send,
  Users,
  Dice6,
  Trophy,
  Flame,
  Lightbulb,
  Rocket
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

    // VIRAL COMMANDS - Animal Betting
    if (cmd.includes('bet') && cmd.includes('dollar') && cmd.includes('dog')) {
      setIsLoading(true);
      addToHistory('Generating your dog\'s encouragement...', false, 'success');
      onViralCommand('bet_on_dog', { animal: 'dog', amount: 1 });
      setTimeout(() => setIsLoading(false), 1500);
      
    } else if (cmd.includes('bet') && cmd.includes('dollar') && cmd.includes('cat')) {
      setIsLoading(true);
      addToHistory('Your cat believes in you...', false, 'success');
      onViralCommand('bet_on_cat', { animal: 'cat', amount: 1 });
      setTimeout(() => setIsLoading(false), 1500);
      
    } else if (cmd.includes('bet') && cmd.includes('dollar') && cmd.includes('hamster')) {
      setIsLoading(true);
      addToHistory('Even hamsters dream big...', false, 'success');
      onViralCommand('bet_on_hamster', { animal: 'hamster', amount: 1 });
      setTimeout(() => setIsLoading(false), 1500);
      
    } else if (cmd.includes('bet') && cmd.includes('dollar') && cmd.includes('fish')) {
      setIsLoading(true);
      addToHistory('Your fish swims toward your dreams...', false, 'success');
      onViralCommand('bet_on_fish', { animal: 'fish', amount: 1 });
      setTimeout(() => setIsLoading(false), 1500);

    // SOCIAL MEDIA COMMANDS
    } else if (cmd === 'follow us' || cmd === 'social' || cmd === 'links') {
      addToHistory('Opening social media links...', false, 'success');
      onViralCommand('social_links');
      
    } else if (cmd === 'twitter' || cmd === 'x') {
      addToHistory('Taking you to Twitter...', false, 'success');
      onViralCommand('open_twitter');
      
    } else if (cmd === 'instagram' || cmd === 'insta') {
      addToHistory('Opening Instagram...', false, 'success');
      onViralCommand('open_instagram');
      
    } else if (cmd.includes('share') || cmd === 'share this') {
      addToHistory('Creating shareable content...', false, 'success');
      onViralCommand('share_content');
      
    } else if (cmd.includes('tell friends') || cmd.includes('invite')) {
      addToHistory('Generating referral content...', false, 'success');
      onViralCommand('tell_friends');

    // QUICK PAYMENT COMMANDS
    } else if (cmd === 'lucky dollar' || cmd === 'lucky') {
      setIsLoading(true);
      addToHistory('Feeling lucky? Your dreams are the best bet!', false, 'success');
      onViralCommand('lucky_dollar');
      setTimeout(() => setIsLoading(false), 1500);
      
    } else if (cmd.includes('dollar challenge') || cmd === 'challenge') {
      addToHistory('Challenge accepted! Dare your friends...', false, 'success');
      onViralCommand('dollar_challenge');

    // HELP COMMAND
    } else if (cmd === 'help' || cmd === '?') {
      addToHistory('VIRAL COMMANDS:', false, 'success');
      addToHistory('  bet a dollar on your dog', false);
      addToHistory('  bet a dollar on your cat', false);
      addToHistory('  bet a dollar on your hamster', false);
      addToHistory('  lucky dollar', false);
      addToHistory('  follow us', false);
      addToHistory('  twitter', false);
      addToHistory('  share this', false);
      addToHistory('', false);
      addToHistory('Try: "bet a dollar on your dog" for viral magic!', false);

    // EASTER EGG COMMANDS  
    } else if (cmd === 'revolution' || cmd === 'viva la revolución') {
      addToHistory('VIVA LA REVOLUCIÓN! AI FOR ALL!', false, 'success');
      onViralCommand('revolution_mode');
      
    } else {
      // Try to understand intent
      if (cmd.includes('dog') || cmd.includes('puppy')) {
        addToHistory('Did you mean "bet a dollar on your dog"?', false, 'error');
      } else if (cmd.includes('cat') || cmd.includes('kitty')) {
        addToHistory('Try "bet a dollar on your cat"!', false, 'error');
      } else if (cmd.includes('social') || cmd.includes('follow')) {
        addToHistory('Try "follow us" for social media links!', false, 'error');
      } else {
        addToHistory(`Command not recognized: ${command}`, false, 'error');
        addToHistory('Type "help" to see viral commands!', false);
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
          addToHistory('Type "bet a dollar on your dog" to go viral!', false);
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
            Agent Chat
          </span>
          <Badge variant="secondary" className="text-xs animate-pulse">
            NEW
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
                  viral_commands.exe
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
                  <Rocket className="text-primary w-6 h-6 mx-auto" />
                  <div>Ready for viral commands!</div>
                  <div className="text-xs">Try "bet a dollar on your dog"</div>
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
                  <span className="ml-2">Generating magic...</span>
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
                  placeholder="Try: bet a dollar on your dog"
                  data-testid="input-viral-command"
                />
              </div>
              
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => executeViralCommand('bet a dollar on your dog')}
                  disabled={isLoading}
                  className="text-xs h-6 px-2"
                  data-testid="button-quick-dog"
                >
                  <Dog className="w-3 h-3 mr-1" />
                  Dog
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => executeViralCommand('bet a dollar on your cat')}
                  disabled={isLoading}
                  className="text-xs h-6 px-2"
                  data-testid="button-quick-cat"
                >
                  <Cat className="w-3 h-3 mr-1" />
                  Cat
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => executeViralCommand('follow us')}
                  disabled={isLoading}
                  className="text-xs h-6 px-2"
                  data-testid="button-quick-social"
                >
                  <Share className="w-3 h-3 mr-1" />
                  Social
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground text-center">
Drag me around • Try viral commands!
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}