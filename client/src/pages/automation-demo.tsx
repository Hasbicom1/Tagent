import React, { useState, useEffect } from 'react';
import AutomationOverlay from '../components/AutomationOverlay';
import automationAgent from '../core/automation-agent';

export default function AutomationDemo() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [automationStatus, setAutomationStatus] = useState('Ready');

  useEffect(() => {
    // Initialize automation agent
    automationAgent.init();

    // Add welcome message
    setMessages([
      {
        id: 1,
        type: 'system',
        content: '🤖 Automation Demo Ready! Try typing commands like "click the button" or "type hello world"',
        timestamp: new Date()
      }
    ]);
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Simulate AI processing and automation command generation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate automation command based on user input
      const command = generateAutomationCommand(inputMessage);
      
      if (command) {
        // Execute the command
        await automationAgent.executeManualCommand(command.action, command.params);
        
        const aiMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: `✅ Executed: ${command.action} ${JSON.stringify(command.params)}`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const aiMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: '❌ Could not understand command. Try: "click button", "type text", "scroll down"',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAutomationCommand = (input) => {
    const lowerInput = input.toLowerCase();
    
    // Click commands
    if (lowerInput.includes('click') && lowerInput.includes('button')) {
      return {
        action: 'click',
        params: { selector: 'button' }
      };
    }
    
    if (lowerInput.includes('click') && lowerInput.includes('link')) {
      return {
        action: 'click',
        params: { selector: 'a' }
      };
    }
    
    // Type commands
    if (lowerInput.includes('type')) {
      const textMatch = input.match(/type\s+(.+)/i);
      if (textMatch) {
        return {
          action: 'type',
          params: { 
            selector: 'input[type="text"], textarea',
            text: textMatch[1].trim()
          }
        };
      }
    }
    
    // Scroll commands
    if (lowerInput.includes('scroll down')) {
      return {
        action: 'scroll',
        params: { y: window.scrollY + 500 }
      };
    }
    
    if (lowerInput.includes('scroll up')) {
      return {
        action: 'scroll',
        params: { y: Math.max(0, window.scrollY - 500) }
      };
    }
    
    return null;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Automation Demo</h1>
              <p className="text-sm text-gray-600">Test AI-powered browser automation</p>
            </div>
            <div className="text-sm text-gray-500">
              Status: {automationStatus}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Messages */}
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-blue-500 text-white'
                          : message.type === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="text-sm">{message.content}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        <span className="text-sm">Processing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Try: 'click the button' or 'type hello world'"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Area */}
          <div className="space-y-4">
            {/* Test Elements */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Test Elements</h3>
              <div className="space-y-3">
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
                  Test Button
                </button>
                <input
                  type="text"
                  placeholder="Type here..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <textarea
                  placeholder="Textarea for testing..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
                />
                <a href="#" className="block text-blue-500 hover:text-blue-700">
                  Test Link
                </a>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Try These Commands</h3>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Click:</strong> "click the button"
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Type:</strong> "type hello world"
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Scroll:</strong> "scroll down"
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Navigate:</strong> "go to /about"
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Automation Overlay */}
      <AutomationOverlay />
    </div>
  );
}
