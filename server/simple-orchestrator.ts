/**
 * Simple Orchestrator - Replaces Complex MCP System
 * Single point of coordination using the Intelligent Automation Agent
 */

import { logger } from './logger';
import IntelligentAutomationAgent, { AutomationTask, AutomationResult } from './agents/intelligent-automation-agent';
import BrowserInstanceManager from './browser-instance-manager';
import { EventEmitter } from 'events';

export interface OrchestrationRequest {
  sessionId: string;
  command: string;
  context?: any;
  priority?: 'low' | 'medium' | 'high';
  timeout?: number;
}

export interface OrchestrationResponse {
  success: boolean;
  message: string;
  data?: any;
  executionTime: number;
  taskId: string;
  toolUsed?: string;
  error?: string;
}

export class SimpleOrchestrator extends EventEmitter {
  private agent: IntelligentAutomationAgent;
  private browserManager: BrowserInstanceManager;
  private activeTasks: Map<string, AutomationTask> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.setMaxListeners(100);
    
    this.agent = new IntelligentAutomationAgent();
    this.browserManager = new BrowserInstanceManager();
    
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🎯 Simple Orchestrator: Initializing...');

      // Initialize the single intelligent agent
      await this.agent.initialize();

      this.isInitialized = true;
      
      logger.info('✅ Simple Orchestrator: Ready with single agent architecture');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('❌ Simple Orchestrator: Initialization failed:', error);
      throw error;
    }
  }

  async executeCommand(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const startTime = Date.now();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🚀 Simple Orchestrator: Executing command', {
        taskId,
        sessionId: request.sessionId,
        command: request.command,
        priority: request.priority || 'medium'
      });

      // Create automation task
      const task: AutomationTask = {
        id: taskId,
        sessionId: request.sessionId,
        command: request.command,
        context: request.context,
        priority: request.priority || 'medium'
      };

      // Store active task
      this.activeTasks.set(taskId, task);

      // Acquire browser session if needed
      let browserId: string | null = null;
      if (this.requiresBrowser(request.command)) {
        browserId = await this.browserManager.acquireBrowserSession({
          sessionId: request.sessionId,
          taskId: taskId,
          priority: request.priority || 'medium',
          timeout: request.timeout
        });

        // Add browser context to task
        task.context = {
          ...task.context,
          browserId: browserId
        };
      }

      // Execute with intelligent agent
      const result = await this.agent.executeTask(task);

      // Release browser session
      if (browserId) {
        await this.browserManager.releaseBrowserSession(browserId);
      }

      // Clean up
      this.activeTasks.delete(taskId);

      const executionTime = Date.now() - startTime;

      const response: OrchestrationResponse = {
        success: result.success,
        message: result.message,
        data: result.data,
        executionTime: executionTime,
        taskId: taskId,
        toolUsed: result.toolUsed,
        error: result.error
      };

      logger.info('✅ Simple Orchestrator: Command completed', {
        taskId,
        success: result.success,
        executionTime,
        toolUsed: result.toolUsed
      });

      this.emit('commandCompleted', response);

      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Simple Orchestrator: Command failed', {
        taskId,
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      // Clean up
      this.activeTasks.delete(taskId);

      const response: OrchestrationResponse = {
        success: false,
        message: 'Command execution failed',
        executionTime: executionTime,
        taskId: taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('commandFailed', response);

      return response;
    }
  }

  private requiresBrowser(command: string): boolean {
    const commandLower = command.toLowerCase();
    
    // Commands that require browser automation
    const browserKeywords = [
      'click', 'navigate', 'type', 'fill', 'submit', 'scroll',
      'screenshot', 'extract', 'scrape', 'automation',
      'browser', 'page', 'element', 'form', 'button'
    ];

    return browserKeywords.some(keyword => commandLower.includes(keyword));
  }

  private setupEventHandlers(): void {
    // Agent event handlers
    this.agent.on('taskCompleted', (event) => {
      logger.info('🎉 Agent task completed', event);
    });

    this.agent.on('taskFailed', (event) => {
      logger.error('💥 Agent task failed', event);
    });

    // Browser manager event handlers
    this.browserManager.on('sessionCreated', (event) => {
      logger.info('🌐 Browser session created', event);
    });

    this.browserManager.on('sessionClosed', (event) => {
      logger.info('🔒 Browser session closed', event);
    });
  }

  getSystemStatus(): any {
    return {
      orchestrator: {
        initialized: this.isInitialized,
        activeTasks: this.activeTasks.size,
        taskIds: Array.from(this.activeTasks.keys())
      },
      agent: {
        availableTools: this.agent.getAvailableTools(),
        capabilities: this.agent.getCapabilities(),
        activeTasks: this.agent.getActiveTasks().length
      },
      browserManager: this.browserManager.getSessionStatus()
    };
  }

  async getTaskStatus(taskId: string): Promise<any> {
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      return {
        found: false,
        message: 'Task not found or completed'
      };
    }

    return {
      found: true,
      task: {
        id: task.id,
        sessionId: task.sessionId,
        command: task.command,
        priority: task.priority,
        status: 'active'
      }
    };
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      logger.warn('⚠️ Simple Orchestrator: Cannot cancel task - not found', { taskId });
      return false;
    }

    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    logger.info('🚫 Simple Orchestrator: Task cancelled', { taskId });
    
    this.emit('taskCancelled', { taskId });
    
    return true;
  }

  async shutdown(): Promise<void> {
    logger.info('🔄 Simple Orchestrator: Shutting down...');

    // Cancel all active tasks
    const taskIds = Array.from(this.activeTasks.keys());
    for (const taskId of taskIds) {
      await this.cancelTask(taskId);
    }

    // Shutdown components
    await this.agent.shutdown();
    await this.browserManager.shutdown();

    this.isInitialized = false;

    logger.info('✅ Simple Orchestrator: Shutdown complete');
  }
}

export default SimpleOrchestrator;