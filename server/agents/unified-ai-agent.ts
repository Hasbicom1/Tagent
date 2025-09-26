/**
 * Unified AI Agent - Single Interface for Users
 * Coordinates multiple specialized agents behind the scenes
 * Users see one simple AI agent, backend uses multiple specialized agents
 */

import { logger } from '../logger';
import { EventEmitter } from 'events';
import LocalAIEngine from '../ai/local-ai-engine';
import LocalBrowserAutomationEngine from '../ai/local-browser-automation';
import LocalComputerVisionEngine from '../ai/local-computer-vision';

export interface UnifiedAgentConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retries: number;
  coordinationStrategy: 'intelligent' | 'sequential' | 'parallel';
}

export interface UnifiedTask {
  id: string;
  sessionId: string;
  message: string;
  context?: any;
  priority?: number;
}

export interface UnifiedResponse {
  success: boolean;
  message: string;
  actions?: any[];
  screenshot?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
  executionTime?: number;
}

export class UnifiedAIAgent extends EventEmitter {
  private config: UnifiedAgentConfig;
  private localAIEngine: LocalAIEngine;
  private browserEngine: LocalBrowserAutomationEngine;
  private visionEngine: LocalComputerVisionEngine;
  private isInitialized: boolean = false;
  private activeTasks: Map<string, any> = new Map();
  private conversationHistory: Map<string, any[]> = new Map();

  constructor(config?: Partial<UnifiedAgentConfig>) {
    super();
    this.config = {
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 3,
      taskTimeout: config?.taskTimeout ?? 60000,
      retries: config?.retries ?? 3,
      coordinationStrategy: config?.coordinationStrategy ?? 'intelligent'
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Unified AI Agent: Initializing local AI brain with self-contained engines...');

      // Initialize local AI engine
      this.localAIEngine = new LocalAIEngine({
        modelType: 'rule-based',
        maxTokens: 1000,
        temperature: 0.7,
        enableLocalLLM: false
      });
      await this.localAIEngine.initialize();

      // Initialize local browser automation
      this.browserEngine = new LocalBrowserAutomationEngine({
        headless: true,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timeout: 30000,
        enableScreenshots: true,
        enableVideo: false
      });
      await this.browserEngine.initialize();

      // Initialize local computer vision
      this.visionEngine = new LocalComputerVisionEngine({
        enableScreenshots: true,
        screenshotQuality: 80,
        elementDetectionThreshold: 0.7,
        enableTextRecognition: true,
        enableColorDetection: true
      });
      await this.visionEngine.initialize();
      
      this.isInitialized = true;
      logger.info('✅ Unified AI Agent: Local AI brain ready with self-contained engines');
    } catch (error) {
      logger.error('❌ Unified AI Agent: Initialization failed:', error);
      throw error;
    }
  }


