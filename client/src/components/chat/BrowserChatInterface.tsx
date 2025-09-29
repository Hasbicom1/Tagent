/**
 * BROWSER CHAT INTERFACE
 * 
 * Complete chat interface with real-time browser preview
 * No API dependencies - works entirely locally
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
  X
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
  };
}

interface BrowserSession {
  id: string;
  isActive: boolean;
  currentUrl: string;
  screenshots: string[];
  lastActivity: Date;
}

interface BrowserChatInterfaceProps {
  sessionId?: string;
  onSessionChange?: (sessionId: string) => void;
}

export function BrowserChatInterface({ 
  sessionId: propSessionId, 
  onSessionChange 
}: BrowserChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(propSessionId || '');
  const [browserSession, setBrowserSession] = useState<BrowserSession | null>(null);
  const [isBrowserVisible, setIsBrowserVisible] = useState(true);
  const [isBrowserMaximized, setIsBrowserMaximized] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session
  useEffect(() => {
    if (!currentSessionId) {
      const newSessionId = `session_${Date.now()}`;
      setCurrentSessionId(newSessionId);
      onSessionChange?.(newSessionId);
    }
  }, [currentSessionId, onSessionChange]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize browser session
  useEffect(() => {
    if (currentSessionId) {
      initializeBrowserSession();
    }
  }, [currentSessionId]);

  /**
   * Initialize browser session
   */
  const initializeBrowserSession = async () => {
    try {
      setIsLoading(true);
      
      // Simulate browser session creation
      const session: BrowserSession = {
        id: currentSessionId,
        isActive: true,
        currentUrl: '',
        screenshots: [],
        lastActivity: new Date()
      };
      
      setBrowserSession(session);
      setIsConnected(true);
      
      // Add system message
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'system',
        content: 'Browser session initialized. Ready for automation tasks.',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Failed to initialize browser session:', error);
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'system',
        content: 'Failed to initialize browser session. Please try again.',
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
   * Send message
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, message: inputValue })
      });
      if (!res.ok) {
        throw new Error(`Chat request failed: ${res.status}`);
      }
      const data = await res.json();
      const result = data.result || {};

      addMessage({
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: result.response || result.message || 'Response received.',
        timestamp: new Date(),
        metadata: {
          taskId: result.taskId,
          agentId: 'unified-ai',
          screenshot: result.screenshot,
          actions: result.actions
        }
      });

      if (result.screenshot) {
        setCurrentScreenshot(result.screenshot);
      }
    } catch (error) {
      console.error('Failed to process message:', error);
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date()
      });
    } finally {
      setIsLoading(false);
    }
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
   * Take screenshot
   */
  const takeScreenshot = async () => {
    try {
      const res = await fetch(`/api/browser/${currentSessionId}/screenshot`);
      if (!res.ok) throw new Error('Screenshot failed');
      const data = await res.json();
      if (data.screenshot) {
        setCurrentScreenshot(data.screenshot);
        addMessage({
          id: `msg_${Date.now()}`,
          type: 'system',
          content: 'Screenshot captured',
          timestamp: new Date(),
          metadata: { screenshot: data.screenshot }
        });
      }
    } catch (e) {
      addMessage({
        id: `msg_${Date.now()}`,
        type: 'system',
        content: 'Failed to capture screenshot',
        timestamp: new Date()
      });
    }
  };

  /**
   * Clear chat
   */
  const clearChat = () => {
    setMessages([]);
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
                <h2 className="text-lg font-semibold">Browser AI Chat</h2>
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
                  
                  {/* Screenshot */}
                  {message.metadata?.screenshot && (
                    <div className="mt-2">
                      <img
                        src={message.metadata.screenshot}
                        alt="Browser screenshot"
                        className="w-full rounded border"
                      />
                    </div>
                  )}
                  
                  {/* Actions */}
                  {message.metadata?.actions && message.metadata.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.metadata.actions.map((action, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {action.type}: {action.target}
                        </Badge>
                      ))}
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
              placeholder="Type your browser automation command..."
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
                    value={browserSession?.currentUrl || 'about:blank'}
                    readOnly
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={takeScreenshot}
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
                  <p className="text-sm">Start a conversation to see browser automation</p>
                </div>
              </div>
            )}
          </div>

          {/* Browser Footer */}
          <div className="bg-gray-50 border-t border-gray-200 p-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Session: {currentSessionId}</span>
              <span>Last activity: {browserSession?.lastActivity.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
