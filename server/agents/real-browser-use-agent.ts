/**
 * REAL Browser-Use Agent Implementation
 * 
 * Integrates with the actual Browser-Use Python framework
 * Sends tasks to Python worker that uses browser-use library
 */

import { EventEmitter } from 'events';
import { logger } from '../logger';

export interface BrowserUseTask {
  id: string;
  instruction: string;
  sessionId: string;
  context?: Record<string, any>;
  priority: number;
}

export interface BrowserUseResult {
  success: boolean;
  taskId: string;
  result: any;
  executionTime: number;
  actionsExecuted: number;
  screenshot?: string;
}

export class RealBrowserUseAgent extends EventEmitter {
  private isInitialized: boolean = false;
  private workerUrl: string;

  constructor(workerUrl: string = 'https://worker-production-6480.up.railway.app') {
    super();
    this.workerUrl = workerUrl;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🚀 Browser-Use Agent: Initializing real agent...');
      
      // Test connection to worker
      const response = await fetch(`${this.workerUrl}/health`);
      if (!response.ok) {
        throw new Error(`Worker health check failed: ${response.status}`);
      }

      this.isInitialized = true;
      logger.info('✅ Browser-Use Agent: Real agent initialized successfully');
      
    } catch (error) {
      logger.error('❌ Browser-Use Agent: Initialization failed:', error);
      throw error;
    }
  }

  async executeTask(task: BrowserUseTask): Promise<BrowserUseResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🎯 Browser-Use Agent: Executing real task', {
        taskId: task.id,
        instruction: task.instruction,
        sessionId: task.sessionId
      });

      // Send task to Python worker with browser-use integration
      const response = await fetch(`${this.workerUrl}/browser-use-task`, {
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
          agentType: 'browser-use'
        })
      });

      if (!response.ok) {
        throw new Error(`Browser-Use task failed: ${response.status}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      logger.info('✅ Browser-Use Agent: Real task completed', {
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
        screenshot: result.screenshot
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Browser-Use Agent: Real task failed', {
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
      'navigation',
      'clicking',
      'typing',
      'form_filling',
      'data_extraction',
      'screenshot_analysis',
      'multi_step_workflows',
      'human_like_interactions'
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
