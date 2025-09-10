import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Brain, 
  Terminal, 
  Zap, 
  Clock, 
  Send, 
  Pause, 
  Play,
  Monitor,
  Activity,
  AlertCircle
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  hasExecutableTask?: boolean;
  taskDescription?: string;
}

interface AgentInterfaceProps {
  agentId: string;
  timeRemaining: number; // in minutes
}

export function AgentInterface({ agentId, timeRemaining }: AgentInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: '🤖 AGENT PHOENIX-7742 ONLINE\n\nI\'m ready to execute any task you need. Just describe what you want me to do, and I\'ll break it down into actionable steps. When you\'re ready, click EXECUTE to watch me work in real-time.\n\nWhat can I help you with today?',
      timestamp: new Date(),
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [browserView, setBrowserView] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  // Mock agent responses for demo
  const generateAgentResponse = (userMessage: string): Message => {
    const taskAnalysis = analyzeTask(userMessage);
    
    return {
      id: Date.now().toString(),
      role: 'agent',
      content: taskAnalysis.response,
      timestamp: new Date(),
      hasExecutableTask: taskAnalysis.isExecutable,
      taskDescription: taskAnalysis.task
    };
  };

  const analyzeTask = (message: string) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('amazon') || lowerMessage.includes('shop') || lowerMessage.includes('buy')) {
      return {
        response: '🛒 I can help you with e-commerce tasks!\n\nI\'ll navigate to the shopping site, search for your product, compare prices, check reviews, and can even add items to cart. I can also monitor price changes and find the best deals.\n\nClick EXECUTE to watch me work through this step-by-step.',
        isExecutable: true,
        task: 'E-commerce automation and price comparison'
      };
    }
    
    if (lowerMessage.includes('linkedin') || lowerMessage.includes('social') || lowerMessage.includes('post')) {
      return {
        response: '📱 Social media automation detected!\n\nI can help you manage your social media presence - create posts, schedule content, engage with followers, analyze metrics, and automate routine interactions.\n\nClick EXECUTE to start the social media workflow.',
        isExecutable: true,
        task: 'Social media management and automation'
      };
    }
    
    if (lowerMessage.includes('form') || lowerMessage.includes('fill') || lowerMessage.includes('submit')) {
      return {
        response: '📝 Form automation is my specialty!\n\nI\'ll navigate to the form, intelligently fill out all fields with appropriate data, handle any validation errors, and complete the submission process.\n\nClick EXECUTE to watch me handle the form automatically.',
        isExecutable: true,
        task: 'Automated form filling and submission'
      };
    }
    
    if (lowerMessage.includes('data') || lowerMessage.includes('scrape') || lowerMessage.includes('extract')) {
      return {
        response: '📊 Data extraction task identified!\n\nI\'ll systematically navigate through the target sites, extract the required information, organize it into a structured format, and handle pagination or complex navigation.\n\nClick EXECUTE to begin data collection.',
        isExecutable: true,
        task: 'Web data extraction and scraping'
      };
    }
    
    return {
      response: '🧠 I understand your request!\n\nI\'ve analyzed your task and I\'m ready to execute it. I\'ll break this down into manageable steps and handle all the browser interactions automatically.\n\nClick EXECUTE when you\'re ready to see me work.',
      isExecutable: true,
      task: 'General web automation task'
    };
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');

    // Simulate agent processing time
    setTimeout(() => {
      const agentResponse = generateAgentResponse(currentMessage);
      setMessages(prev => [...prev, agentResponse]);
    }, 1000);
  };

  const handleExecuteTask = (taskDescription: string) => {
    setIsExecuting(true);
    setBrowserView('mock-stream');
    setExecutionLog(['🚀 Initializing browser automation...']);
    
    // Simulate execution steps
    const steps = [
      '🌐 Opening browser session...',
      '🔍 Navigating to target website...',
      '🎯 Locating page elements...',
      '⚡ Executing automation sequence...',
      '📊 Processing results...',
      '✅ Task completed successfully!'
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setExecutionLog(prev => [...prev, step]);
        if (index === steps.length - 1) {
          setTimeout(() => setIsExecuting(false), 1000);
        }
      }, (index + 1) * 1500);
    });
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <div className="bg-card border-b border-primary/20 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Avatar className="w-10 h-10 border-2 border-primary">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                AI
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold text-primary">
                🤖 AGENT {agentId}
              </h1>
              <div className="text-sm text-muted-foreground">
                Status: {isExecuting ? 'EXECUTING' : 'READY'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant={timeRemaining > 60 ? 'default' : 'destructive'} className="text-sm">
              <Clock className="w-4 h-4 mr-1" />
              {formatTime(timeRemaining)} REMAINING
            </Badge>
            
            {isExecuting && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  setIsExecuting(false);
                  setBrowserView(null);
                  setExecutionLog([]);
                }}
                data-testid="button-stop-execution"
              >
                <Pause className="w-4 h-4 mr-1" />
                STOP
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
          
          {/* Chat Panel */}
          <Card className="flex flex-col">
            <div className="p-4 border-b bg-primary/5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                AGENT COMMUNICATION
              </h3>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'agent' && (
                      <Avatar className="w-8 h-8 border border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                      <div className={`p-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground ml-auto' 
                          : 'bg-card border'
                      }`}>
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                        
                        {message.hasExecutableTask && (
                          <Button
                            onClick={() => handleExecuteTask(message.taskDescription!)}
                            disabled={isExecuting}
                            className="mt-3 w-full"
                            variant="destructive"
                            data-testid="button-execute-task"
                          >
                            {isExecuting ? (
                              <>
                                <Activity className="w-4 h-4 mr-2 animate-spin" />
                                EXECUTING...
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 mr-2" />
                                🚀 EXECUTE TASK
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-1 px-3">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    
                    {message.role === 'user' && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-muted text-xs">
                          YOU
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Describe your task... (e.g., 'Find cheapest RTX 4090 on Amazon')"
                  disabled={isExecuting}
                  className="flex-1 font-mono"
                  data-testid="input-agent-message"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isExecuting}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Browser Automation View */}
          <Card className="flex flex-col">
            <div className="p-4 border-b bg-chart-2/5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Monitor className="w-5 h-5 text-chart-2" />
                LIVE AUTOMATION FEED
                {isExecuting && (
                  <Badge variant="destructive" className="ml-auto animate-pulse">
                    🔴 LIVE
                  </Badge>
                )}
              </h3>
            </div>
            
            <div className="flex-1 p-4">
              {browserView ? (
                <div className="h-full space-y-4">
                  {/* Mock Browser Window */}
                  <div className="bg-background border rounded-lg h-64">
                    <div className="bg-muted p-2 rounded-t-lg border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        <div className="w-3 h-3 rounded-full bg-chart-3" />
                        <div className="w-3 h-3 rounded-full bg-chart-2" />
                        <div className="ml-2 bg-background px-3 py-1 rounded text-xs font-mono">
                          https://example.com
                        </div>
                      </div>
                    </div>
                    <div className="p-4 h-full flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <Activity className="w-8 h-8 text-primary animate-spin mx-auto" />
                        <div className="text-sm text-muted-foreground">
                          Browser automation in progress...
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Execution Log */}
                  <Card className="bg-background">
                    <div className="p-3 border-b bg-primary/5">
                      <div className="text-sm font-medium">EXECUTION LOG</div>
                    </div>
                    <ScrollArea className="h-32 p-3">
                      <div className="space-y-1 font-mono text-xs">
                        {executionLog.map((log, idx) => (
                          <div key={idx} className="text-chart-2">
                            [{new Date().toLocaleTimeString()}] {log}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto">
                      <Monitor className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">Waiting for task execution</div>
                      <div className="text-sm text-muted-foreground max-w-sm">
                        Send a message to the agent and click EXECUTE to watch 
                        live browser automation
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-card/50 p-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-chart-2" />
              Agent Status: {isExecuting ? 'EXECUTING' : 'READY'}
            </div>
            <div>Session ID: {agentId}</div>
          </div>
          
          <div className="flex items-center gap-4">
            <div>Browser Engine: Chrome v120</div>
            <div>Uptime: 100%</div>
          </div>
        </div>
      </div>
    </div>
  );
}