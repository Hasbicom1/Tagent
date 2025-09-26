/**
 * LOCAL UNIFIED AI AGENT
 * 
 * Self-contained AI agent that runs entirely locally
 * No external API dependencies - everything runs in our codebase
 */

import { logger } from '../logger';
import { EventEmitter } from 'events';
import LocalAIEngine from '../ai/local-ai-engine';
import LocalBrowserAutomationEngine from '../ai/local-browser-automation';
import LocalComputerVisionEngine from '../ai/local-computer-vision';

export interface LocalUnifiedConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retries: number;
  enableScreenshots: boolean;
  enableVideo: boolean;
}

export interface LocalUnifiedTask {
  id: string;
  sessionId: string;
  message: string;
  context?: any;
  priority?: number;
}

export interface LocalUnifiedResponse {
  success: boolean;
  message: string;
  actions?: any[];
  screenshot?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
  executionTime?: number;
}

export class LocalUnifiedAIAgent extends EventEmitter {
  private config: LocalUnifiedConfig;
  private localAIEngine: LocalAIEngine;
  private browserEngine: LocalBrowserAutomationEngine;
  private visionEngine: LocalComputerVisionEngine;
  private isInitialized: boolean = false;
  private activeTasks: Map<string, any> = new Map();
  private conversationHistory: Map<string, any[]> = new Map();

  constructor(config?: Partial<LocalUnifiedConfig>) {
    super();
    this.config = {
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 3,
      taskTimeout: config?.taskTimeout ?? 60000,
      retries: config?.retries ?? 3,
      enableScreenshots: config?.enableScreenshots ?? true,
      enableVideo: config?.enableVideo ?? false
    };
  }

  /**
   * Initialize local AI agent with self-contained engines
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔧 LOCAL UNIFIED AI: Initializing self-contained AI brain...');

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
        timeout: this.config.taskTimeout,
        enableScreenshots: this.config.enableScreenshots,
        enableVideo: this.config.enableVideo
      });
      await this.browserEngine.initialize();

      // Initialize local computer vision
      this.visionEngine = new LocalComputerVisionEngine({
        enableScreenshots: this.config.enableScreenshots,
        screenshotQuality: 80,
        elementDetectionThreshold: 0.7,
        enableTextRecognition: true,
        enableColorDetection: true
      });
      await this.visionEngine.initialize();
      
      this.isInitialized = true;
      logger.info('✅ LOCAL UNIFIED AI: Self-contained AI brain ready');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('❌ LOCAL UNIFIED AI: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process user message using local AI
   */
  async processMessage(task: LocalUnifiedTask): Promise<LocalUnifiedResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
      await this.initialize();
      }

      logger.info('🧠 LOCAL UNIFIED AI: Processing user message', {
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

      logger.info('✅ LOCAL UNIFIED AI: Message processed successfully', {
        taskId: task.id,
        confidence: response.confidence,
        executionTime
      });

      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ LOCAL UNIFIED AI: Message processing failed', {
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

  /**
   * Execute task using local browser automation
   */
  private async executeLocalTask(task: LocalUnifiedTask, analysis: any): Promise<any> {
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
      logger.error('❌ LOCAL UNIFIED AI: Local task execution failed:', error);
      return {
        success: false,
        message: 'Task execution failed due to system error',
        actions: [],
        confidence: 0
      };
    }
  }

  /**
   * Determine task type from message
   */
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

  /**
   * Extract target from message
   */
  private extractTarget(message: string): string | undefined {
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

  /**
   * Generate unified response
   */
  private async generateUnifiedResponse(result: any, task: LocalUnifiedTask): Promise<LocalUnifiedResponse> {
    if (!result.success) {
      return {
        success: false,
        message: result.message || 'I apologize, but I encountered an issue completing your request.',
        error: result.error,
        confidence: result.confidence || 0.3
      };
    }

    return {
      success: true,
      message: result.message || 'Task completed successfully',
      actions: result.actions || [],
      screenshot: result.screenshot,
      confidence: result.confidence || 0.8,
      reasoning: 'Task executed using local AI engines'
    };
  }

  /**
   * Update conversation history
   */
  private updateConversationHistory(sessionId: string, entry: any): void {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    
    const history = this.conversationHistory.get(sessionId)!;
    history.push(entry);
    
    // Keep only last 50 messages
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(sessionId: string): any[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Get initial message
   */
  async getInitialMessage(): Promise<string> {
    try {
      return await this.localAIEngine.generateInitialMessage();
    } catch (error) {
      logger.error('❌ LOCAL UNIFIED AI: Failed to generate initial message:', error);
      return 'Hello! I am your local AI assistant. I can help you with browser automation tasks. What would you like me to do?';
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) return false;
      
      const aiHealth = await this.localAIEngine.healthCheck();
      const browserHealth = await this.browserEngine.healthCheck();
      const visionHealth = await this.visionEngine.healthCheck();
      
      return aiHealth && browserHealth && visionHealth;
    } catch (error) {
      logger.error('❌ LOCAL UNIFIED AI: Health check failed:', error);
      return false;
    }
  }

  /**
   * Close all engines
   */
  async close(): Promise<void> {
    try {
      if (this.browserEngine) {
        await this.browserEngine.close();
      }
      
      this.isInitialized = false;
      logger.info('🔧 LOCAL UNIFIED AI: All engines closed');
    } catch (error) {
      logger.error('❌ LOCAL UNIFIED AI: Error closing engines:', error);
    }
  }
}

export default LocalUnifiedAIAgent;
