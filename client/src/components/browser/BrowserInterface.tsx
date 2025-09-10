import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, ChevronUp, ChevronDown, Clock, Zap, Settings, Camera, FileText, MousePointer, ScrollText } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BrowserInterfaceProps {
  sessionId: string;
}

interface Command {
  id: string;
  input: string;
  output?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: Date;
  agent?: string;
}

interface SessionInfo {
  id: string;
  agentId: string;
  expiresAt: string;
  timeRemaining: number;
  isActive: boolean;
}

export function BrowserInterface({ sessionId }: BrowserInterfaceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch session info
  const { data: sessionInfo } = useQuery({
    queryKey: ['browser-session', sessionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/session/${sessionId}`);
      if (!response.ok) throw new Error('Session not found');
      return response.json() as Promise<SessionInfo>;
    },
    refetchInterval: 30000,
  });

  // Send command mutation
  const executeCommand = useMutation({
    mutationFn: async (command: string) => {
      const response = await apiRequest('POST', `/api/browser/${sessionId}/command`, { 
        command,
        timestamp: new Date().toISOString()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute command');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const newCommand: Command = {
        id: data.commandId || Date.now().toString(),
        input: currentCommand,
        status: 'executing',
        timestamp: new Date(),
        agent: data.agent
      };
      
      setCommands(prev => [newCommand, ...prev]);
      setCurrentCommand('');
      
      // Simulate command execution progression
      setTimeout(() => {
        setCommands(prev => 
          prev.map(cmd => 
            cmd.id === newCommand.id 
              ? { ...cmd, status: 'completed' as const, output: data.result || 'Task completed successfully' }
              : cmd
          )
        );
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Command Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update time remaining
  useEffect(() => {
    if (sessionInfo) {
      setTimeRemaining(sessionInfo.timeRemaining);
      
      const interval = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [sessionInfo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
        e.preventDefault();
        setIsExpanded(prev => !prev);
        if (!isExpanded && inputRef.current) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
      if (e.code === 'Escape') {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isExpanded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCommand.trim() || executeCommand.isPending) return;
    executeCommand.mutate(currentCommand.trim());
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: Command['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'executing': return 'text-blue-400 animate-pulse';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="fixed inset-0 bg-background">
      {/* Main browser area - full screen */}
      <div className="h-full w-full bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="flex items-center justify-center h-full text-center space-y-6">
          <div className="space-y-4">
            <div className="text-6xl font-mono font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              AI RAi
            </div>
            <div className="text-xl text-muted-foreground font-mono">
              Autonomous Browser Agent Active
            </div>
            <div className="text-sm text-muted-foreground/80 max-w-md mx-auto">
              Your intelligent browser assistant is ready. Use the command section below or press Ctrl+Shift+C to give me tasks.
            </div>
          </div>
        </div>
      </div>

      {/* Floating Command Section */}
      <div 
        className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-96 h-80' : 'w-72 h-12'
        }`}
      >
        <Card className="h-full bg-black/90 backdrop-blur-sm border-primary/30 shadow-2xl">
          {/* Header */}
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="command-header"
          >
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary">AI RAi Command</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {sessionInfo && (
                <Badge variant={timeRemaining > 60 ? 'default' : 'destructive'} className="text-xs font-mono">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(timeRemaining)}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="p-3 pt-0 h-full flex flex-col">
              {/* Quick Commands Grid */}
              <div className="grid grid-cols-2 gap-1 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentCommand("Take a screenshot")}
                  className="text-xs font-mono"
                  data-testid="quick-screenshot"
                >
                  <Camera className="w-3 h-3 mr-1" />
                  Screenshot
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentCommand("Fill out this form")}
                  className="text-xs font-mono"
                  data-testid="quick-form"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Fill Form
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentCommand("Click the submit button")}
                  className="text-xs font-mono"
                  data-testid="quick-click"
                >
                  <MousePointer className="w-3 h-3 mr-1" />
                  Click
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentCommand("Scroll down to find more content")}
                  className="text-xs font-mono"
                  data-testid="quick-scroll"
                >
                  <ScrollText className="w-3 h-3 mr-1" />
                  Scroll
                </Button>
              </div>

              {/* Command Input */}
              <form onSubmit={handleSubmit} className="mb-3">
                <div className="flex space-x-2">
                  <Input
                    ref={inputRef}
                    value={currentCommand}
                    onChange={(e) => setCurrentCommand(e.target.value)}
                    placeholder="Or type custom command..."
                    className="flex-1 bg-black/50 border-primary/30 text-green-400 font-mono text-sm"
                    data-testid="command-input"
                    disabled={executeCommand.isPending}
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={!currentCommand.trim() || executeCommand.isPending}
                    data-testid="command-submit"
                  >
                    {executeCommand.isPending ? (
                      <div className="w-4 h-4 animate-spin border border-current border-t-transparent rounded-full" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </form>

              {/* Command History */}
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {commands.length === 0 ? (
                    <div className="text-center text-muted-foreground text-xs py-8">
                      <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <div>No commands yet</div>
                      <div className="text-xs opacity-70 mt-1">
                        Try: "take a screenshot", "fill this form"
                      </div>
                    </div>
                  ) : (
                    commands.map((command) => (
                      <div key={command.id} className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="text-green-400 font-mono">{'>'}</span>
                          <span className="text-green-300 font-mono truncate flex-1">
                            {command.input}
                          </span>
                          <span className={`font-mono ${getStatusColor(command.status)}`}>
                            {command.status}
                          </span>
                        </div>
                        {command.output && (
                          <div className="text-xs text-muted-foreground font-mono pl-4 opacity-80">
                            {command.output}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="text-xs text-muted-foreground/60 text-center pt-2 border-t border-white/10">
                Ctrl+Shift+C to toggle • ESC to hide
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}