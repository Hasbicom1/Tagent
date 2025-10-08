/**
 * REAL Stagehand Agent Implementation
 * 
 * Integrates with the actual Stagehand framework
 * Uses TypeScript/JavaScript for dynamic web app automation
 */

import { EventEmitter } from 'events';
import { logger } from '../logger';

export interface StagehandTask {
  id: string;
  instruction: string;
  sessionId: string;
  context?: Record<string, any>;
  priority: number;
  spaMode?: boolean;
  dynamicContent?: boolean;
}

export interface StagehandResult {
  success: boolean;
  taskId: string;
  result: any;
  executionTime: number;
  actionsExecuted: number;
  screenshot?: string;
  generatedCode?: string;
}

export class RealStagehandAgent extends EventEmitter {
  private isInitialized: boolean = false;
  private workerUrl: string;

  constructor(workerUrl: string = 'https://worker-production-6480.up.railway.app') {
    super();
    this.workerUrl = workerUrl;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🚀 Stagehand Agent: Initializing real agent...');
      
      // Test connection to worker
      const response = await fetch(`${this.workerUrl}/health`);
      if (!response.ok) {
        throw new Error(`Worker health check failed: ${response.status}`);
      }

      this.isInitialized = true;
      logger.info('✅ Stagehand Agent: Real agent initialized successfully');
      
    } catch (error) {
      logger.error('❌ Stagehand Agent: Initialization failed:', error);
      throw error;
    }
  }

  async executeTask(task: StagehandTask): Promise<StagehandResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🎯 Stagehand Agent: Executing real task', {
        taskId: task.id,
        instruction: task.instruction,
        sessionId: task.sessionId,
        spaMode: task.spaMode,
        dynamicContent: task.dynamicContent
      });

      // Send task to Python worker with Stagehand integration
      const response = await fetch(`${this.workerUrl}/stagehand-task`, {
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
          agentType: 'stagehand',
          spaMode: task.spaMode,
          dynamicContent: task.dynamicContent
        })
      });

      if (!response.ok) {
        throw new Error(`Stagehand task failed: ${response.status}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      logger.info('✅ Stagehand Agent: Real task completed', {
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
        generatedCode: result.generatedCode
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Stagehand Agent: Real task failed', {
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
      'typescript_automation',
      'javascript_tasks',
      'spa_automation',
      'dynamic_web_apps',
      'code_generation',
      'real_time_execution',
      'browser_control',
      'interactive_automation'
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
