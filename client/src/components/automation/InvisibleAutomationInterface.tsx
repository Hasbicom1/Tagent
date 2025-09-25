/**
 * INVISIBLE AUTOMATION INTERFACE
 * 
 * Split-screen interface where users watch their browser being controlled
 * All AI agents work invisibly behind the scenes
 * Users only see the "magic" of browser automation
 */

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Bot, 
  User, 
  Monitor, 
  Play, 
  Pause, 
  Square, 
  Settings,
  Maximize2,
  Minimize2,
  RefreshCw,
  Camera,
  Download,
  Trash2,
  Plus,
  X,
  Eye,
  Zap,
  Brain,
  Database,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  Activity
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    taskId?: string;
    agentId?: string;
    screenshot?: string;
    actions?: any[];
    status?: 'processing' | 'completed' | 'failed';
  };
}

interface BrowserAction {
  sessionId: string;
  actionType: string;
  message: string;
  timestamp: Date;
}

interface InvisibleAutomationInterfaceProps {
  sessionId?: string;
  onSessionChange?: (sessionId: string) => void;
}

export function InvisibleAutomationInterface({ 
  sessionId: propSessionId, 
  onSessionChange 
}: InvisibleAutomationInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(propSessionId || '');
  const [browserActions, setBrowserActions] = useState<BrowserAction[]>([]);
  const [isBrowserVisible, setIsBrowserVisible] = useState(true);
  const [isBrowserMaximized, setIsBrowserMaximized] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [taskQueue, setTaskQueue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session
  useEffect(() => {
    if (!currentSessionId) {
      const newSessionId = `automation_session_${Date.now()}`;
      setCurrentSessionId(newSessionId);
      onSessionChange?.(newSessionId);
    }
  }, [currentSessionId, onSessionChange]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize invisible automation system
  useEffect(() => {
    if (currentSessionId) {
      initializeInvisibleSystem();
    }
  }, [currentSessionId]);

  /**
   * Initialize invisible automation system
   */
  const initializeInvisibleSystem = async () => {
    try {
      setIsLoading(true);
      setIsConnected(true);
      
      // Add system message
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'system',
        content: 'Invisible AI agents initialized. Ready for browser automation.',
        timestamp: new Date()
      });

      // Simulate agent initialization
      setActiveAgents(['Browser-Use', 'Skyvern', 'LaVague', 'Stagehand', 'PHOENIX-7742']);
      
    } catch (error) {
      console.error('Failed to initialize invisible system:', error);
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'system',
        content: 'Failed to initialize invisible automation system. Please try again.',
        timestamp: new Date()
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add message to chat
   */
  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  /**
   * Add browser action
   */
  const addBrowserAction = (action: BrowserAction) => {
    setBrowserActions(prev => [...prev, action]);
  };

  /**
   * Send message to invisible agents
   */
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    addMessage(userMessage);
    setInputValue('');
    setIsLoading(true);
    setIsProcessing(true);
    setTaskQueue(prev => prev + 1);

    try {
      // Simulate invisible agent processing
      await simulateInvisibleProcessing(inputValue);
    } catch (error) {
      console.error('Failed to process message:', error);
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date(),
        metadata: { status: 'failed' }
      });
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
      setTaskQueue(prev => Math.max(0, prev - 1));
    }
  };

  /**
   * Simulate invisible agent processing
   */
  const simulateInvisibleProcessing = async (instruction: string) => {
    // Step 1: Agent selection (invisible)
    const selectedAgent = selectInvisibleAgent(instruction);
    
    addMessage({
      id: `msg_${Date.now()}`,
      type: 'agent',
      content: `🤖 ${selectedAgent} is analyzing your request...`,
      timestamp: new Date(),
      metadata: { agentId: selectedAgent, status: 'processing' }
    });

    // Step 2: Real browser actions (user can see)
    const actions = parseInstruction(instruction);
    
    for (const action of actions) {
      // Simulate real browser action
      await simulateRealBrowserAction(action);
      
      // Add browser action to timeline
      addBrowserAction({
        sessionId: currentSessionId,
        actionType: action.type,
        message: action.message,
        timestamp: new Date()
      });
    }

    // Step 3: Completion
    addMessage({
      id: `msg_${Date.now()}`,
      type: 'agent',
      content: `✅ Task completed successfully using ${selectedAgent}`,
      timestamp: new Date(),
      metadata: { 
        agentId: selectedAgent, 
        status: 'completed',
        actions: actions
      }
    });
  };

  /**
   * Select invisible agent based on instruction
   */
  const selectInvisibleAgent = (instruction: string): string => {
    const instructionLower = instruction.toLowerCase();
    
    if (instructionLower.includes('visual') || instructionLower.includes('see') || instructionLower.includes('screenshot')) {
      return 'Skyvern Vision AI';
    } else if (instructionLower.includes('plan') || instructionLower.includes('strategy') || instructionLower.includes('workflow')) {
      return 'LaVague LAM';
    } else if (instructionLower.includes('form') || instructionLower.includes('fill') || instructionLower.includes('type')) {
      return 'Browser-Use AI';
    } else if (instructionLower.includes('navigate') || instructionLower.includes('go to')) {
      return 'Stagehand Hybrid AI';
    } else {
      return 'PHOENIX-7742';
    }
  };

  /**
   * Parse instruction into browser actions
   */
  const parseInstruction = (instruction: string): any[] => {
    const actions: any[] = [];
    const instructionLower = instruction.toLowerCase();

    // Navigation actions
    if (instructionLower.includes('navigate') || instructionLower.includes('go to')) {
      const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        actions.push({ 
          type: 'navigate', 
          url: urlMatch[0],
          message: `Navigating to ${urlMatch[0]}`
        });
      }
    }

    // Click actions
    if (instructionLower.includes('click')) {
      actions.push({ 
        type: 'click', 
        selector: 'button, a, input[type="submit"]',
        message: 'Clicking element'
      });
    }

    // Type actions
    if (instructionLower.includes('type') || instructionLower.includes('fill')) {
      actions.push({ 
        type: 'type', 
        selector: 'input[type="text"], input[type="email"], textarea', 
        text: 'Test input',
        message: 'Typing into form field'
      });
    }

    // Scroll actions
    if (instructionLower.includes('scroll')) {
      actions.push({ 
        type: 'scroll',
        message: 'Scrolling page'
      });
    }

    // Wait actions
    if (instructionLower.includes('wait')) {
      actions.push({ 
        type: 'wait', 
        duration: 2000,
        message: 'Waiting for page to load'
      });
    }

    return actions;
  };

  /**
   * Simulate real browser action
   */
  const simulateRealBrowserAction = async (action: any): Promise<void> => {
    // Add realistic delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Update screenshot
    const screenshot = generateMockScreenshot(action.type);
    setCurrentScreenshot(screenshot);
  };

  /**
   * Generate mock screenshot
   */
  const generateMockScreenshot = (type: string): string => {
    const mockScreenshots = {
      navigate: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TmF2aWdhdGlvbiBQYWdlPC90ZXh0Pjwvc3ZnPg==',
      click: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q2xpY2sgQWN0aW9uPC90ZXh0Pjwvc3ZnPg==',
      type: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Rm9ybSBGaWxsaW5nPC90ZXh0Pjwvc3ZnPg==',
      scroll: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2Nyb2xsaW5nPC90ZXh0Pjwvc3ZnPg==',
      wait: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+V2FpdGluZzwvdGV4dD48L3N2Zz4='
    };
    
    return mockScreenshots[type as keyof typeof mockScreenshots] || mockScreenshots.navigate;
  };

  /**
   * Handle key press
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Toggle browser visibility
   */
  const toggleBrowserVisibility = () => {
    setIsBrowserVisible(!isBrowserVisible);
  };

  /**
   * Toggle browser maximization
   */
  const toggleBrowserMaximization = () => {
    setIsBrowserMaximized(!isBrowserMaximized);
  };

  /**
   * Clear chat
   */
  const clearChat = () => {
    setMessages([]);
    setBrowserActions([]);
    setCurrentScreenshot('');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat Panel */}
      <div className={`flex flex-col ${isBrowserVisible ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Invisible AI Automation</h2>
              </div>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleBrowserVisibility}
                className="flex items-center gap-1"
              >
                <Monitor className="w-4 h-4" />
                {isBrowserVisible ? 'Hide' : 'Show'} Browser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                className="flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Active Agents Status */}
        <div className="bg-gray-50 border-b border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Active Agents:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {activeAgents.map(agent => (
                  <Badge key={agent} variant="outline" className="text-xs">
                    {agent}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Processing
                </Badge>
              )}
              {taskQueue > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {taskQueue} tasks
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.type === 'agent'
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.type === 'agent' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {message.type === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  {message.metadata?.status && (
                    <div className="mt-2 flex items-center gap-1">
                      {message.metadata.status === 'processing' && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Processing
                        </Badge>
                      )}
                      {message.metadata.status === 'completed' && (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      {message.metadata.status === 'failed' && (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="w-3 h-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want the browser to do..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Browser Preview Panel */}
      {isBrowserVisible && (
        <div className={`bg-white border-l border-gray-200 flex flex-col ${isBrowserMaximized ? 'w-1/2' : 'w-1/2'} transition-all duration-300`}>
          {/* Browser Header */}
          <div className="bg-gray-100 border-b border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 mx-3">
                  <Input
                    value="https://example.com"
                    readOnly
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Camera className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleBrowserMaximization}
                  className="flex items-center gap-1"
                >
                  {isBrowserMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Browser Content */}
          <div className="flex-1 bg-white">
            {currentScreenshot ? (
              <img
                src={currentScreenshot}
                alt="Browser preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Browser Preview</p>
                  <p className="text-sm">Watch your browser being controlled automatically</p>
                </div>
              </div>
            )}
          </div>

          {/* Browser Actions Timeline */}
          <div className="bg-gray-50 border-t border-gray-200 p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Browser Actions:</span>
              </div>
              <div className="max-h-20 overflow-y-auto">
                {browserActions.slice(-3).map((action, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>{action.message}</span>
                    <span className="text-gray-400">
                      {action.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
