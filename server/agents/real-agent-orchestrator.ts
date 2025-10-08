/**
 * REAL Agent Orchestrator
 * 
 * Coordinates multiple real AI agents with intelligent routing
 * Replaces all stub implementations with actual functionality
 */

import { EventEmitter } from 'events';
import { logger } from '../logger';
import { RealBrowserUseAgent } from './real-browser-use-agent';
import { RealSkyvernAgent } from './real-skyvern-agent';
import { RealLaVagueAgent } from './real-lavague-agent';
import { RealStagehandAgent } from './real-stagehand-agent';

export interface RealAgentTask {
  id: string;
  instruction: string;
  sessionId: string;
  context?: Record<string, any>;
  priority: number;
  agentType?: string;
}

export interface RealAgentResult {
  success: boolean;
  taskId: string;
  agentType: string;
  result: any;
  executionTime: number;
  actionsExecuted: number;
  screenshot?: string;
}

export class RealAgentOrchestrator extends EventEmitter {
  private agents: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private workerUrl: string;

  constructor(workerUrl: string = 'https://worker-production-6480.up.railway.app') {
    super();
    this.workerUrl = workerUrl;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🚀 Real Agent Orchestrator: Initializing all real agents...');
      
      // Initialize all real agents
      const agentConfigs = [
        { name: 'browser-use', agent: new RealBrowserUseAgent(this.workerUrl) },
        { name: 'skyvern', agent: new RealSkyvernAgent(this.workerUrl) },
        { name: 'lavague', agent: new RealLaVagueAgent(this.workerUrl) },
        { name: 'stagehand', agent: new RealStagehandAgent(this.workerUrl) }
      ];

      for (const { name, agent } of agentConfigs) {
        try {
          await agent.initialize();
          this.agents.set(name, agent);
          logger.info(`✅ Real Agent Orchestrator: ${name} agent initialized`);
        } catch (error) {
          logger.warn(`⚠️ Real Agent Orchestrator: ${name} agent initialization failed:`, error);
        }
      }

      this.isInitialized = true;
      logger.info(`📋 Real Agent Orchestrator: ${this.agents.size} real agents ready`);

    } catch (error) {
      logger.error('❌ Real Agent Orchestrator: Initialization failed:', error);
      throw error;
    }
  }

  async executeTaskWithRealAgent(task: RealAgentTask): Promise<RealAgentResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Intelligent agent selection
      const agentType = task.agentType || await this.selectBestAgent(task);
      const agent = this.agents.get(agentType);
      
      if (!agent) {
        throw new Error(`Real agent ${agentType} not found`);
      }

      logger.info('🎯 Real Agent Orchestrator: Executing task with real agent', {
        taskId: task.id,
        agentType,
        instruction: task.instruction,
        sessionId: task.sessionId
      });

      // Execute with selected real agent
      const result = await agent.executeTask({
        id: task.id,
        instruction: task.instruction,
        sessionId: task.sessionId,
        context: task.context,
        priority: task.priority
      });

      const executionTime = Date.now() - startTime;

      logger.info('✅ Real Agent Orchestrator: Real task completed', {
        taskId: task.id,
        agentType,
        success: result.success,
        executionTime: `${executionTime}ms`,
        actionsExecuted: result.actionsExecuted || 0
      });

      return {
        success: result.success,
        taskId: task.id,
        agentType,
        result: result.result,
        executionTime,
        actionsExecuted: result.actionsExecuted || 0,
        screenshot: result.screenshot
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Real Agent Orchestrator: Real task failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        agentType: task.agentType || 'unknown',
        result: { error: error instanceof Error ? error.message : 'Unknown error' },
        executionTime,
        actionsExecuted: 0
      };
    }
  }

  private async selectBestAgent(task: RealAgentTask): Promise<string> {
    const instruction = task.instruction.toLowerCase();
    
    // Intelligent routing based on task characteristics
    if (instruction.includes('visual') || instruction.includes('screenshot') || instruction.includes('image')) {
      return 'skyvern';
    }
    
    if (instruction.includes('workflow') || instruction.includes('multi-step') || instruction.includes('complex')) {
      return 'lavague';
    }
    
    if (instruction.includes('spa') || instruction.includes('dynamic') || instruction.includes('javascript')) {
      return 'stagehand';
    }
    
    // Default to browser-use for general tasks
    return 'browser-use';
  }

  async getAvailableAgents(): Promise<string[]> {
    return Array.from(this.agents.keys());
  }

  async getAgentStatus(agentType: string): Promise<any> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      return { status: 'not_found' };
    }
    
    return await agent.getStatus();
  }

  async getAllAgentStatuses(): Promise<Record<string, any>> {
    const statuses: Record<string, any> = {};
    
    for (const [name, agent] of this.agents) {
      try {
        statuses[name] = await agent.getStatus();
      } catch (error) {
        statuses[name] = { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    return statuses;
  }
}
