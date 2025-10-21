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
import { initializeRealEko, executeWithRealEko } from '@/eko/real-eko-integration';
import { BrowserView } from '@/components/browser/BrowserView';
import { ExecutionLog } from '@/components/browser/ExecutionLog';
import { EkoWorkflowManager } from '@/components/eko/EkoWorkflowManager';
import { EkoAgentSelector, type EkoAgentType } from '@/components/eko/EkoAgentSelector';
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
  BarChart,
  Trash2
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
  const [realTimeRemaining, setRealTimeRemaining] = useState<string>(() => {
    const hours = Math.floor(initialTimeRemaining / 60);
    const mins = initialTimeRemaining % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
  });
  const [historyView, setHistoryView] = useState<'all' | 'chat' | 'commands'>('all');
  const [precisionMode, setPrecisionMode] = useState(true); // PRECISION ENHANCEMENT: Enable by default
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  // REAL Eko Framework Integration
  const [isBrowserAutomationActive, setIsBrowserAutomationActive] = useState(false);
  
  // Enhanced Eko Framework State Management
  const [selectedAgent, setSelectedAgent] = useState<EkoAgentType>('browser');
  const [agentConfig, setAgentConfig] = useState<any>({});
  const [showWorkflowManager, setShowWorkflowManager] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<string>('');

  // FIXED: Fetch session info with proper expiry validation
  const { data: sessionInfo, error: sessionError } = useQuery({
    queryKey: ['session', agentId],
    queryFn: async () => {
      console.log('🔍 SESSION: Fetching session info for agent:', agentId);
      const response = await apiRequest('GET', `/api/session/${agentId}`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ SESSION: Session fetch failed:', error);
        
        // Handle specific error cases
        if (response.status === 404) {
          throw new Error('Session not found');
        } else if (response.status === 410) {
          throw new Error('Session expired');
        } else {
          throw new Error(error.error || 'Agent session data retrieval failed');
        }
      }
      
      const sessionData = await response.json();
      console.log('✅ SESSION: Session data loaded:', sessionData);
      
      // FIXED: Validate session status
      if (sessionData.status === 'expired') {
        console.log('❌ SESSION: Session is expired');
        throw new Error('Session expired');
      }
      
      return sessionData as Promise<SessionInfo>;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on session expiry
      if (error.message.includes('expired') || error.message.includes('not found')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // FIXED: Fetch all messages with proper session validation
  const { data: allMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['messages', agentId],
    queryFn: async () => {
      console.log('🔍 MESSAGES: Fetching messages for agent:', agentId);
      const response = await apiRequest('GET', `/api/session/${agentId}/messages`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ MESSAGES: Message fetch failed:', error);
        
        // Handle specific error cases
        if (response.status === 404) {
          throw new Error('Session not found');
        } else if (response.status === 410) {
          throw new Error('Session expired');
        } else {
          throw new Error(error.error || 'Neural conversation history access denied');
        }
      }
      
      const data = await response.json();
      console.log('✅ MESSAGES: Messages loaded:', data.length, 'messages');
      
      return data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })) as Message[];
    },
    enabled: !!sessionInfo && !sessionError,
    retry: (failureCount, error) => {
      // Don't retry on session expiry
      if (error.message.includes('expired') || error.message.includes('not found')) {
        return false;
      }
      return failureCount < 3;
    },
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

  // Send message mutation with enhanced Eko framework integration
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log('🚀 EKO FRAMEWORK: Processing message:', content);
      
      // Enhanced keyword detection for browser automation
      const requiresBrowserAutomation = 
        content.toLowerCase().includes('navigate') ||
        content.toLowerCase().includes('click') ||
        content.toLowerCase().includes('type') ||
        content.toLowerCase().includes('scroll') ||
        content.toLowerCase().includes('search') ||
        content.toLowerCase().includes('google') ||
        content.toLowerCase().includes('browser') ||
        content.toLowerCase().includes('open') ||
        content.toLowerCase().includes('visit') ||
        content.toLowerCase().includes('go to') ||
        content.toLowerCase().includes('fill') ||
        content.toLowerCase().includes('submit');
      
      if (requiresBrowserAutomation) {
        console.log('🌐 EKO FRAMEWORK: Browser automation required');
        setIsBrowserAutomationActive(true);
        
        // Execute browser automation with enhanced Eko framework
        try {
          const result = await executeWithRealEko(content);
          console.log('✅ EKO FRAMEWORK: Browser automation completed:', result);
          
          // Update browser view with automation result
          setBrowserView(result.result || 'Browser automation completed successfully');
          setExecutionLog(prev => [...prev, 
            `[${new Date().toLocaleTimeString()}] EKO: ${result.result}`
          ]);
          
          return {
            userMessage: content,
            agentMessage: `✅ Browser automation completed using Eko framework:\n\n${result.result}`,
            hasExecutableTask: true,
            taskDescription: 'eko_browser_automation'
          };
        } catch (error) {
          console.error('❌ EKO FRAMEWORK: Browser automation failed:', error);
          setIsBrowserAutomationActive(false);
          
          // Provide helpful error message
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return {
            userMessage: content,
            agentMessage: `❌ Browser automation failed: ${errorMessage}\n\nPlease try rephrasing your request or check if the target website is accessible.`,
            hasExecutableTask: false,
            taskDescription: null
          };
        }
      } else {
        // Regular chat - use existing API with enhanced error handling
        console.log('💬 EKO FRAMEWORK: Regular chat response');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        try {
          const response = await apiRequest('POST', `/api/session/${agentId}/message`, { content });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Communication failed');
          }
          
          const data = await response.json();
          return data;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            throw new Error('Request timed out after 30 seconds');
          }
          throw err;
        }
      }
    },
    onSuccess: (data) => {
      console.log('✅ onSuccess called with data:', data);
      
      // Optimistically append messages to cache so UI updates instantly
      try {
        const now = new Date();
        const userMessageText = (data && typeof data === 'object' ? (data as any).userMessage : undefined) || currentMessage;
        const agentMessageText = (data && typeof data === 'object' ? (data as any).agentMessage : undefined) || '';

        const userMsg = {
          id: `tmp_${Date.now()}_user`,
          sessionId: agentId,
          role: 'user' as const,
          content: userMessageText,
          messageType: 'chat' as const,
          inputMethod: 'typing' as const,
          timestamp: now,
          hasExecutableTask: null,
          taskDescription: null,
        };

        const agentMsg = {
          id: `tmp_${Date.now()}_agent`,
          sessionId: agentId,
          role: 'agent' as const,
          content: agentMessageText,
          messageType: 'chat' as const,
          inputMethod: 'typing' as const,
          timestamp: now,
          hasExecutableTask: null,
          taskDescription: null,
        };

        queryClient.setQueryData<any[]>(['messages', agentId], (old) => {
          const existing = Array.isArray(old) ? old : [];
          return [...existing, userMsg, agentMsg];
        });
        
        console.log('✅ Optimistic update complete - messages added to cache');
      } catch (e) {
        console.warn('⚠️ Failed to optimistically update cache:', (e as any)?.message);
      }
      
      // Don't refetch immediately - the optimistic update is enough
      // The backend stores messages but we use the client cache for instant display
      
      setCurrentMessage('');
    },
    onError: (error: any) => {
      console.error('❌ onError called:', error);
      toast({
        title: "NEURAL_TRANSMISSION_ERROR",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      console.log('🔄 onSettled called - mutation completed');
    }
  });

  // Clear chat history mutation
  const clearChatMutation = useMutation({
    mutationFn: async () => {
      if (!sessionInfo?.sessionId) {
        throw new Error('Session is not available');
      }
      const response = await apiRequest('DELETE', `/api/chat/history/${sessionInfo.sessionId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear chat history');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate caches to refresh UI
      queryClient.invalidateQueries({ queryKey: ['messages', agentId] });
      queryClient.invalidateQueries({ queryKey: ['chat-history', agentId] });
      toast({
        title: 'Chat cleared',
        description: 'Conversation history wiped successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'CLEAR_CHAT_ERROR',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Execute task mutation - In-Browser Automation
  const executeTaskMutation = useMutation({
    mutationFn: async (taskDescription: string) => {
      const response = await apiRequest('POST', `/api/session/${agentId}/execute`, { taskDescription });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'In-browser automation failed - task execution aborted');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsExecuting(true);
      setBrowserView('active');
      setExecutionLog([
        'INITIALIZING IN-BROWSER AUTOMATION...',
        'CONNECTING TO USER BROWSER...',
        'AI AGENT READY FOR DIRECT CONTROL...'
      ]);
      
      // Show success message
      toast({
        title: "IN-BROWSER AUTOMATION ACTIVE",
        description: "AI agent is now controlling your browser directly",
      });
    },
    onError: (error: any) => {
      toast({
        title: "AUTOMATION_FAILURE",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update time remaining every second (HH:MM:SS from expiresAt)
  useEffect(() => {
    const key = `agent_session_expires_${agentId}`;

    if (!sessionInfo) return;

    // FIXED: Properly handle session expiration time
    let expires: number;
    
    if (sessionInfo.expiresAt) {
      // Parse the expiresAt string properly
      const expiresDate = new Date(sessionInfo.expiresAt);
      expires = expiresDate.getTime();
      
      // Validate the date
      if (isNaN(expires) || expires <= 0) {
        console.error('Invalid expiresAt date:', sessionInfo.expiresAt);
        setRealTimeRemaining('EXPIRED');
        return;
      }
      
      // Store canonical expiration time
      localStorage.setItem(key, String(expires));
    } else {
      // Fallback to stored value
      const stored = localStorage.getItem(key);
      if (stored) {
        expires = parseInt(stored, 10);
        if (isNaN(expires) || expires <= 0) {
          setRealTimeRemaining('EXPIRED');
          return;
        }
      } else {
        setRealTimeRemaining('EXPIRED');
        return;
      }
    }

    const computeFormatted = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, expires - now);
      
      if (remainingMs <= 0) {
        return 'EXPIRED';
      }
      
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // Initial set
    setRealTimeRemaining(computeFormatted());

    const interval = setInterval(() => {
      const newTime = computeFormatted();
      setRealTimeRemaining(newTime);
      
      // If session expired, clear localStorage and show error
      if (newTime === 'EXPIRED') {
        localStorage.removeItem(key);
        toast({
          title: "SESSION_EXPIRED",
          description: "Your 24-hour session has ended. Please purchase a new session.",
          variant: "destructive",
        });
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [sessionInfo, agentId, toast]);

  // FIXED: Handle session errors with proper validation
  useEffect(() => {
    if (sessionError) {
      console.error('❌ SESSION: Session error detected:', sessionError);
      toast({
        title: "SESSION_EXPIRED",
        description: "Your 24-hour session has expired. Please purchase a new session to continue.",
        variant: "destructive",
      });
      
      // Clear session data and redirect
      setTimeout(() => {
        localStorage.removeItem(`agent_session_expires_${agentId}`);
        window.location.href = '/';
      }, 3000);
    }
  }, [sessionError, toast, agentId]);

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

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;
    if (isSending || sendMessageMutation.isPending) return;

    const normalizedMessage = normalizeInput(currentMessage);
    setIsSending(true);
    try {
      await sendMessageMutation.mutateAsync(normalizedMessage);
    } catch (err) {
      // handled by onError
    } finally {
      // short cooldown to prevent accidental double-submits
      setTimeout(() => setIsSending(false), 800);
    }
  };

  const handleExecuteTask = (taskDescription: string) => {
    if (executeTaskMutation.isPending) return;
    executeTaskMutation.mutate(taskDescription);
  };

  // Deprecated: formatting now handled in state (HH:MM:SS)
  const formatTime = (minutes: number) => {
    const safe = Number.isFinite(minutes) ? minutes : 0;
    const clamped = Math.max(0, safe);
    const hours = Math.floor(clamped / 60);
    const mins = clamped % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
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
                <Badge variant={'default'} className="text-sm font-mono">
                  <Clock className="w-4 h-4 mr-1" />
                  {realTimeRemaining}
                </Badge>
              </div>

              {/* Real Browser Review and Clear Chat */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = `/live/agent/${agentId}`}
                data-testid="button-real-browser-review"
                className="font-mono"
              >
                <Monitor className="w-4 h-4 mr-1" />
                REAL_BROWSER_REVIEW
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => clearChatMutation.mutate()}
                disabled={!sessionInfo?.sessionId}
                data-testid="button-clear-chat"
                className="font-mono"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                CLEAR_CHAT
              </Button>
              
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
                
                {/* History View Selector removed for minimal UI */}
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
              {/* Eko Agent Selector */}
          <EkoAgentSelector
            selectedAgent={selectedAgent}
            onAgentChange={setSelectedAgent}
          />
              
              {/* Workflow Manager Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowWorkflowManager(!showWorkflowManager)}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {showWorkflowManager ? 'HIDE_WORKFLOW' : 'SHOW_WORKFLOW'}
                </Button>
                {showWorkflowManager && (
                  <Input
                    value={currentWorkflow}
                    onChange={(e) => setCurrentWorkflow(e.target.value)}
                    placeholder="Describe your workflow..."
                    className="flex-1 font-mono text-xs bg-background/50 border-primary/20"
                  />
                )}
              </div>
              
              {/* Workflow Manager */}
              {showWorkflowManager && (
                <EkoWorkflowManager workflow={currentWorkflow} />
              )}

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
                  placeholder={"Type messages or commands for the agent..."}
                  disabled={isExecuting}
                  className="flex-1 font-mono bg-background/50 border-primary/20"
                  data-testid="input-command-line"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isSending || sendMessageMutation.isPending}
                  data-testid="button-send-command"
                  className="font-mono"
                >
                  {sendMessageMutation.isPending || isSending ? (
                    <Activity className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* In-Browser Automation Monitor */}
          <Card className="flex flex-col bg-card/50 border-primary/20">
            <div className="p-4 border-b border-primary/10 bg-chart-2/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-chart-2" />
                  <h3 className="font-bold text-lg font-mono">IN-BROWSER_AUTOMATION</h3>
                </div>
                {isExecuting && (
                  <Badge variant="destructive" className="animate-pulse font-mono text-xs">
                    ● LIVE_AUTOMATION
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex-1 p-6">
              {browserView ? (
                <div className="h-full space-y-4">
                  {/* LIVE BROWSER STREAMING - VNC Integration */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[600px]">
                    {/* Live Browser View */}
                    <Card className="bg-background border-primary/20 flex flex-col">
                      <div className="bg-card border-b border-primary/10 p-3 flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="ml-3 bg-background/80 px-3 py-1 rounded text-xs font-mono border border-primary/20">
                            live://browser_automation
                          </div>
                          <Badge variant="secondary" className="ml-auto text-xs font-mono">
                            🔴 LIVE_STREAM
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <BrowserView 
                          agentId={agentId}
                          sessionId={sessionInfo?.sessionId}
                          isActive={isExecuting || isBrowserAutomationActive}
                        />
                      </div>
                    </Card>

                    {/* Real-time Execution Log */}
                    <Card className="bg-background border-primary/20 flex flex-col">
                      <div className="bg-card border-b border-primary/10 p-3 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-green-500" />
                          <div className="text-sm font-mono font-medium">LIVE_EXECUTION_LOG</div>
                          <Badge variant="outline" className="ml-auto text-xs font-mono">
                            {executionLog.length} steps
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <ExecutionLog
                          agentId={agentId}
                          sessionId={sessionInfo?.sessionId}
                          isActive={isExecuting || isBrowserAutomationActive}
                          steps={executionLog.map((log, idx) => ({
                            id: `step_${idx}`,
                            timestamp: new Date(),
                            action: log,
                            status: idx === executionLog.length - 1 && isExecuting ? 'running' : 'completed'
                          }))}
                        />
                      </div>
                    </Card>
                  </div>

                  {/* Automation Status Bar */}
                  <Card className="bg-background/80 border-primary/20">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-sm font-mono">
                              {isBrowserAutomationActive ? 'REAL_EKO_FRAMEWORK_ACTIVE' : 'BROWSER_AUTOMATION_ACTIVE'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-mono">VNC_STREAMING: ENABLED</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-mono">REAL_TIME: ACTIVE</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-mono">
                            SESSION: {agentId.slice(0, 8)}...
                          </Badge>
                          <Badge variant="outline" className="text-xs font-mono">
                            TIME: {realTimeRemaining}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-muted/30 rounded-lg flex items-center justify-center mx-auto">
                      <Monitor className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      <div className="font-mono text-lg">AWAITING_AUTOMATION</div>
                      <div className="text-sm text-muted-foreground font-mono max-w-sm">
                        Submit a command to the agent and execute to begin 
                        in-browser automation (no VNC required)
                      </div>
                      <Button 
                        onClick={() => {
                          setCurrentMessage('navigate to google.com');
                          handleSendMessage();
                        }}
                        className="font-mono"
                        variant="outline"
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        START_AUTOMATION
                      </Button>
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