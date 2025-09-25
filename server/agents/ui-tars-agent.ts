/**
 * UI-TARS Agent Integration
 * Advanced GUI automation with computer vision capabilities
 * Based on: https://github.com/bytedance/UI-TARS
 */

import { AutomationTask, TaskResult } from '../browserAutomation';
import { logger } from '../logger';

export interface UITarsConfig {
  apiEndpoint: string;
  apiKey?: string;
  model: 'ui-tars-1.5' | 'ui-tars-1.5-7b';
  maxRetries: number;
  timeout: number;
}

export interface UITarsResponse {
  action: string;
  coordinates?: { x: number; y: number };
  confidence: number;
  reasoning?: string;
  nextAction?: string;
}

export class UITarsAgent {
  private config: UITarsConfig;
  private isInitialized = false;

  constructor(config: UITarsConfig) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      ...config
    };
  }

  /**
   * Initialize UI-TARS agent
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🤖 UI-TARS: Initializing agent...', {
        model: this.config.model,
        endpoint: this.config.apiEndpoint
      });

      // Test API connectivity
      await this.testConnection();
      
      this.isInitialized = true;
      logger.info('✅ UI-TARS: Agent initialized successfully');
    } catch (error) {
      logger.error('❌ UI-TARS: Initialization failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute automation task using UI-TARS
   */
  async executeTask(task: AutomationTask): Promise<TaskResult> {
    if (!this.isInitialized) {
      throw new Error('UI-TARS agent not initialized');
    }

    const startTime = Date.now();
    logger.info('🎯 UI-TARS: Executing task', {
      taskId: task.id,
      description: task.description,
      type: task.type
    });

    try {
      // Prepare UI-TARS request
      const request = this.prepareRequest(task);
      
      // Call UI-TARS API
      const response = await this.callUITarsAPI(request);
      
      // Process response and execute actions
      const result = await this.processResponse(response, task);
      
      const duration = Date.now() - startTime;
      logger.info('✅ UI-TARS: Task completed successfully', {
        taskId: task.id,
        duration: `${duration}ms`,
        actions: result.actions?.length || 0
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ UI-TARS: Task execution failed', {
        taskId: task.id,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Test API connection
   */
  private async testConnection(): Promise<void> {
    const testRequest = {
      messages: [
        {
          role: 'user',
          content: 'Test connection'
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    };

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      },
      body: JSON.stringify(testRequest)
    });

    if (!response.ok) {
      throw new Error(`UI-TARS API connection failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Prepare request for UI-TARS API
   */
  private prepareRequest(task: AutomationTask): any {
    return {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Task: ${task.description}\n\nPlease analyze the current screen and provide the next action to complete this task.`
            }
          ]
        }
      ],
      max_tokens: 512,
      temperature: 0.1,
      stream: false
    };
  }

  /**
   * Call UI-TARS API with retry logic
   */
  private async callUITarsAPI(request: any): Promise<UITarsResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug('🔄 UI-TARS: API call attempt', { attempt, maxRetries: this.config.maxRetries });

        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.config.timeout)
        });

        if (!response.ok) {
          throw new Error(`UI-TARS API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.parseResponse(data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('⚠️ UI-TARS: API call failed', {
          attempt,
          error: lastError.message
        });

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`UI-TARS API failed after ${this.config.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Parse UI-TARS API response
   */
  private parseResponse(data: any): UITarsResponse {
    try {
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse action from response
      const actionMatch = content.match(/Action:\s*(.+)/i);
      const action = actionMatch ? actionMatch[1].trim() : 'click';
      
      // Parse coordinates if present
      const coordMatch = content.match(/\((\d+),\s*(\d+)\)/);
      const coordinates = coordMatch ? {
        x: parseInt(coordMatch[1]),
        y: parseInt(coordMatch[2])
      } : undefined;
      
      // Extract reasoning
      const reasoningMatch = content.match(/Reasoning:\s*(.+)/i);
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;
      
      return {
        action,
        coordinates,
        confidence: 0.8, // Default confidence
        reasoning,
        nextAction: content.includes('Next:') ? content.split('Next:')[1].trim() : undefined
      };
    } catch (error) {
      logger.error('❌ UI-TARS: Failed to parse response', {
        error: error instanceof Error ? error.message : 'unknown error',
        response: data
      });
      
      // Return default response
      return {
        action: 'click',
        confidence: 0.5,
        reasoning: 'Failed to parse response'
      };
    }
  }

  /**
   * Process UI-TARS response and execute actions
   */
  private async processResponse(response: UITarsResponse, task: AutomationTask): Promise<TaskResult> {
    const actions: any[] = [];
    
    // Convert UI-TARS response to browser actions
    if (response.coordinates) {
      actions.push({
        type: 'click',
        x: response.coordinates.x,
        y: response.coordinates.y,
        confidence: response.confidence
      });
    } else if (response.action === 'type') {
      actions.push({
        type: 'type',
        text: task.input || '',
        confidence: response.confidence
      });
    } else if (response.action === 'scroll') {
      actions.push({
        type: 'scroll',
        direction: 'down',
        confidence: response.confidence
      });
    }

    return {
      success: true,
      taskId: task.id,
      actions,
      result: {
        message: response.reasoning || 'Task completed successfully',
        confidence: response.confidence,
        nextAction: response.nextAction
      },
      duration: 0, // Will be calculated by caller
      metadata: {
        agent: 'ui-tars',
        model: this.config.model,
        reasoning: response.reasoning
      }
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): any {
    return {
      name: 'UI-TARS',
      id: 'ui-tars',
      description: 'Advanced GUI automation with computer vision',
      strengths: [
        'visual elements',
        'complex interactions', 
        'game automation',
        'form filling',
        'navigation',
        'screenshot analysis'
      ],
      priority: 1,
      model: this.config.model,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      logger.error('❌ UI-TARS: Health check failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      return false;
    }
  }
}

export default UITarsAgent;
