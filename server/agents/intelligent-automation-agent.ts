/**
 * Intelligent Automation Agent - Single Agent Architecture
 * Replaces MCP multi-agent approach with one intelligent agent using multiple tools
 */

import { logger } from '../logger';
import { EventEmitter } from 'events';

export interface AutomationTask {
  id: string;
  sessionId: string;
  command: string;
  context?: any;
  priority?: 'low' | 'medium' | 'high';
}

export interface AutomationResult {
  success: boolean;
  message: string;
  data?: any;
  screenshot?: string;
  executionTime?: number;
  toolUsed?: string;
  error?: string;
}

export interface AutomationTool {
  name: string;
  capabilities: string[];
  execute(task: AutomationTask): Promise<AutomationResult>;
  isAvailable(): boolean;
}

export class IntelligentAutomationAgent extends EventEmitter {
  private tools: Map<string, AutomationTool> = new Map();
  private activeTasks: Map<string, AutomationTask> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🤖 Intelligent Agent: Initializing single agent architecture...');

      // Initialize core automation tools
      await this.initializeTools();

      this.isInitialized = true;
      logger.info('✅ Intelligent Agent: Single agent architecture ready');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('❌ Intelligent Agent: Initialization failed:', error);
      throw error;
    }
  }

  private async initializeTools(): Promise<void> {
    // Primary browser automation tool
    const browserUseTool: AutomationTool = {
      name: 'browser-use',
      capabilities: ['click', 'type', 'navigate', 'form-fill', 'extract', 'scroll'],
      execute: async (task: AutomationTask) => {
        logger.info(`🌐 Browser-Use: Executing task ${task.id}`);
        
        // Queue task to worker for actual execution
        const result = await this.queueToWorker(task, 'browser-use');
        
        return {
          success: true,
          message: 'Browser automation completed successfully',
          data: result,
          toolUsed: 'browser-use',
          executionTime: Date.now() - parseInt(task.id.split('_')[1])
        };
      },
      isAvailable: () => true
    };

    // Computer vision tool for visual tasks
    const visionTool: AutomationTool = {
      name: 'computer-vision',
      capabilities: ['screenshot', 'visual-element', 'ocr', 'image-analysis'],
      execute: async (task: AutomationTask) => {
        logger.info(`👁️ Vision: Executing visual task ${task.id}`);
        
        const result = await this.queueToWorker(task, 'vision');
        
        return {
          success: true,
          message: 'Visual automation completed successfully',
          data: result,
          toolUsed: 'computer-vision',
          executionTime: Date.now() - parseInt(task.id.split('_')[1])
        };
      },
      isAvailable: () => true
    };

    // JavaScript execution tool for dynamic content
    const scriptTool: AutomationTool = {
      name: 'javascript',
      capabilities: ['execute-script', 'dom-manipulation', 'spa-interaction'],
      execute: async (task: AutomationTask) => {
        logger.info(`⚡ JavaScript: Executing script task ${task.id}`);
        
        const result = await this.queueToWorker(task, 'javascript');
        
        return {
          success: true,
          message: 'JavaScript execution completed successfully',
          data: result,
          toolUsed: 'javascript',
          executionTime: Date.now() - parseInt(task.id.split('_')[1])
        };
      },
      isAvailable: () => true
    };

    // Register tools
    this.tools.set('browser-use', browserUseTool);
    this.tools.set('computer-vision', visionTool);
    this.tools.set('javascript', scriptTool);

    logger.info(`📋 Intelligent Agent: ${this.tools.size} tools registered`);
  }

  async executeTask(task: AutomationTask): Promise<AutomationResult> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🎯 Intelligent Agent: Analyzing task', {
        taskId: task.id,
        command: task.command,
        sessionId: task.sessionId
      });

      // Store active task
      this.activeTasks.set(task.id, task);

      // Analyze command and select appropriate tool
      const selectedTool = this.selectOptimalTool(task.command);
      
      if (!selectedTool) {
        throw new Error('No suitable tool found for task');
      }

      logger.info(`🔧 Intelligent Agent: Using ${selectedTool.name} for task ${task.id}`);

      // Execute with selected tool
      const result = await selectedTool.execute(task);

      // Clean up
      this.activeTasks.delete(task.id);

      // Emit completion event
      this.emit('taskCompleted', {
        taskId: task.id,
        result: result,
        toolUsed: selectedTool.name
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Intelligent Agent: Task execution failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      // Clean up
      this.activeTasks.delete(task.id);

      // Emit failure event
      this.emit('taskFailed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: 'Task execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  private selectOptimalTool(command: string): AutomationTool | null {
    const commandLower = command.toLowerCase();

    // Rule-based tool selection (fast and reliable)
    if (commandLower.includes('screenshot') || commandLower.includes('visual') || commandLower.includes('image')) {
      return this.tools.get('computer-vision') || null;
    }

    if (commandLower.includes('javascript') || commandLower.includes('script') || commandLower.includes('spa')) {
      return this.tools.get('javascript') || null;
    }

    // Default to browser-use for general automation
    return this.tools.get('browser-use') || null;
  }

  private async queueToWorker(task: AutomationTask, toolType: string): Promise<any> {
    // Queue task to worker for execution
    // This replaces the complex MCP routing with simple worker queuing
    
    const workerTask = {
      id: task.id,
      sessionId: task.sessionId,
      instruction: task.command,
      type: toolType,
      priority: task.priority || 'medium',
      timestamp: new Date().toISOString()
    };

    // In production, this would queue to Redis for worker consumption
    logger.info(`📤 Intelligent Agent: Queuing task to worker`, {
      taskId: task.id,
      toolType,
      sessionId: task.sessionId
    });

    // Simulate worker execution (replace with actual worker communication)
    return {
      status: 'completed',
      message: `Task executed successfully with ${toolType}`,
      timestamp: new Date().toISOString()
    };
  }

  getActiveTasks(): AutomationTask[] {
    return Array.from(this.activeTasks.values());
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys()).filter(toolName => {
      const tool = this.tools.get(toolName);
      return tool?.isAvailable() || false;
    });
  }

  getCapabilities(): string[] {
    const allCapabilities: string[] = [];
    
    for (const tool of this.tools.values()) {
      allCapabilities.push(...tool.capabilities);
    }

    return [...new Set(allCapabilities)]; // Remove duplicates
  }

  async shutdown(): Promise<void> {
    logger.info('🔄 Intelligent Agent: Shutting down...');
    
    // Cancel active tasks
    for (const taskId of this.activeTasks.keys()) {
      this.activeTasks.delete(taskId);
    }

    // Clear tools
    this.tools.clear();
    
    this.isInitialized = false;
    
    logger.info('✅ Intelligent Agent: Shutdown complete');
  }
}

export default IntelligentAutomationAgent;