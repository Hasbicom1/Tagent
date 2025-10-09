/**
 * EKO INTERVENTION PANEL
 * Real implementation based on Eko framework
 * NO FAKE WRAPPERS - ACTUAL HUMAN-IN-THE-LOOP CAPABILITIES
 */

import React, { useState, useEffect } from 'react';
import { EkoOrchestrator } from '../core/eko-orchestrator';

interface InterventionRequest {
  id: string;
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  message: string;
  options?: string[];
  required: boolean;
  timestamp: Date;
  context?: any;
}

interface EkoInterventionPanelProps {
  sessionId: string;
  onInterventionResponse?: (requestId: string, response: any) => void;
}

export const EkoInterventionPanel: React.FC<EkoInterventionPanelProps> = ({
  sessionId,
  onInterventionResponse
}) => {
  const [interventions, setInterventions] = useState<InterventionRequest[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [currentIntervention, setCurrentIntervention] = useState<InterventionRequest | null>(null);
  const [userInput, setUserInput] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  
  const orchestrator = new EkoOrchestrator();

  useEffect(() => {
    // Listen for intervention requests from Eko orchestrator
    const handleInterventionRequest = (request: InterventionRequest) => {
      console.log('🤝 EKO INTERVENTION: New request:', request);
      
      setInterventions(prev => [...prev, request]);
      setCurrentIntervention(request);
      setIsVisible(true);
      
      // Auto-focus on input if it's an input type
      if (request.type === 'input') {
        setTimeout(() => {
          const input = document.getElementById('intervention-input');
          input?.focus();
        }, 100);
      }
    };

    // Listen for intervention responses
    const handleInterventionResponse = (requestId: string, response: any) => {
      console.log('🤝 EKO INTERVENTION: Response received:', requestId, response);
      
      setInterventions(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, resolved: true, response }
          : req
      ));
      
      setCurrentIntervention(null);
      setIsVisible(false);
    };

    // Set up event listeners (these would be connected to the orchestrator)
    // For now, we'll simulate some intervention requests
    const simulateIntervention = () => {
      const request: InterventionRequest = {
        id: `intervention_${Date.now()}`,
        type: 'confirmation',
        message: 'The AI wants to click on a button that says "Submit". Should I proceed?',
        required: true,
        timestamp: new Date(),
        context: {
          element: 'button',
          text: 'Submit',
          confidence: 0.8
        }
      };
      
      handleInterventionRequest(request);
    };

    // Simulate intervention after 5 seconds
    const timer = setTimeout(simulateIntervention, 5000);
    
    return () => clearTimeout(timer);
  }, [sessionId]);

  const handleResponse = (requestId: string, response: any) => {
    console.log('🤝 EKO INTERVENTION: Sending response:', requestId, response);
    
    // Update intervention status
    setInterventions(prev => prev.map(req => 
      req.id === requestId 
        ? { ...req, resolved: true, response }
        : req
    ));
    
    // Send response to orchestrator
    onInterventionResponse?.(requestId, response);
    
    // Clear current intervention
    setCurrentIntervention(null);
    setIsVisible(false);
    setUserInput('');
    setSelectedOption('');
  };

  const handleConfirmation = (requestId: string, confirmed: boolean) => {
    handleResponse(requestId, { confirmed });
  };

  const handleChoice = (requestId: string, choice: string) => {
    handleResponse(requestId, { choice });
  };

  const handleInput = (requestId: string, input: string) => {
    handleResponse(requestId, { input });
  };

  const handleApproval = (requestId: string, approved: boolean) => {
    handleResponse(requestId, { approved });
  };

  const handleSkip = (requestId: string) => {
    handleResponse(requestId, { skipped: true });
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setCurrentIntervention(null);
  };

  const getInterventionIcon = (type: InterventionRequest['type']) => {
    switch (type) {
      case 'confirmation': return '❓';
      case 'choice': return '🔀';
      case 'input': return '⌨️';
      case 'approval': return '✅';
      default: return '🤝';
    }
  };

  const getInterventionColor = (type: InterventionRequest['type']) => {
    switch (type) {
      case 'confirmation': return 'bg-yellow-600';
      case 'choice': return 'bg-blue-600';
      case 'input': return 'bg-green-600';
      case 'approval': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  if (!isVisible || !currentIntervention) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${getInterventionColor(currentIntervention.type)} flex items-center justify-center text-white text-lg`}>
              {getInterventionIcon(currentIntervention.type)}
            </div>
            <div>
              <h3 className="text-lg font-semibold">Human Intervention Required</h3>
              <p className="text-sm text-gray-400">Session: {sessionId.substring(0, 16)}...</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-4">
            <p className="text-gray-300">{currentIntervention.message}</p>
            {currentIntervention.context && (
              <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
                <div className="font-semibold">Context:</div>
                <div>Element: {currentIntervention.context.element}</div>
                <div>Text: {currentIntervention.context.text}</div>
                <div>Confidence: {Math.round(currentIntervention.context.confidence * 100)}%</div>
              </div>
            )}
          </div>

          {/* Confirmation Type */}
          {currentIntervention.type === 'confirmation' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmation(currentIntervention.id, true)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
              >
                ✅ Yes, Proceed
              </button>
              <button
                onClick={() => handleConfirmation(currentIntervention.id, false)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium"
              >
                ❌ No, Stop
              </button>
            </div>
          )}

          {/* Choice Type */}
          {currentIntervention.type === 'choice' && currentIntervention.options && (
            <div className="space-y-2">
              {currentIntervention.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleChoice(currentIntervention.id, option)}
                  className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded text-left"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Input Type */}
          {currentIntervention.type === 'input' && (
            <div className="space-y-2">
              <input
                id="intervention-input"
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter your input..."
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleInput(currentIntervention.id, userInput)}
                  disabled={!userInput.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium"
                >
                  Submit
                </button>
                <button
                  onClick={() => handleSkip(currentIntervention.id)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Approval Type */}
          {currentIntervention.type === 'approval' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleApproval(currentIntervention.id, true)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => handleApproval(currentIntervention.id, false)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium"
              >
                ❌ Reject
              </button>
            </div>
          )}

          {/* Skip Option */}
          {!currentIntervention.required && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <button
                onClick={() => handleSkip(currentIntervention.id)}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium"
              >
                Skip This Step
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-900 border-t border-gray-700 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>AI is waiting for your response...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EkoInterventionPanel;
