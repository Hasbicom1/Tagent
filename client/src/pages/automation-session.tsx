/**
 * AUTOMATION SESSION PAGE
 * Split-screen interface: 30% chat, 70% browser viewer
 * Zero technical complexity for users
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Monitor, Clock, Zap, CheckCircle, AlertCircle } from 'lucide-react';

interface AutomationMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  screenshot?: string;
  agent?: string;
  status?: 'processing' | 'completed' | 'error';
}

interface SessionStatus {
  id: string;
  status: string;
  expiresAt: string;
  timeRemaining: number;
  usage: {
    commandsExecuted: number;
    browserActions: number;
    screenshots: number;
  };
}

export default function AutomationSessionPage() {
  const [, params] = useRoute('/automation/:sessionId');
  const sessionId = params?.sessionId;
  
  const [messages, setMessages] = useState<AutomationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'automation_start':
        addMessage({
          id: Date.now().toString(),
          type: 'system',
          content: `Starting automation: ${data.command}`,
          timestamp: new Date().toISOString(),
          status: 'processing'
        });
        break;
        
      case 'automation_progress':
        if (data.screenshot) {
          setCurrentScreenshot(data.screenshot);
        }
        addMessage({
          id: Date.now().toString(),
          type: 'agent',
          content: `Agent ${data.agent} executing: ${data.step?.description || 'Processing...'}`,
          timestamp: new Date().toISOString(),
          agent: data.agent,
          status: 'processing'
        });
        break;
        
      case 'automation_complete':
        addMessage({
          id: Date.now().toString(),
          type: 'agent',
          content: `Task completed successfully using ${data.result?.agent || 'AI Agent'}`,
          timestamp: new Date().toISOString(),
          agent: data.result?.agent,
          status: 'completed'
        });
        setIsLoading(false);
        break;
        
      case 'automation_error':
        addMessage({
          id: Date.now().toString(),
          type: 'system',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
          status: 'error'
        });
        setIsLoading(false);
        break;
    }
  };

  // Add message to chat
  const addMessage = (message: AutomationMessage) => {
    setMessages(prev => [...prev, message]);
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load session status
  useEffect(() => {
    if (!sessionId) return;

    const loadSessionStatus = async () => {
      try {
        const response = await fetch(`/api/automation/${sessionId}/status`);
        const data = await response.json();
        
        if (data.success) {
          setSessionStatus(data.session);
        }
      } catch (error) {
        console.error('❌ Failed to load session status:', error);
      }
    };

    loadSessionStatus();
    const interval = setInterval(loadSessionStatus, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [sessionId]);

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: AutomationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/automation/${sessionId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: inputMessage,
          context: {}
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Fallback: if no realtime events are emitted, reflect API response in UI
        if (data.screenshot) {
          setCurrentScreenshot(data.screenshot);
        }

        addMessage({
          id: Date.now().toString(),
          type: 'agent',
          content: data.task || 'Automation executed successfully',
          timestamp: new Date().toISOString(),
          agent: data.agent || 'AI Agent',
          status: 'completed'
        });
        setIsLoading(false);
      } else {
        addMessage({
          id: Date.now().toString(),
          type: 'system',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
          status: 'error'
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      addMessage({
        id: Date.now().toString(),
        type: 'system',
        content: 'Failed to send message. Please try again.',
        timestamp: new Date().toISOString(),
        status: 'error'
      });
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format time remaining (from milliseconds)
  const formatTimeRemaining = (ms: number) => {
    const safeMs = Math.max(0, ms || 0);
    const hours = Math.floor(safeMs / (1000 * 60 * 60));
    const minutes = Math.floor((safeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Not Found</h1>
          <p className="text-gray-600">The automation session could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Monitor className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">AI Automation</h1>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          {sessionStatus && (
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{formatTimeRemaining(Math.max(0, new Date(sessionStatus.expiresAt).getTime() - Date.now()))} remaining</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="h-4 w-4" />
                <span>{sessionStatus.usage.commandsExecuted} commands</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Chat Interface - 30% */}
        <div className="w-[30%] bg-white border-r border-gray-200 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-sm text-gray-600">Ask me to automate any task</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'agent'
                      ? 'bg-green-100 text-green-900'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{message.content}</span>
                    {message.status === 'processing' && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {message.status === 'completed' && (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    )}
                    {message.status === 'error' && (
                      <AlertCircle className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  {message.agent && (
                    <div className="text-xs opacity-75 mt-1">
                      Powered by {message.agent}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center space-x-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-sm text-gray-600">Processing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me to automate any task..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Browser Viewer - 70% */}
        <div className="w-[70%] bg-gray-100 flex flex-col">
          {/* Browser Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="ml-4 text-sm text-gray-600">AI Browser Automation</span>
            </div>
          </div>

          {/* Browser Content */}
          <div className="flex-1 bg-white flex items-center justify-center">
            {currentScreenshot ? (
              <img
                src={`data:image/png;base64,${currentScreenshot}`}
                alt="Browser automation"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-500">
                <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Ready for Automation</p>
                <p className="text-sm">Send a command to see the browser in action</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