  async processMessage(task: UnifiedTask): Promise<UnifiedResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🧠 Unified AI Agent: Processing user message', {
        taskId: task.id,
        message: task.message,
        sessionId: task.sessionId
      });

      // Store conversation history
      this.updateConversationHistory(task.sessionId, {
        type: 'user',
        message: task.message,
        timestamp: new Date().toISOString()
      });

      // Analyze message using local AI engine
      const analysis = await this.localAIEngine.analyzeTask(task.message);
      
      // Execute task using local browser automation
      const result = await this.executeLocalTask(task, analysis);
      
      // Generate unified response
      const response = await this.generateUnifiedResponse(result, task);

      // Store AI response in conversation history
      this.updateConversationHistory(task.sessionId, {
        type: 'ai',
        message: response.message,
        actions: response.actions,
        timestamp: new Date().toISOString()
      });

      const executionTime = Date.now() - startTime;
      response.executionTime = executionTime;

      logger.info('✅ Unified AI Agent: Message processed successfully', {
        taskId: task.id,
        confidence: response.confidence,
        executionTime
      });

      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Unified AI Agent: Message processing failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      return {
        success: false,
        message: 'I apologize, but I encountered an error processing your request. Please try again.',
        error: error instanceof Error ? error.message : 'Message processing failed',
        executionTime
      };
    }
  }

  private async executeLocalTask(task: UnifiedTask, analysis: any): Promise<any> {
    try {
      if (!analysis.isExecutable) {
        return {
          success: false,
          message: analysis.response,
          actions: [],
          confidence: analysis.confidence
        };
      }

      // Create browser automation task
      const browserTask = {
        id: task.id,
        instruction: task.message,
        type: this.determineTaskType(task.message),
        target: this.extractTarget(task.message),
        data: task.context,
        priority: 'medium' as const
      };

      // Execute using local browser automation
      const result = await this.browserEngine.executeTask(browserTask);
      
      return {
        success: result.success,
        message: result.success ? 'Task completed successfully' : 'Task failed',
        actions: result.actions || [],
        screenshot: result.screenshot,
        confidence: 0.8,
        data: result.data
      };

    } catch (error) {
      logger.error('❌ Unified AI Agent: Local task execution failed:', error);
      return {
        success: false,
        message: 'Task execution failed due to system error',
        actions: [],
        confidence: 0
      };
    }
  }

  private determineTaskType(message: string): 'navigation' | 'interaction' | 'extraction' | 'form' | 'search' {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('go to') || lowerMessage.includes('navigate') || lowerMessage.includes('visit')) {
      return 'navigation';
    } else if (lowerMessage.includes('click') || lowerMessage.includes('press') || lowerMessage.includes('tap')) {
      return 'interaction';
    } else if (lowerMessage.includes('get') || lowerMessage.includes('extract') || lowerMessage.includes('scrape')) {
      return 'extraction';
    } else if (lowerMessage.includes('form') || lowerMessage.includes('fill') || lowerMessage.includes('submit')) {
      return 'form';
    } else if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
      return 'search';
    }
    
    return 'interaction'; // Default
  }

  private extractTarget(message: string): string | undefined {
    // Extract target from message (simplified)
    const patterns = [
      /click\s+on\s+([^\s]+)/i,
      /type\s+in\s+([^\s]+)/i,
      /go\s+to\s+([^\s]+)/i,
      /search\s+for\s+([^\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private async coordinateSpecializedAgents(task: UnifiedTask, analysis: any): Promise<any> {
    const results: any[] = [];
    let totalConfidence = 0;
    let reasoning = '';

    try {
      // Select agents based on analysis
      const selectedAgents = analysis.requiredAgents.length > 0 
        ? analysis.requiredAgents 
        : ['browser-chat', 'rule-planner'];

      // Execute coordination strategy
      switch (this.config.coordinationStrategy) {
        case 'intelligent':
          return await this.executeIntelligentCoordination(task, selectedAgents, analysis);
        case 'sequential':
          return await this.executeSequentialCoordination(task, selectedAgents);
        case 'parallel':
          return await this.executeParallelCoordination(task, selectedAgents);
        default:
          return await this.executeIntelligentCoordination(task, selectedAgents, analysis);
      }

    } catch (error) {
      logger.error('❌ Unified AI Agent: Agent coordination failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Agent coordination failed',
        results: []
      };
    }
  }

  private async executeIntelligentCoordination(task: UnifiedTask, agents: string[], analysis: any): Promise<any> {
    const results: any[] = [];
    let primaryResult: any = null;

    // Start with primary agent based on intent
    const primaryAgent = this.selectPrimaryAgent(analysis.intent);
    if (primaryAgent && this.specializedAgents.has(primaryAgent)) {
      try {
        const agent = this.specializedAgents.get(primaryAgent);
        const agentTask = this.convertToAgentTask(task, primaryAgent);
        const result = await agent.executeTask(agentTask);
        
        if (result.success) {
          primaryResult = result;
          results.push({
            agent: primaryAgent,
            success: true,
            result: result,
            confidence: result.confidence || 0.8
          });
        }
      } catch (error) {
        logger.warn(`⚠️ Unified AI Agent: Primary agent ${primaryAgent} failed:`, error);
      }
    }

    // If primary agent succeeded, we're done
    if (primaryResult && primaryResult.success) {
      return {
        success: true,
        results: results,
        primaryAgent: primaryAgent,
        confidence: primaryResult.confidence || 0.8,
        reasoning: `Successfully executed using ${primaryAgent} agent`
      };
    }

    // Fallback to other agents
    for (const agentName of agents) {
      if (agentName === primaryAgent) continue;
      
      try {
        const agent = this.specializedAgents.get(agentName);
        if (!agent) continue;

        const agentTask = this.convertToAgentTask(task, agentName);
        const result = await agent.executeTask(agentTask);
        
        results.push({
          agent: agentName,
          success: result.success,
          result: result,
          confidence: result.confidence || 0.7
        });

        if (result.success) {
          return {
            success: true,
            results: results,
            primaryAgent: agentName,
            confidence: result.confidence || 0.7,
            reasoning: `Successfully executed using ${agentName} agent as fallback`
          };
        }
      } catch (error) {
        logger.warn(`⚠️ Unified AI Agent: Agent ${agentName} failed:`, error);
        results.push({
          agent: agentName,
          success: false,
          error: error instanceof Error ? error.message : 'Agent execution failed'
        });
      }
    }

    return {
      success: false,
      results: results,
      error: 'All specialized agents failed to execute the task'
    };
  }

  private async executeSequentialCoordination(task: UnifiedTask, agents: string[]): Promise<any> {
    const results: any[] = [];

    for (const agentName of agents) {
      try {
        const agent = this.specializedAgents.get(agentName);
        if (!agent) continue;

        const agentTask = this.convertToAgentTask(task, agentName);
        const result = await agent.executeTask(agentTask);
        
        results.push({
          agent: agentName,
          success: result.success,
          result: result,
          confidence: result.confidence || 0.8
        });

        if (result.success) {
          return {
            success: true,
            results: results,
            primaryAgent: agentName,
            confidence: result.confidence || 0.8,
            reasoning: `Successfully executed using ${agentName} agent`
          };
        }
      } catch (error) {
        logger.warn(`⚠️ Unified AI Agent: Agent ${agentName} failed:`, error);
        results.push({
          agent: agentName,
          success: false,
          error: error instanceof Error ? error.message : 'Agent execution failed'
        });
      }
    }

    return {
      success: false,
      results: results,
      error: 'All agents failed in sequential execution'
    };
  }

  private async executeParallelCoordination(task: UnifiedTask, agents: string[]): Promise<any> {
    const promises = agents.map(async (agentName) => {
      try {
        const agent = this.specializedAgents.get(agentName);
        if (!agent) return null;

        const agentTask = this.convertToAgentTask(task, agentName);
        const result = await agent.executeTask(agentTask);
        
        return {
          agent: agentName,
          success: result.success,
          result: result,
          confidence: result.confidence || 0.8
        };
      } catch (error) {
        return {
          agent: agentName,
          success: false,
          error: error instanceof Error ? error.message : 'Agent execution failed'
        };
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r && r.success);

    if (successfulResults.length > 0) {
      const bestResult = successfulResults.reduce((best, current) => 
        (current.confidence || 0) > (best.confidence || 0) ? current : best
      );

      return {
        success: true,
        results: results,
        primaryAgent: bestResult.agent,
        confidence: bestResult.confidence,
        reasoning: `Successfully executed using ${bestResult.agent} agent (best of ${successfulResults.length} successful agents)`
      };
    }

    return {
      success: false,
      results: results,
      error: 'All agents failed in parallel execution'
    };
  }

  private selectPrimaryAgent(intent: string): string {
    const agentMapping: Record<string, string> = {
      'interaction': 'browser-use',
      'input': 'browser-use',
      'navigation': 'browser-use',
      'search': 'browser-use',
      'form': 'skyvern',
      'visual': 'playwright-vision',
      'workflow': 'lavague',
      'dynamic': 'stagehand',
      'general': 'browser-chat'
    };

    return agentMapping[intent] || 'browser-chat';
  }

  private convertToAgentTask(task: UnifiedTask, agentName: string): any {
    return {
      id: task.id,
      sessionId: task.sessionId,
      instruction: task.message,
      context: task.context,
      timestamp: new Date().toISOString()
    };
  }

  private async generateUnifiedResponse(result: any, task: UnifiedTask): Promise<UnifiedResponse> {
    if (!result.success) {
      return {
        success: false,
        message: 'I apologize, but I encountered an issue completing your request. Let me try a different approach.',
        error: result.error,
        confidence: 0.3
      };
    }

    // Generate user-friendly response
    let message = '';
    let actions: any[] = [];
    let screenshot: string | undefined;

    if (result.primaryAgent) {
      const primaryResult = result.results.find((r: any) => r.agent === result.primaryAgent);
      if (primaryResult && primaryResult.result) {
        const agentResult = primaryResult.result;
        
        // Generate contextual message based on agent type
        switch (result.primaryAgent) {
          case 'browser-use':
            message = 'I\'ve completed the browser automation task for you.';
            break;
          case 'ui-tars':
            message = 'I\'ve analyzed the visual elements and completed the task.';
            break;
          case 'skyvern':
            message = 'I\'ve handled the form interaction with computer vision.';
            break;
          case 'lavague':
            message = 'I\'ve executed the complex workflow successfully.';
            break;
          case 'stagehand':
            message = 'I\'ve completed the dynamic web automation.';
            break;
          case 'playwright-vision':
            message = 'I\'ve captured and analyzed the visual information.';
            screenshot = agentResult.result?.screenshot;
            break;
          case 'browser-chat':
            message = agentResult.result?.chatResponse || 'I\'ve processed your request.';
            break;
          default:
            message = 'I\'ve completed your request successfully.';
        }

        actions = agentResult.result?.actions || [];
      }
    }

    return {
      success: true,
      message: message || 'I\'ve completed your request successfully.',
      actions: actions,
      screenshot: screenshot,
      confidence: result.confidence || 0.8,
      reasoning: result.reasoning
    };
  }

  private updateConversationHistory(sessionId: string, interaction: any): void {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    
    const history = this.conversationHistory.get(sessionId)!;
    history.push(interaction);
    
    // Keep only last 50 interactions
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  async getConversationHistory(sessionId: string): Promise<any[]> {
    return this.conversationHistory.get(sessionId) || [];
  }

  async clearConversationHistory(sessionId: string): Promise<void> {
    this.conversationHistory.delete(sessionId);
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Check if at least one specialized agent is healthy
      let healthyAgents = 0;
      for (const [name, agent] of this.specializedAgents) {
        try {
          if (await agent.healthCheck()) {
            healthyAgents++;
          }
        } catch (error) {
          logger.warn(`⚠️ Unified AI Agent: ${name} health check failed:`, error);
        }
      }

      return healthyAgents > 0;
    } catch {
      return false;
    }
  }

  getCapabilities(): string[] {
    return [
      'unified_ai_interface',
      'intelligent_agent_coordination',
      'seamless_user_experience',
      'multi_agent_backend',
      'conversation_management',
      'intent_analysis',
      'adaptive_coordination',
      'real_time_processing'
    ];
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      specializedAgents: this.specializedAgents.size,
      activeTasks: this.activeTasks.size,
      activeSessions: this.conversationHistory.size,
      capabilities: this.getCapabilities(),
      coordinationStrategy: this.config.coordinationStrategy
    };
  }

  async shutdown(): Promise<void> {
    try {
      // Close all specialized agents
      for (const [name, agent] of this.specializedAgents) {
        try {
          if (agent.close) {
            await agent.close();
          }
        } catch (error) {
          logger.warn(`⚠️ Unified AI Agent: Error closing ${name}:`, error);
        }
      }
      
      this.specializedAgents.clear();
      this.activeTasks.clear();
      this.conversationHistory.clear();
      this.isInitialized = false;
      
      logger.info('✅ Unified AI Agent: Shutdown completed');
    } catch (error) {
      logger.error('❌ Unified AI Agent: Error during shutdown:', error);
    }
  }
}

export default UnifiedAIAgent;
