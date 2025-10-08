/**
 * REAL LaVague Agent Implementation
 * 
 * Integrates with the actual LaVague AI framework
 * Uses Large Action Models for complex multi-step workflows
 */

import { EventEmitter } from 'events';
import { logger } from '../logger';

export interface LaVagueTask {
  id: string;
  instruction: string;
  sessionId: string;
  context?: Record<string, any>;
  priority: number;
  workflowType?: 'simple' | 'complex' | 'multi_step';
}

export interface LaVagueResult {
  success: boolean;
  taskId: string;
  result: any;
  executionTime: number;
  actionsExecuted: number;
  screenshot?: string;
  workflowSteps?: any[];
}

export class RealLaVagueAgent extends EventEmitter {
  private isInitialized: boolean = false;
  private workerUrl: string;

  constructor(workerUrl: string = 'https://worker-production-6480.up.railway.app') {
    super();
    this.workerUrl = workerUrl;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🚀 LaVague Agent: Initializing real agent...');
      
      // Test connection to worker
      const response = await fetch(`${this.workerUrl}/health`);
      if (!response.ok) {
        throw new Error(`Worker health check failed: ${response.status}`);
      }

      this.isInitialized = true;
      logger.info('✅ LaVague Agent: Real agent initialized successfully');
      
    } catch (error) {
      logger.error('❌ LaVague Agent: Initialization failed:', error);
      throw error;
    }
  }

  async executeTask(task: LaVagueTask): Promise<LaVagueResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🎯 LaVague Agent: Executing real task', {
        taskId: task.id,
        instruction: task.instruction,
        sessionId: task.sessionId,
        workflowType: task.workflowType
      });

      // Send task to Python worker with LaVague integration
      const response = await fetch(`${this.workerUrl}/lavague-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: task.id,
          instruction: task.instruction,
          sessionId: task.sessionId,
          context: task.context,
          priority: task.priority,
          agentType: 'lavague',
          workflowType: task.workflowType
        })
      });

      if (!response.ok) {
        throw new Error(`LaVague task failed: ${response.status}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      logger.info('✅ LaVague Agent: Real task completed', {
        taskId: task.id,
        success: result.success,
        executionTime: `${executionTime}ms`,
        actionsExecuted: result.actionsExecuted || 0
      });

      return {
        success: result.success,
        taskId: task.id,
        result: result.data,
        executionTime,
        actionsExecuted: result.actionsExecuted || 0,
        screenshot: result.screenshot,
        workflowSteps: result.workflowSteps
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ LaVague Agent: Real task failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        result: { error: error instanceof Error ? error.message : 'Unknown error' },
        executionTime,
        actionsExecuted: 0
      };
    }
  }

  async getCapabilities(): Promise<string[]> {
    return [
      'large_action_models',
      'complex_workflows',
      'multi_step_automation',
      'context_awareness',
      'planning',
      'workflow_orchestration',
      'intelligent_routing',
      'adaptive_execution'
    ];
  }

  async getStatus(): Promise<{ status: string; capabilities: string[]; lastActivity: Date }> {
    return {
      status: this.isInitialized ? 'active' : 'inactive',
      capabilities: await this.getCapabilities(),
      lastActivity: new Date()
    };
  }
}
