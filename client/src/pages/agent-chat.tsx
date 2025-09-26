import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { 
  Send, 
  Bot, 
  User, 
  Monitor, 
  Play, 
  Square, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Maximize2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeTaskStatus } from '@/hooks/use-realtime-task-status';
import { VNCClient } from '@/components/vnc/VNCClient';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  hasExecutableTask?: boolean;
  taskDescription?: string;
}

interface SessionInfo {
  sessionId: string;
  agentId: string;
  expiresAt: string;
  timeRemaining: number;
  isActive: boolean;
}

export default function AgentChat() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [liveViewVisible, setLiveViewVisible] = useState(true);
  const [liveViewFullscreen, setLiveViewFullscreen] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [vncConnection, setVncConnection] = useState<{
    webSocketURL?: string;
    vncToken?: string;
    isActive: boolean;
  }>({ isActive: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const vncContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Real-time task status using existing proven infrastructure
  const {
    connectionStatus,
    taskStatuses,
    taskProgress,
    allTaskLogs,
    connect: connectWebSocket,
    subscribeToTask,
    subscribeToSession,
    disconnect
  } = useRealtimeTaskStatus(agentId, sessionInfo?.sessionId);

  useEffect(() => {
    if (!agentId) {
      setLocation('/');
      return;
    }

    loadSessionAndMessages();
  }, [agentId, setLocation]);

  useEffect(() => {
    // WebSocket connection is now handled automatically by useRealtimeTaskStatus hook
    // Only subscribe to session updates once we have session info
    if (sessionInfo?.sessionId && connectionStatus.isAuthenticated) {
      subscribeToSession(sessionInfo.sessionId);
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [sessionInfo, connectionStatus.isAuthenticated, subscribeToSession, disconnect]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessionAndMessages = async () => {
    try {
      setIsLoading(true);
      
      // Get session info
      const sessionResponse = await apiRequest('GET', `/api/session/${agentId}`);
      
      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.error);
      }
      
      const session = await sessionResponse.json();
      setSessionInfo(session);

      // Get chat history
      const messagesResponse = await apiRequest('GET', `/api/session/${agentId}/chat-history`);
      
      if (messagesResponse.ok) {
        const chatHistory = await messagesResponse.json();
        setMessages(chatHistory);
      }
      
    } catch (error: any) {
      console.error('Failed to load session:', error);
      
      if (error.message.includes('expired') || error.message.includes('not found')) {
        toast({
          title: "Session Expired",
          description: "Your 24-hour session has expired. Please start a new session.",
          variant: "destructive",
        });
        setLocation('/');
      } else {
        toast({
          title: "Connection Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionInfo || isSending) return;

    try {
      setIsSending(true);
      
      // Send message
      const response = await apiRequest('POST', `/api/session/${agentId}/message`, {
        content: inputMessage.trim()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const result = await response.json();
      
      // Add user message to UI immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: inputMessage.trim(),
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // If task is executable, set current task for tracking
      if (result.hasExecutableTask && result.taskId) {
        setCurrentTaskId(result.taskId);
        
        toast({
          title: "Task Started",
          description: "AI agent is executing your request...",
        });
      }

      // Agent response will come via WebSocket real-time updates
      
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({
        title: "Message Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTimeRemaining = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  };

  const toggleLiveViewFullscreen = () => {
    setLiveViewFullscreen(!liveViewFullscreen);
  };

  const renderLiveView = () => (
    <Card className={`${liveViewFullscreen ? 'fixed inset-4 z-50' : 'h-full'} flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4" />
          <span className="font-semibold">Live Browser View</span>
          {connectionStatus.isConnected && (
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLiveViewVisible(!liveViewVisible)}
            data-testid="button-toggle-liveview"
          >
            {liveViewVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleLiveViewFullscreen}
            data-testid="button-fullscreen-liveview"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {liveViewVisible && (
        <div className="flex-1 rounded-b-lg overflow-hidden">
          <VNCClient
            sessionId={sessionInfo?.sessionId || ''}
            agentId={sessionInfo?.agentId || ''}
            webSocketURL={vncConnection.webSocketURL}
            vncToken={vncConnection.vncToken}
            className="h-full"
            onConnectionStateChange={(connected) => {
              setVncConnection(prev => ({ ...prev, isActive: connected }));
            }}
            autoConnect={true}
          />
        </div>
      )}
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connecting to Agent</h2>
          <p className="text-muted-foreground">Loading your AI agent session...</p>
        </Card>
      </div>
    );
  }

  if (!sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-muted-foreground mb-4">Unable to connect to agent session.</p>
          <Button onClick={() => setLocation('/')}>Return Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-semibold" data-testid="text-agent-title">
              Agent {sessionInfo.agentId}
            </h1>
            <p className="text-sm text-muted-foreground">
              AI Browser Automation Agent
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <span data-testid="text-session-time">
              {formatTimeRemaining(sessionInfo.timeRemaining)}
            </span>
          </div>
          
          {currentTaskId && (
            <Badge className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              Task Running
            </Badge>
          )}
          
          <Badge variant={connectionStatus.isConnected ? "default" : "destructive"}>
            {connectionStatus.isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'agent' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      
                      <Card className={`max-w-[80%] p-3 ${
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap" data-testid={`message-${message.role}`}>
                          {message.content}
                        </p>
                        {message.hasExecutableTask && (
                          <div className="mt-2 pt-2 border-t border-current/20">
                            <p className="text-xs opacity-75">
                              🤖 Executable Task: {message.taskDescription}
                            </p>
                          </div>
                        )}
                      </Card>
                      
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask the AI agent to automate browser tasks..."
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={isSending}
                    data-testid="input-message"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!inputMessage.trim() || isSending}
                    data-testid="button-send-message"
                  >
                    {isSending ? (
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Live View Panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            {renderLiveView()}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Fullscreen Live View Overlay */}
      {liveViewFullscreen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={toggleLiveViewFullscreen} />
      )}
    </div>
  );
}