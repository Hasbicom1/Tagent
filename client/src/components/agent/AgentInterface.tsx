import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Terminal, 
  Zap, 
  Clock, 
  Send, 
  Pause, 
  Monitor,
  Activity,
  Cpu,
  Code,
  Command,
  Camera,
  FileText,
  Lock,
  Search,
  Eye,
  BarChart
} from 'lucide-react';

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'agent';
  content: string;
  messageType: 'chat' | 'command' | 'system';
  inputMethod: 'typing' | 'button' | 'slash_command';
  timestamp: Date;
  hasExecutableTask: boolean | null;
  taskDescription: string | null;
}

interface SessionInfo {
  sessionId: string;
  agentId: string;
  expiresAt: string;
  timeRemaining: number;
  isActive: boolean;
}

interface AgentInterfaceProps {
  agentId: string;
  timeRemaining: number;
}

export function AgentInterface({ agentId, timeRemaining: initialTimeRemaining }: AgentInterfaceProps) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [browserView, setBrowserView] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [realTimeRemaining, setRealTimeRemaining] = useState(initialTimeRemaining);
  const [historyView, setHistoryView] = useState<'all' | 'chat' | 'commands'>('all');
  const [precisionMode, setPrecisionMode] = useState(true); // PRECISION ENHANCEMENT: Enable by default
  const { toast } = useToast();

  // Fetch session info
  const { data: sessionInfo, error: sessionError } = useQuery({
    queryKey: ['session', agentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/session/${agentId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Agent session data retrieval failed');
      }
      return response.json() as Promise<SessionInfo>;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch all messages (backward compatibility and default view)
  const { data: allMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['messages', agentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/session/${agentId}/messages`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Neural conversation history access denied');
      }
      const data = await response.json();
      return data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })) as Message[];
    },
    enabled: !!sessionInfo,
  });

  // Fetch chat history only
  const { data: chatHistory = [] } = useQuery({
    queryKey: ['chat-history', agentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/session/${agentId}/chat-history`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Chat archive retrieval protocol failed');
      }
      const data = await response.json();
      return data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })) as Message[];
    },
    enabled: !!sessionInfo,
  });

  // Fetch command history only
  const { data: commandHistory = [] } = useQuery({
    queryKey: ['command-history', agentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/session/${agentId}/command-history`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Command execution log access denied');
      }
      const data = await response.json();
      return data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })) as Message[];
    },
    enabled: !!sessionInfo,
  });

  // Get current messages based on selected history view
  const getCurrentMessages = () => {
    switch (historyView) {
      case 'chat': return chatHistory;
      case 'commands': return commandHistory;
      default: return allMessages;
    }
  };

  const messages = getCurrentMessages();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/session/${agentId}/message`, { content });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Neural link transmission failed - message not delivered');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all history caches to prevent stale data
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['chat-history', agentId] });
      queryClient.invalidateQueries({ queryKey: ['command-history', agentId] });
      setCurrentMessage('');
    },
    onError: (error: any) => {
      toast({
        title: "NEURAL_TRANSMISSION_ERROR",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Execute task mutation
  const executeTaskMutation = useMutation({
    mutationFn: async (taskDescription: string) => {
      const response = await apiRequest('POST', `/api/session/${agentId}/execute`, { taskDescription });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Task execution protocol aborted - automation sequence failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsExecuting(true);
      setBrowserView('active');
      setExecutionLog(['INITIALIZING BROWSER ENGINE...']);
    },
    onError: (error: any) => {
      toast({
        title: "AUTOMATION_PROTOCOL_FAILURE",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update time remaining
  useEffect(() => {
    if (sessionInfo) {
      setRealTimeRemaining(sessionInfo.timeRemaining);
      
      const interval = setInterval(() => {
        setRealTimeRemaining(prev => Math.max(0, prev - 1));
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [sessionInfo]);

  // Handle session errors
  useEffect(() => {
    if (sessionError) {
      toast({
        title: "SESSION_PROTOCOL_BREACH",
        description: "Your liberation session has expired. Restart your escape from Big Tech chains.",
        variant: "destructive",
      });
    }
  }, [sessionError, toast]);

  // Removed simulated execution. Expect real-time updates via WebSocket task events.

  // Input normalization: convert slash commands to natural language
  const normalizeInput = (input: string): string => {
    const trimmed = input.trim();
    
    // Handle slash commands
    if (trimmed.startsWith('/summarize')) {
      return 'Summarize the main content of this page in clear, concise bullet points';
    }
    if (trimmed.startsWith('/translate')) {
      return 'Translate the text on this page to English and explain key concepts';
    }
    if (trimmed.startsWith('/analyze')) {
      return 'Analyze this content for key insights, patterns, and important information';
    }
    if (trimmed.startsWith('/research')) {
      return 'Research this topic thoroughly and provide comprehensive findings with sources';
    }
    if (trimmed.startsWith('/extract')) {
      return 'Extract and organize all important data from this page into structured format';
    }
    if (trimmed.startsWith('/screenshot')) {
      return 'Navigate to a website and take a screenshot for me';
    }
    if (trimmed.startsWith('/monitor')) {
      return 'Monitor this page for changes and notify me of any updates';
    }
    if (trimmed.startsWith('/login')) {
      return 'Login to my account by finding and filling login forms';
    }
    if (trimmed.startsWith('/form')) {
      return 'Help me fill out this form automatically with smart field detection';
    }
    
    // Return original input if no slash command detected
    return input;
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim() || sendMessageMutation.isPending) return;
    
    // Normalize input to convert slash commands to natural language
    const normalizedMessage = normalizeInput(currentMessage);
    sendMessageMutation.mutate(normalizedMessage);
  };

  const handleExecuteTask = (taskDescription: string) => {
    if (executeTaskMutation.isPending) return;
    executeTaskMutation.mutate(taskDescription);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Show loading state while fetching session
  if (!sessionInfo && !sessionError) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono crt-screen scanlines flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <Activity className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-lg font-mono">LOADING_SESSION...</div>
            <div className="text-sm text-muted-foreground">Connecting to agent {agentId}</div>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state
  if (sessionError) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono crt-screen scanlines flex items-center justify-center">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-4">
            <div className="text-lg font-mono text-destructive">SESSION_ERROR</div>
            <div className="text-sm text-muted-foreground">Unable to connect to agent session</div>
            <Button 
              onClick={() => window.location.href = '/'} 
              data-testid="button-return-landing"
            >
              Return to Landing
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-mono crt-screen scanlines">
      {/* Terminal Header */}
      <div className="bg-card border-b border-primary/20 terminal-window electric-glow">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-10 h-10 border-2 border-primary bg-primary/10">
                <AvatarImage src="" />
                <AvatarFallback className="text-primary font-bold text-sm">
                  AI
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-primary phosphor-text matrix-text">
                    AGENT_{agentId}
                  </h1>
                  <Badge variant={isExecuting ? 'destructive' : 'secondary'} className="text-xs font-mono">
                    {isExecuting ? 'EXECUTING' : 'STANDBY'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground font-mono phosphor-text">
                  Neural network status: OPTIMAL<span className="terminal-cursor">▋</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right space-y-1">
                <div className="text-sm text-muted-foreground font-mono">SESSION_TIME</div>
                <Badge variant={realTimeRemaining > 60 ? 'default' : 'destructive'} className="text-sm font-mono">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatTime(realTimeRemaining)}
                </Badge>
              </div>
              
              {isExecuting && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    setIsExecuting(false);
                    setBrowserView(null);
                    setExecutionLog([]);
                  }}
                  data-testid="button-abort-execution"
                  className="font-mono"
                >
                  <Pause className="w-4 h-4 mr-1" />
                  ABORT
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-10rem)]">
          
          {/* Command Interface */}
          <Card className="flex flex-col bg-card/50 border-primary/20 terminal-window crt-screen">
            <div className="p-4 border-b border-primary/10 bg-primary/5 retro-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg font-mono phosphor-text">COMMAND_INTERFACE</h3>
                  <Badge variant="outline" className="text-xs font-mono border-primary/30">
                    SECURE_CHANNEL
                  </Badge>
                </div>
                
                {/* History View Selector */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={historyView === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHistoryView('all')}
                    className="text-xs font-mono"
                    data-testid="button-view-all"
                  >
                    ALL ({allMessages.length})
                  </Button>
                  <Button
                    variant={historyView === 'chat' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHistoryView('chat')}
                    className="text-xs font-mono"
                    data-testid="button-view-chat"
                  >
                    CHAT ({chatHistory.length})
                  </Button>
                  <Button
                    variant={historyView === 'commands' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHistoryView('commands')}
                    className="text-xs font-mono"
                    data-testid="button-view-commands"
                  >
                    COMMANDS ({commandHistory.length})
                  </Button>
                </div>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      <span>•</span>
                      <span>{message.role === 'user' ? 'USER_INPUT' : 'AGENT_RESPONSE'}</span>
                      {message.messageType === 'command' && (
                        <>
                          <span>•</span>
                          <Badge variant="secondary" className="text-xs">
                            {message.inputMethod === 'slash_command' ? 'SLASH_CMD' : 
                             message.inputMethod === 'button' ? 'BUTTON_CMD' : 'COMMAND'}
                          </Badge>
                        </>
                      )}
                    </div>
                    
                    <div className={`p-4 rounded-lg border terminal-window ${
                      message.role === 'user' 
                        ? 'bg-primary/10 border-primary/20 electric-glow' 
                        : 'bg-card border-primary/10'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm font-mono phosphor-text">
                        {message.content}
                      </div>
                      
                      {message.hasExecutableTask && message.taskDescription && (
                        <Button
                          onClick={() => handleExecuteTask(message.taskDescription!)}
                          disabled={isExecuting || executeTaskMutation.isPending}
                          className="mt-4 w-full font-mono"
                          variant="default"
                          data-testid="button-execute-command"
                        >
                          {isExecuting || executeTaskMutation.isPending ? (
                            <>
                              <Activity className="w-4 h-4 mr-2 animate-spin" />
                              EXECUTING_SEQUENCE...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              EXECUTE_COMMAND
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t border-primary/10 bg-background/50 space-y-4">
              {/* Enhanced Command Categories */}
              <div className="space-y-3">
                {/* Browser Automation Commands */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">BROWSER_AUTOMATION</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Navigate to a website and take a screenshot for me")}
                      className="text-xs font-mono"
                      data-testid="button-quick-screenshot"
                    >
                      <Camera className="w-3 h-3 mr-1" />
                      Screenshot
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Help me fill out this form automatically with smart field detection")}
                      className="text-xs font-mono"
                      data-testid="button-quick-form"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Fill Form
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Login to my account by finding and filling login forms")}
                      className="text-xs font-mono"
                      data-testid="button-quick-login"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Login
                    </Button>
                  </div>
                </div>

                {/* Content Analysis Commands */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">CONTENT_ANALYSIS</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Summarize the main content of this page in clear, concise bullet points")}
                      className="text-xs font-mono"
                      data-testid="button-quick-summarize"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Summarize
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Translate the text on this page to English and explain key concepts")}
                      className="text-xs font-mono"
                      data-testid="button-quick-translate"
                    >
                      <Command className="w-3 h-3 mr-1" />
                      Translate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Analyze this content for key insights, patterns, and important information")}
                      className="text-xs font-mono"
                      data-testid="button-quick-analyze"
                    >
                      <BarChart className="w-3 h-3 mr-1" />
                      Analyze
                    </Button>
                  </div>
                </div>

                {/* Intelligence Operations */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">INTELLIGENCE_OPS</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Research this topic thoroughly and provide comprehensive findings with sources")}
                      className="text-xs font-mono"
                      data-testid="button-quick-research"
                    >
                      <Search className="w-3 h-3 mr-1" />
                      Research
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Monitor this page for changes and notify me of any updates")}
                      className="text-xs font-mono"
                      data-testid="button-quick-monitor"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Monitor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage("Extract and organize all important data from this page into structured format")}
                      className="text-xs font-mono"
                      data-testid="button-quick-extract"
                    >
                      <BarChart className="w-3 h-3 mr-1" />
                      Extract
                    </Button>
                  </div>
                </div>
              </div>

              {/* Command Input */}
              {/* PRECISION ENHANCEMENT: Precision Mode Toggle */}
              <div className="flex items-center gap-4 mb-3 px-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <label htmlFor="precision-mode" className="text-sm font-mono text-muted-foreground">
                    Precision Mode
                  </label>
                  <input
                    id="precision-mode"
                    type="checkbox"
                    checked={precisionMode}
                    onChange={(e) => setPrecisionMode(e.target.checked)}
                    className="rounded border-primary/30 bg-background"
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {precisionMode ? '🎯 Page analysis + precise clicks enabled' : '⚡ Fast mode - direct actions'}
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-primary font-mono text-sm pt-3">$</span>
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={precisionMode 
                    ? "Type commands - AI will analyze page first for precision..." 
                    : "Type natural language or slash commands (/summarize, /translate, /analyze)..."
                  }
                  disabled={isExecuting}
                  className="flex-1 font-mono bg-background/50 border-primary/20"
                  data-testid="input-command-line"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-command"
                  className="font-mono"
                >
                  {sendMessageMutation.isPending ? (
                    <Activity className="w-4 h-4 animate-spin" />
                  ) : precisionMode ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Execution Monitor */}
          <Card className="flex flex-col bg-card/50 border-primary/20">
            <div className="p-4 border-b border-primary/10 bg-chart-2/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-chart-2" />
                  <h3 className="font-bold text-lg font-mono">EXECUTION_MONITOR</h3>
                </div>
                {isExecuting && (
                  <Badge variant="destructive" className="animate-pulse font-mono text-xs">
                    ● LIVE_EXECUTION
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex-1 p-6">
              {browserView ? (
                <div className="h-full space-y-4">
                  {/* Browser Simulation */}
                  <Card className="bg-background border-primary/20 h-72">
                    <div className="bg-card border-b border-primary/10 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <div className="w-3 h-3 rounded-full bg-chart-3" />
                        <div className="w-3 h-3 rounded-full bg-chart-2" />
                        <div className="ml-3 bg-background/80 px-3 py-1 rounded text-xs font-mono border border-primary/20">
                          agent://execution_environment
                        </div>
                        <Badge variant="secondary" className="ml-auto text-xs font-mono">
                          SANDBOXED
                        </Badge>
                      </div>
                    </div>
                    <div className="p-6 h-full flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
                          <Activity className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          BROWSER_ENGINE_ACTIVE
                        </div>
                      </div>
                    </div>
                  </Card>
                  
                  {/* Execution Log */}
                  <Card className="bg-background/80 border-primary/20">
                    <div className="p-3 border-b border-primary/10 bg-primary/5">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-primary" />
                        <div className="text-sm font-mono font-medium">EXECUTION_LOG</div>
                      </div>
                    </div>
                    <ScrollArea className="h-40 p-4">
                      <div className="space-y-1 font-mono text-xs">
                        {executionLog.map((log, idx) => (
                          <div key={idx} className="flex gap-3 text-chart-2">
                            <span className="text-muted-foreground">
                              [{new Date().toLocaleTimeString()}]
                            </span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-muted/30 rounded-lg flex items-center justify-center mx-auto">
                      <Monitor className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      <div className="font-mono text-lg">AWAITING_EXECUTION</div>
                      <div className="text-sm text-muted-foreground font-mono max-w-sm">
                        Submit a command to the agent and execute to begin 
                        live browser automation monitoring
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* System Status Bar */}
      <div className="border-t border-primary/20 bg-card/30">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-chart-2" />
                <span>NEURAL_NET: OPTIMAL</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-3 h-3" />
                <span>CPU: 12%</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3" />
                <span>MEMORY: 2.1GB</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <span>SESSION_ID: {agentId}</span>
              <span>UPTIME: 99.97%</span>
              <span>LATENCY: ~1.8ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}