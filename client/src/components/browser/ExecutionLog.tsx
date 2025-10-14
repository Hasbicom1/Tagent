/**
 * ExecutionLog Component - Real-time Automation Steps Display
 * Shows live updates of browser automation actions as they happen
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Terminal, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trash2,
  Download,
  Eye,
  MousePointer,
  Keyboard,
  Navigation
} from 'lucide-react';

interface ExecutionStep {
  id: string;
  timestamp: Date;
  action: string;
  target?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  details?: string;
  screenshot?: string;
}

interface ExecutionLogProps {
  agentId: string;
  sessionId?: string;
  isActive?: boolean;
  steps?: ExecutionStep[];
  onClear?: () => void;
}

export function ExecutionLog({ 
  agentId, 
  sessionId, 
  isActive = false,
  steps = [],
  onClear 
}: ExecutionLogProps) {
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>(steps);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    if (isAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionSteps, isAutoScroll]);

  // Update steps when props change
  useEffect(() => {
    setExecutionSteps(steps);
  }, [steps]);

  // Simulate real-time step updates (in real implementation, this would come from WebSocket)
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // This would be replaced with actual WebSocket updates
      const mockStep: ExecutionStep = {
        id: `step_${Date.now()}`,
        timestamp: new Date(),
        action: 'Analyzing page structure...',
        status: 'running'
      };
      
      // Only add if we don't have too many steps (prevent memory issues)
      setExecutionSteps(prev => {
        if (prev.length > 100) {
          return [...prev.slice(-50), mockStep];
        }
        return [...prev, mockStep];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive]);

  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.toLowerCase().includes('click')) {
      return <MousePointer className="h-3 w-3 text-blue-400" />;
    }
    if (action.toLowerCase().includes('type') || action.toLowerCase().includes('input')) {
      return <Keyboard className="h-3 w-3 text-green-400" />;
    }
    if (action.toLowerCase().includes('navigate') || action.toLowerCase().includes('goto')) {
      return <Navigation className="h-3 w-3 text-purple-400" />;
    }
    return <Eye className="h-3 w-3 text-gray-400" />;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  };

  const clearLog = () => {
    setExecutionSteps([]);
    onClear?.();
  };

  const exportLog = () => {
    const logData = executionSteps.map(step => ({
      timestamp: step.timestamp.toISOString(),
      action: step.action,
      target: step.target,
      status: step.status,
      duration: step.duration,
      details: step.details
    }));
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation-log-${agentId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-[400px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">Execution Log</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {executionSteps.length} steps
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`text-xs ${isAutoScroll ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              Auto-scroll {isAutoScroll ? 'ON' : 'OFF'}
            </Button>
            
            {executionSteps.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportLog}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearLog}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4" ref={scrollAreaRef}>
          {executionSteps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Terminal className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                No automation steps yet
              </h3>
              <p className="text-xs text-gray-500">
                Execution steps will appear here when browser automation starts
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-4">
              {executionSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    step.status === 'running' 
                      ? 'bg-blue-50 border-blue-200' 
                      : step.status === 'completed'
                      ? 'bg-green-50 border-green-200'
                      : step.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(step.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 font-mono">
                        #{index + 1}
                      </span>
                      <span className="text-xs text-gray-500">
                        {step.timestamp.toLocaleTimeString()}
                      </span>
                      {step.duration && (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {formatDuration(step.duration)}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-1">
                      {getActionIcon(step.action)}
                      <span className="text-sm font-medium text-gray-900">
                        {step.action}
                      </span>
                    </div>
                    
                    {step.target && (
                      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                        Target: {step.target}
                      </div>
                    )}
                    
                    {step.details && (
                      <div className="text-xs text-gray-600 mt-1">
                        {step.details}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}