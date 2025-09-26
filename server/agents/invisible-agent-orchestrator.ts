/**
 * Invisible Agent Orchestrator - Real Implementation
 * Coordinates multiple AI agents invisibly for seamless automation
 */

import { logger } from '../logger';
import { EventEmitter } from 'events';
import UITarsAgent from './ui-tars-agent';
import LocalAgentManager from './local-agent-manager';
import BrowserUseAgent from './browser-use-agent';
import SkyvernAgent from './skyvern-agent';
import LaVagueAgent from './lavague-agent';
import StagehandAgent from './stagehand-agent';
import PlaywrightVisionAgent from './playwright-vision-agent';
import PuppeteerAIAgent from './puppeteer-ai-agent';
import RuleBasedPlannerAgent from './rule-based-planner-agent';
import CheerioExtractorAgent from './cheerio-extractor-agent';
import BrowserChatAgent from './browser-chat-agent';

export interface InvisibleOrchestratorConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retries: number;
  invisibleMode: boolean;
  coordinationStrategy: 'sequential' | 'parallel' | 'adaptive';
}

export interface InvisibleTask {
  id: string;
  sessionId: string;
  instruction: string;
  context?: any;
  priority?: number;
  invisible?: boolean;
}

export interface InvisibleResult {
  success: boolean;
  result?: {
    message: string;
    agents: string[];
    coordination: any;
    performance: any;
  };
  error?: string;
  executionTime?: number;
}

export class InvisibleAgentOrchestrator extends EventEmitter {
  private config: InvisibleOrchestratorConfig;
  private agents: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private activeTasks: Map<string, any> = new Map();
  private taskQueue: InvisibleTask[] = [];
  private performanceMetrics: Map<string, any> = new Map();

  constructor(config?: Partial<InvisibleOrchestratorConfig>) {
    super();
    this.config = {
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 5,
      taskTimeout: config?.taskTimeout ?? 60000,
      retries: config?.retries ?? 3,
      invisibleMode: config?.invisibleMode ?? true,
      coordinationStrategy: config?.coordinationStrategy ?? 'adaptive'
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Invisible Orchestrator: Initializing real agent coordination...');

      // Initialize all agents
      await this.initializeAgents();
      
      // Start coordination engine
      await this.startCoordinationEngine();
      
      this.isInitialized = true;
      logger.info('✅ Invisible Orchestrator: Real agent coordination initialized');
    } catch (error) {
      logger.error('❌ Invisible Orchestrator: Initialization failed:', error);
      throw error;
    }
  }

  private async initializeAgents(): Promise<void> {
    const agentConfigs = [
      { name: 'ui-tars', agent: new UITarsAgent() },
      { name: 'local-manager', agent: new LocalAgentManager() },
      { name: 'browser-use', agent: new BrowserUseAgent() },
      { name: 'skyvern', agent: new SkyvernAgent() },
      { name: 'lavague', agent: new LaVagueAgent() },
      { name: 'stagehand', agent: new StagehandAgent() },
      { name: 'playwright-vision', agent: new PlaywrightVisionAgent() },
      { name: 'puppeteer-ai', agent: new PuppeteerAIAgent() },
      { name: 'rule-planner', agent: new RuleBasedPlannerAgent() },
      { name: 'cheerio-extractor', agent: new CheerioExtractorAgent() },
      { name: 'browser-chat', agent: new BrowserChatAgent() }
    ];

    for (const { name, agent } of agentConfigs) {
      try {
        await agent.initialize();
        this.agents.set(name, agent);
        logger.info(`✅ Invisible Orchestrator: ${name} agent initialized`);
      } catch (error) {
        logger.warn(`⚠️ Invisible Orchestrator: ${name} agent initialization failed:`, error);
      }
    }

    logger.info(`📋 Invisible Orchestrator: ${this.agents.size} agents ready for coordination`);
  }

  private async startCoordinationEngine(): Promise<void> {
    // Start task processing loop
    setInterval(() => {
      this.processTaskQueue();
    }, 1000);

    logger.info('🔄 Invisible Orchestrator: Coordination engine started');
  }

