import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Bot, 
  User, 
  MessageCircle,
  Play, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  X,
  Minimize2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeTaskStatus } from '@/hooks/use-realtime-task-status';
import { RealBrowserAutomation } from '@/components/RealBrowserAutomation';

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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState<boolean>(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Session initialization effect
  useEffect(() => {
    if (!agentId) {
      setSessionError("No agent ID provided");
      setIsLoading(false);
      return;
    }
    
    console.log("🔍 Initializing session for agent:", agentId);
    
    const initializeSession = async () => {
       try {
         // Check if session exists and is valid
         const statusResponse = await apiRequest('GET', `/api/agent/${agentId}/status`);
         
         if (statusResponse.ok) {
           const statusData = await statusResponse.json();
           console.log("✅ Session initialized successfully:", statusData);
           setSessionReady(true);
           loadSessionAndMessages();
           return;
         }
        
        // If session doesn't exist or has expired, try to create/recover it
        const createResponse = await apiRequest('POST', '/api/create-or-recover-session', {
          sessionId: agentId
        });
        
        if (createResponse.ok) {
          const createData = await createResponse.json();
          console.log("✅ Session created/recovered successfully:", createData);
          setSessionReady(true);
          loadSessionAndMessages();
          return;
        }
        
        // If we get here, both attempts failed
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to initialize session");
        
      } catch (error: any) {
        console.error("❌ Session initialization failed:", error);
        setSessionError(error.message || "Failed to initialize session");
        setIsLoading(false);
      }
    };
    
    initializeSession();
  }, [agentId]);

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

		console.log('[SESSION] Bootstrapping session for:', agentId);
		loadSessionAndMessages();
  }, [agentId, setLocation]);

	useEffect(() => {
		if (sessionInfo) {
			console.log('Session Info:', sessionInfo);
			console.log('Session ID:', sessionInfo.sessionId);
			console.log('Agent ID:', sessionInfo.agentId);
		}
	}, [sessionInfo]);

  useEffect(() => {
    // WebSocket is OPTIONAL - only for VNC live view, not required for chat
    // Chat works via HTTP API, WebSocket is bonus feature for real-time task updates
    if (sessionInfo?.sessionId && connectionStatus.isAuthenticated) {
      try {
        subscribeToSession(sessionInfo.sessionId);
      } catch (e) {
        console.warn('⚠️ WebSocket subscription failed (non-critical):', e);
      }
    }

    // Cleanup on unmount
    return () => {
      try {
        disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [sessionInfo, connectionStatus.isAuthenticated, subscribeToSession, disconnect]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper function to compute time remaining (must be before loadSessionAndMessages)
  const computeMinutesRemaining = (expiresAt: string): number => {
    const ts = expiresAt ? new Date(expiresAt).getTime() : NaN;
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, Math.floor((ts - Date.now()) / 60000));
  };

	const loadSessionAndMessages = async () => {
    try {
      setIsLoading(true);
      
      // Get session info
      const sessionResponse = await apiRequest('GET', `/api/session/${agentId}`);
      
      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.error);
      }
      
			const raw = await sessionResponse.json();
			console.log('[SESSION] Bootstrap complete:', raw);
			const normalized: SessionInfo = {
				sessionId: raw.sessionId || raw.id || agentId,
				agentId: raw.agentId || raw.agent_id || agentId,
				expiresAt: raw.expiresAt || raw.expires_at || '',
				timeRemaining: computeMinutesRemaining(raw.expiresAt || raw.expires_at || ''),
				isActive: (raw.isActive ?? raw.active ?? true) as boolean
			};
			console.log('[SESSION] IDs - sessionId:', normalized.sessionId, 'agentId:', normalized.agentId);
			setSessionInfo(normalized);

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
      
      // Get CSRF token
      const csrfResponse = await apiRequest('GET', '/api/csrf-token');
      const { csrfToken } = await csrfResponse.json();

      // Send message
      const response = await apiRequest('POST', `/api/session/${agentId}/message`, {
        content: inputMessage.trim(),
        csrfToken
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
      
      // Add agent response from API (instant, no WebSocket needed)
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: result.agentMessage || result.response || 'Processing...',
        timestamp: new Date().toISOString(),
        hasExecutableTask: result.hasExecutableTask,
        taskDescription: result.taskDescription
      };
      
      setMessages(prev => [...prev, userMessage, agentMessage]);
      setInputMessage('');

      // If task is executable, set current task for tracking
      if (result.hasExecutableTask && result.taskId) {
        setCurrentTaskId(result.taskId);
        
        toast({
          title: "Task Started",
          description: "AI agent is executing your request...",
        });
      }

      // Auto-minimize chat after sending (optional: comment out if you want it to stay open)
      // setTimeout(() => setChatOpen(false), 2000);
      
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
    const safe = Number.isFinite(minutes) ? minutes : 0;
    const clamped = Math.max(0, safe);
    const hours = Math.floor(clamped / 60);
    const mins = clamped % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  };


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

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Session Error</h2>
          <p className="text-muted-foreground mb-4">{sessionError}</p>
          <Button onClick={() => setLocation('/')}>Return Home</Button>
        </Card>
      </div>
    );
  }

  if (!sessionReady || !sessionInfo) {
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
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Slim Status Bar at Top */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/90 border-b border-gray-800 backdrop-blur-sm z-30">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-blue-400" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Agent</span>
            <span className="text-white font-medium" data-testid="text-agent-title">
              {sessionInfo.agentId}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span data-testid="text-session-time">
              {formatTimeRemaining(computeMinutesRemaining(sessionInfo.expiresAt))}
            </span>
          </div>
          
          {currentTaskId && (
            <Badge className="flex items-center gap-1 bg-green-600">
              <Play className="w-3 h-3" />
              Task Running
            </Badge>
          )}
          
          <Badge variant={connectionStatus.isConnected ? "default" : "destructive"}>
            {connectionStatus.isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* FULLSCREEN BROWSER VIEW */}
      <div className="flex-1 relative overflow-hidden">
        {sessionInfo?.sessionId ? (
          <RealBrowserAutomation
            sessionId={sessionInfo.sessionId}
            agentId={agentId}
            workerUrl="https://worker-production-6480.up.railway.app"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p>Initializing browser session...</p>
            </div>
          </div>
        )}

        {/* FLOATING CHAT BUTTON (bottom-right) */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-2xl hover:scale-110 transition-all duration-200 flex items-center justify-center group"
            data-testid="button-open-chat"
          >
            <MessageCircle className="w-7 h-7 text-white" />
            {messages.length > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold border-2 border-gray-950">
                {messages.length}
              </div>
            )}
          </button>
        )}

        {/* SLIDING CHAT OVERLAY (from right) */}
        {chatOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
              onClick={() => setChatOpen(false)}
            />
            
            {/* Chat Panel */}
            <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[450px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col animate-slide-in-right">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-white" />
                  <h2 className="font-semibold text-white">AI Agent Chat</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setChatOpen(false)}
                    className="text-white hover:bg-white/20"
                    data-testid="button-minimize-chat"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setChatOpen(false)}
                    className="text-white hover:bg-white/20"
                    data-testid="button-close-chat"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4 bg-gray-900">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                      <Bot className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                      <p className="text-sm">Start chatting with your AI agent!</p>
                      <p className="text-xs mt-2">Ask me to automate browser tasks...</p>
                    </div>
                  )}
                  
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'agent' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      <div className={`max-w-[80%] rounded-2xl p-3 ${
                        message.role === 'user' 
                          ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white' 
                          : 'bg-gray-800 text-gray-100'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap" data-testid={`message-${message.role}`}>
                          {message.content}
                        </p>
                        {message.hasExecutableTask && (
                          <div className="mt-2 pt-2 border-t border-current/20">
                            <p className="text-xs opacity-75 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Task: {message.taskDescription}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your command..."
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={isSending}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                    data-testid="input-message"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!inputMessage.trim() || isSending}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    data-testid="button-send-message"
                  >
                    {isSending ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}