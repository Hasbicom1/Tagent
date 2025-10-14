/**
 * Eko Workflow Manager Component
 * 
 * Manages complex multi-step automation workflows using the Eko framework.
 * Provides visual feedback and progress tracking for workflow execution.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  Square, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Zap,
  Activity,
  FileText,
  Monitor
} from 'lucide-react';
import { executeWithRealEko, isEkoInitialized } from '@/eko/real-eko-integration';

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  timestamp?: Date;
}

interface EkoWorkflowManagerProps {
  workflow: string;
  onWorkflowComplete?: (result: any) => void;
  onWorkflowError?: (error: string) => void;
}

export function EkoWorkflowManager({ 
  workflow, 
  onWorkflowComplete, 
  onWorkflowError 
}: EkoWorkflowManagerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize workflow steps based on the workflow description
  useEffect(() => {
    const initializeSteps = () => {
      // Parse workflow into steps (simplified for demo)
      const workflowSteps = parseWorkflowIntoSteps(workflow);
      setSteps(workflowSteps);
      setCurrentStepIndex(0);
      setProgress(0);
    };

    initializeSteps();
  }, [workflow]);

  // Parse workflow description into executable steps
  const parseWorkflowIntoSteps = (workflowDescription: string): WorkflowStep[] => {
    // This is a simplified parser - in production, you'd use more sophisticated NLP
    const steps: WorkflowStep[] = [];
    
    // Common workflow patterns
    if (workflowDescription.toLowerCase().includes('navigate') || 
        workflowDescription.toLowerCase().includes('go to')) {
      steps.push({
        id: 'navigate',
        name: 'Navigate to Website',
        description: 'Opening the target website',
        status: 'pending'
      });
    }

    if (workflowDescription.toLowerCase().includes('search') ||
        workflowDescription.toLowerCase().includes('find')) {
      steps.push({
        id: 'search',
        name: 'Search Content',
        description: 'Searching for specified content',
        status: 'pending'
      });
    }

    if (workflowDescription.toLowerCase().includes('click') ||
        workflowDescription.toLowerCase().includes('select')) {
      steps.push({
        id: 'interact',
        name: 'Interact with Elements',
        description: 'Clicking or selecting page elements',
        status: 'pending'
      });
    }

    if (workflowDescription.toLowerCase().includes('fill') ||
        workflowDescription.toLowerCase().includes('type') ||
        workflowDescription.toLowerCase().includes('enter')) {
      steps.push({
        id: 'input',
        name: 'Fill Form Data',
        description: 'Entering data into form fields',
        status: 'pending'
      });
    }

    if (workflowDescription.toLowerCase().includes('submit') ||
        workflowDescription.toLowerCase().includes('send')) {
      steps.push({
        id: 'submit',
        name: 'Submit Form',
        description: 'Submitting the completed form',
        status: 'pending'
      });
    }

    // Default step if no specific patterns found
    if (steps.length === 0) {
      steps.push({
        id: 'execute',
        name: 'Execute Task',
        description: 'Executing the requested automation',
        status: 'pending'
      });
    }

    return steps;
  };

  // Execute the workflow using Eko framework
  const executeWorkflow = async () => {
    if (!isEkoInitialized()) {
      setError('Eko framework not initialized');
      onWorkflowError?.('Eko framework not initialized');
      return;
    }

    setIsRunning(true);
    setError(null);
    setCurrentStepIndex(0);

    try {
      // Execute workflow with Eko framework
      const result = await executeWithRealEko(workflow);
      
      // Update all steps as completed
      setSteps(prev => prev.map(step => ({
        ...step,
        status: 'completed',
        result: result.result,
        timestamp: new Date()
      })));

      setProgress(100);
      setWorkflowResult(result);
      onWorkflowComplete?.(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      
      // Mark current step as failed
      setSteps(prev => prev.map((step, index) => 
        index === currentStepIndex 
          ? { ...step, status: 'failed', error: errorMessage, timestamp: new Date() }
          : step
      ));

      onWorkflowError?.(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  // Pause workflow execution
  const pauseWorkflow = () => {
    setIsPaused(true);
    // In a real implementation, you'd pause the Eko execution
  };

  // Resume workflow execution
  const resumeWorkflow = () => {
    setIsPaused(false);
    // In a real implementation, you'd resume the Eko execution
  };

  // Stop workflow execution
  const stopWorkflow = () => {
    setIsRunning(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setProgress(0);
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  const getStatusIcon = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'running':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Eko Workflow Manager
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-step automation workflow execution
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isRunning && !isPaused && (
              <Button onClick={executeWorkflow} size="sm">
                <Play className="w-4 h-4 mr-1" />
                Start
              </Button>
            )}
            {isRunning && !isPaused && (
              <Button onClick={pauseWorkflow} variant="outline" size="sm">
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button onClick={resumeWorkflow} size="sm">
                <Play className="w-4 h-4 mr-1" />
                Resume
              </Button>
            )}
            {(isRunning || isPaused) && (
              <Button onClick={stopWorkflow} variant="destructive" size="sm">
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        {/* Workflow Steps */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Workflow Steps</h4>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg border ${getStatusColor(step.status)} ${
                    index === currentStepIndex ? 'ring-2 ring-primary/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(step.status)}
                      <span className="font-medium text-sm">{step.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>
                  {step.result && (
                    <div className="mt-2 p-2 bg-green-500/5 rounded text-xs">
                      <strong>Result:</strong> {step.result}
                    </div>
                  )}
                  {step.error && (
                    <div className="mt-2 p-2 bg-red-500/5 rounded text-xs">
                      <strong>Error:</strong> {step.error}
                    </div>
                  )}
                  {step.timestamp && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {step.timestamp.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Workflow Result */}
        {workflowResult && (
          <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-medium text-sm text-green-500">Workflow Completed</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {workflowResult.result}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-sm text-red-500">Workflow Failed</span>
            </div>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}