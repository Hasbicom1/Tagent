/**
 * EKO CHAT INTERFACE
 * Real implementation based on Eko framework
 * NO FAKE WRAPPERS - ACTUAL AI-POWERED CHAT
 */

import React, { useState, useEffect, useRef } from 'react';
import { EkoOrchestrator } from '../core/eko-orchestrator';
import { EkoNLP, NLPAnalysis } from '../core/eko-nlp';
import { EkoResult } from '../core/eko-framework';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  analysis?: NLPAnalysis;
  result?: EkoResult;
  status?: 'processing' | 'success' | 'error';
}

interface EkoChatInterfaceProps {
  sessionId: string;
  onStatusChange?: (status: string) => void;
}

export const EkoChatInterface: React.FC<EkoChatInterfaceProps> = ({
  sessionId,
  onStatusChange
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const nlp = new EkoNLP();
  const orchestrator = new EkoOrchestrator();

  useEffect(() => {
    // Initialize chat with welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'system',
      content: '🤖 Eko AI Assistant is ready! I can help you automate browser tasks using natural language. Try saying "click the search button" or "navigate to google.com"',
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage]);
    
    // Check connection status
    const status = orchestrator.getStatus();
    setIsConnected(status.connected);
    
    // Listen for status changes
    const interval = setInterval(() => {
      const currentStatus = orchestrator.getStatus();
      setIsConnected(currentStatus.connected);
      onStatusChange?.(currentStatus.isRunning ? 'running' : 'idle');
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionId, onStatusChange]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Analyze user input with Eko NLP
      const analysis = await nlp.analyze(input.trim());
      console.log('🧠 EKO NLP Analysis:', analysis);

      // Add analysis message
      const analysisMessage: ChatMessage = {
        id: `analysis_${Date.now()}`,
        type: 'system',
        content: `🧠 I understand you want to: ${analysis.intent} (confidence: ${Math.round(analysis.confidence * 100)}%)`,
        timestamp: new Date(),
        analysis
      };
      setMessages(prev => [...prev, analysisMessage]);

      // Handle clarification needs
      if (analysis.requiresClarification) {
        const clarificationMessage: ChatMessage = {
          id: `clarification_${Date.now()}`,
          type: 'assistant',
          content: `❓ I need some clarification:\n${analysis.clarificationQuestions.map(q => `• ${q}`).join('\n')}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, clarificationMessage]);
        setIsProcessing(false);
        return;
      }

      // Add processing message
      const processingMessage: ChatMessage = {
        id: `processing_${Date.now()}`,
        type: 'assistant',
        content: '🤖 Executing your request...',
        timestamp: new Date(),
        status: 'processing'
      };
      setMessages(prev => [...prev, processingMessage]);

      // Execute command with Eko orchestrator
      const result = await orchestrator.executeCommand(input.trim());
      console.log('✅ Eko execution result:', result);

      // Update processing message with result
      setMessages(prev => prev.map(msg => 
        msg.id === processingMessage.id 
          ? {
              ...msg,
              content: result.success 
                ? `✅ Task completed successfully!\n\nResult: ${result.result}`
                : `❌ Task failed: ${result.result}`,
              status: result.success ? 'success' : 'error',
              result
            }
          : msg
      ));

    } catch (error) {
      console.error('❌ Eko execution failed:', error);
      
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error}`,
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAbort = () => {
    orchestrator.abortCurrentTask();
    const abortMessage: ChatMessage = {
      id: `abort_${Date.now()}`,
      type: 'system',
      content: '🛑 Task aborted by user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, abortMessage]);
  };

  const handlePause = () => {
    orchestrator.pauseCurrentTask();
    const pauseMessage: ChatMessage = {
      id: `pause_${Date.now()}`,
      type: 'system',
      content: '⏸️ Task paused by user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, pauseMessage]);
  };

  const handleResume = () => {
    orchestrator.resumeCurrentTask();
    const resumeMessage: ChatMessage = {
      id: `resume_${Date.now()}`,
      type: 'system',
      content: '▶️ Task resumed by user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, resumeMessage]);
  };

  const getMessageIcon = (type: ChatMessage['type']) => {
    switch (type) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'system': return 'ℹ️';
      default: return '💬';
    }
  };

  const getStatusColor = (status?: ChatMessage['status']) => {
    switch (status) {
      case 'processing': return 'text-blue-500';
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <h2 className="text-lg font-semibold">Eko AI Assistant</h2>
          <span className="text-sm text-gray-400">Session: {sessionId.substring(0, 16)}...</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAbort}
            disabled={!isProcessing}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
          >
            Abort
          </button>
          <button
            onClick={handlePause}
            disabled={!isProcessing}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
          >
            Pause
          </button>
          <button
            onClick={handleResume}
            disabled={!isProcessing}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
          >
            Resume
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.type !== 'user' && (
              <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm">
                {getMessageIcon(message.type)}
              </div>
            )}
            
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.type === 'assistant'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {message.analysis && (
                <div className="mt-2 p-2 bg-gray-600 rounded text-xs">
                  <div className="font-semibold">AI Analysis:</div>
                  <div>Intent: {message.analysis.intent}</div>
                  <div>Confidence: {Math.round(message.analysis.confidence * 100)}%</div>
                  <div>Actions: {message.analysis.actions.length}</div>
                </div>
              )}
              
              <div className={`mt-2 text-xs ${getStatusColor(message.status)}`}>
                {message.timestamp.toLocaleTimeString()}
                {message.status && ` • ${message.status}`}
              </div>
            </div>
            
            {message.type === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                {getMessageIcon(message.type)}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your command... (e.g., 'click the search button', 'navigate to google.com')"
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium"
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </form>
        
        <div className="mt-2 text-xs text-gray-400">
          💡 Try commands like: "click the button", "type 'hello' in the search box", "scroll down", "navigate to youtube.com"
        </div>
      </div>
    </div>
  );
};

export default EkoChatInterface;