  async executeTask(task: InvisibleTask): Promise<InvisibleResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🎯 Invisible Orchestrator: Executing real coordinated task', {
        taskId: task.id,
        instruction: task.instruction,
        invisible: task.invisible,
        priority: task.priority
      });

      // Add task to queue
      this.taskQueue.push(task);
      
      // Wait for task completion
      const result = await this.waitForTaskCompletion(task.id);

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Invisible Orchestrator: Coordinated task completed', {
        taskId: task.id,
        agents: result.agents,
        executionTime
      });

      return {
        success: true,
        result: {
          message: 'Invisible Orchestrator coordination completed successfully',
          agents: result.agents,
          coordination: result.coordination,
          performance: result.performance
        },
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Invisible Orchestrator: Coordinated task failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invisible Orchestrator execution failed',
        executionTime
      };
    }
  }

  private async processTaskQueue(): Promise<void> {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    if (this.taskQueue.length === 0) {
      return;
    }

    // Sort tasks by priority
    this.taskQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const task = this.taskQueue.shift();
    if (!task) return;

    // Start task execution
    this.activeTasks.set(task.id, {
      task: task,
      startTime: Date.now(),
      status: 'running'
    });

    // Execute task with coordination
    this.executeCoordinatedTask(task).catch(error => {
      logger.error(`❌ Invisible Orchestrator: Task ${task.id} failed:`, error);
      this.activeTasks.delete(task.id);
    });
  }

  private async executeCoordinatedTask(task: InvisibleTask): Promise<void> {
    try {
      // Select optimal agents for the task
      const selectedAgents = await this.selectOptimalAgents(task);
      
      // Execute coordination strategy
      const result = await this.executeCoordinationStrategy(task, selectedAgents);
      
      // Update performance metrics
      this.updatePerformanceMetrics(task.id, result);
      
      // Complete task
      this.activeTasks.set(task.id, {
        ...this.activeTasks.get(task.id),
        status: 'completed',
        result: result
      });

      // Emit completion event
      this.emit('taskCompleted', {
        taskId: task.id,
        result: result
      });

    } catch (error) {
      this.activeTasks.set(task.id, {
        ...this.activeTasks.get(task.id),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.emit('taskFailed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async selectOptimalAgents(task: InvisibleTask): Promise<string[]> {
    const instruction = task.instruction.toLowerCase();
    const selectedAgents: string[] = [];

    // Rule-based agent selection
    if (instruction.includes('visual') || instruction.includes('screenshot')) {
      selectedAgents.push('ui-tars', 'skyvern', 'playwright-vision');
    }

    if (instruction.includes('form') || instruction.includes('input')) {
      selectedAgents.push('browser-use', 'browser-chat');
    }

    if (instruction.includes('complex') || instruction.includes('workflow')) {
      selectedAgents.push('lavague', 'rule-planner');
    }

    if (instruction.includes('javascript') || instruction.includes('spa')) {
      selectedAgents.push('stagehand', 'puppeteer-ai');
    }

    if (instruction.includes('extract') || instruction.includes('parse')) {
      selectedAgents.push('cheerio-extractor');
    }

    if (instruction.includes('chat') || instruction.includes('conversation')) {
      selectedAgents.push('browser-chat');
    }

    // Default agents if none selected
    if (selectedAgents.length === 0) {
      selectedAgents.push('browser-use', 'local-manager');
    }

    return selectedAgents;
  }

  private async executeCoordinationStrategy(task: InvisibleTask, agents: string[]): Promise<any> {
    switch (this.config.coordinationStrategy) {
      case 'sequential':
        return await this.executeSequentialCoordination(task, agents);
      case 'parallel':
        return await this.executeParallelCoordination(task, agents);
      case 'adaptive':
        return await this.executeAdaptiveCoordination(task, agents);
      default:
        return await this.executeSequentialCoordination(task, agents);
    }
  }

  private async executeSequentialCoordination(task: InvisibleTask, agents: string[]): Promise<any> {
    const results: any[] = [];
    const coordination: any = {
      strategy: 'sequential',
      agents: agents,
      steps: []
    };

    for (const agentName of agents) {
      try {
        const agent = this.agents.get(agentName);
        if (!agent) continue;

        const stepStartTime = Date.now();
        const result = await agent.executeTask(task);
        const stepExecutionTime = Date.now() - stepStartTime;

        results.push(result);
        coordination.steps.push({
          agent: agentName,
          success: result.success,
          executionTime: stepExecutionTime
        });

        // If task is successful, we can stop
        if (result.success) {
          break;
        }

      } catch (error) {
        logger.warn(`⚠️ Invisible Orchestrator: Agent ${agentName} failed:`, error);
        coordination.steps.push({
          agent: agentName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: results.some(r => r.success),
      results: results,
      coordination: coordination
    };
  }

  private async executeParallelCoordination(task: InvisibleTask, agents: string[]): Promise<any> {
    const coordination: any = {
      strategy: 'parallel',
      agents: agents,
      steps: []
    };

    const promises = agents.map(async (agentName) => {
      try {
        const agent = this.agents.get(agentName);
        if (!agent) return null;

        const stepStartTime = Date.now();
        const result = await agent.executeTask(task);
        const stepExecutionTime = Date.now() - stepStartTime;

        coordination.steps.push({
          agent: agentName,
          success: result.success,
          executionTime: stepExecutionTime
        });

        return result;
      } catch (error) {
        logger.warn(`⚠️ Invisible Orchestrator: Agent ${agentName} failed:`, error);
        coordination.steps.push({
          agent: agentName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r && r.success);

    return {
      success: successfulResults.length > 0,
      results: results,
      coordination: coordination
    };
  }

  private async executeAdaptiveCoordination(task: InvisibleTask, agents: string[]): Promise<any> {
    // Start with parallel execution
    const parallelResult = await this.executeParallelCoordination(task, agents);
    
    // If parallel execution fails, try sequential
    if (!parallelResult.success) {
      return await this.executeSequentialCoordination(task, agents);
    }
    
    return parallelResult;
  }

  private async waitForTaskCompletion(taskId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const task = this.activeTasks.get(taskId);
        
        if (!task) {
          clearInterval(checkInterval);
          reject(new Error('Task not found'));
          return;
        }

        if (task.status === 'completed') {
          clearInterval(checkInterval);
          this.activeTasks.delete(taskId);
          resolve(task.result);
          return;
        }

        if (task.status === 'failed') {
          clearInterval(checkInterval);
          this.activeTasks.delete(taskId);
          reject(new Error(task.error || 'Task failed'));
          return;
        }

        // Check timeout
        if (Date.now() - task.startTime > this.config.taskTimeout) {
          clearInterval(checkInterval);
          this.activeTasks.delete(taskId);
          reject(new Error('Task timeout'));
          return;
        }
      }, 100);
    });
  }

  private updatePerformanceMetrics(taskId: string, result: any): void {
    const metrics = {
      taskId: taskId,
      timestamp: new Date().toISOString(),
      success: result.success,
      agents: result.coordination?.agents || [],
      executionTime: result.coordination?.steps?.reduce((total: number, step: any) => total + (step.executionTime || 0), 0) || 0
    };

    this.performanceMetrics.set(taskId, metrics);
  }

  async getActiveTasks(): Promise<any[]> {
    return Array.from(this.activeTasks.values());
  }

  async getTaskQueue(): Promise<InvisibleTask[]> {
    return [...this.taskQueue];
  }

  async getPerformanceMetrics(): Promise<any[]> {
    return Array.from(this.performanceMetrics.values());
  }

  async getAgentStatus(): Promise<any> {
    const agentStatus: any = {};
    
    for (const [name, agent] of this.agents) {
      try {
        agentStatus[name] = {
          initialized: true,
          health: await agent.healthCheck(),
          capabilities: agent.getCapabilities ? agent.getCapabilities() : [],
          status: agent.getStatus ? agent.getStatus() : {}
        };
      } catch (error) {
        agentStatus[name] = {
          initialized: false,
          health: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return agentStatus;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Check if at least one agent is healthy
      const agentStatus = await this.getAgentStatus();
      const healthyAgents = Object.values(agentStatus).filter((status: any) => status.health);
      
      return healthyAgents.length > 0;
    } catch {
      return false;
    }
  }

  getCapabilities(): string[] {
    return [
      'invisible_coordination',
      'multi_agent_orchestration',
      'adaptive_strategies',
      'performance_monitoring',
      'task_queue_management',
      'real_time_coordination',
      'agent_selection',
      'coordination_strategies',
      'event_emission',
      'metrics_tracking'
    ];
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      coordinationStrategy: this.config.coordinationStrategy,
      invisibleMode: this.config.invisibleMode,
      capabilities: this.getCapabilities()
    };
  }

  async shutdown(): Promise<void> {
    try {
      // Clear task queue
      this.taskQueue = [];
      
      // Wait for active tasks to complete
      const activeTaskIds = Array.from(this.activeTasks.keys());
      for (const taskId of activeTaskIds) {
        try {
          await this.waitForTaskCompletion(taskId);
        } catch (error) {
          logger.warn(`⚠️ Invisible Orchestrator: Task ${taskId} did not complete during shutdown`);
        }
      }
      
      // Close all agents
      for (const [name, agent] of this.agents) {
        try {
          if (agent.close) {
            await agent.close();
          }
        } catch (error) {
          logger.warn(`⚠️ Invisible Orchestrator: Error closing agent ${name}:`, error);
        }
      }
      
      this.agents.clear();
      this.activeTasks.clear();
      this.performanceMetrics.clear();
      this.isInitialized = false;
      
      logger.info('✅ Invisible Orchestrator: Shutdown completed');
    } catch (error) {
      logger.error('❌ Invisible Orchestrator: Error during shutdown:', error);
    }
  }
}

export default InvisibleAgentOrchestrator;
