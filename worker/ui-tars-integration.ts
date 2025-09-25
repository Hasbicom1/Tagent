/**
 * UI-TARS Integration for Worker System
 * Integrates UI-TARS with the existing browser automation worker
 */

import { EventEmitter } from 'events';
import { BrowserEngine } from './browser-engine';
import { logger } from '../server/logger';

export interface UITarsTask {
  id: string;
  sessionId: string;
  instruction: string;
  screenshot?: string;
  context?: Record<string, any>;
  priority: number;
}

export interface UITarsResult {
  success: boolean;
  taskId: string;
  actions: UITarsAction[];
  reasoning?: string;
  confidence: number;
  executionTime: number;
  error?: string;
}

export interface UITarsAction {
  type: 'click' | 'type' | 'scroll' | 'navigate' | 'wait';
  coordinates?: { x: number; y: number };
  text?: string;
  url?: string;
  duration?: number;
  selector?: string;
  confidence: number;
}

export class UITarsIntegration extends EventEmitter {
  private browserEngine: BrowserEngine;
  private isInitialized = false;
  private activeTasks: Map<string, UITarsTask> = new Map();
  private apiEndpoint: string;
  private apiKey?: string;

  constructor(browserEngine: BrowserEngine, config: {
    apiEndpoint: string;
    apiKey?: string;
  }) {
    super();
    this.browserEngine = browserEngine;
    this.apiEndpoint = config.apiEndpoint;
    this.apiKey = config.apiKey;
  }

  /**
   * Initialize UI-TARS integration
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🤖 UI-TARS: Initializing worker integration...');
      
      // Test API connectivity
      await this.testConnection();
      
      this.isInitialized = true;
      logger.info('✅ UI-TARS: Worker integration initialized');
      
      this.emit('initialized');
    } catch (error) {
      logger.error('❌ UI-TARS: Worker integration failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute task with UI-TARS
   */
  async executeTask(task: UITarsTask): Promise<UITarsResult> {
    if (!this.isInitialized) {
      throw new Error('UI-TARS integration not initialized');
    }

    const startTime = Date.now();
    this.activeTasks.set(task.id, task);

    logger.info('🎯 UI-TARS: Executing task', {
      taskId: task.id,
      instruction: task.instruction
    });

    try {
      // Take screenshot for UI-TARS analysis
      const screenshot = await this.captureScreenshot(task.sessionId);
      
      // Analyze with UI-TARS
      const analysis = await this.analyzeWithUITars(task.instruction, screenshot);
      
      // Execute actions
      const actions = await this.executeActions(analysis.actions, task.sessionId);
      
      const result: UITarsResult = {
        success: true,
        taskId: task.id,
        actions,
        reasoning: analysis.reasoning,
        confidence: analysis.confidence,
        executionTime: Date.now() - startTime
      };

      logger.info('✅ UI-TARS: Task completed', {
        taskId: task.id,
        actions: actions.length,
        confidence: analysis.confidence,
        duration: result.executionTime
      });

      this.activeTasks.delete(task.id);
      this.emit('taskCompleted', result);
      
      return result;
    } catch (error) {
      const result: UITarsResult = {
        success: false,
        taskId: task.id,
        actions: [],
        confidence: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'unknown error'
      };

      logger.error('❌ UI-TARS: Task failed', {
        taskId: task.id,
        error: result.error,
        duration: result.executionTime
      });

      this.activeTasks.delete(task.id);
      this.emit('taskFailed', result);
      
      return result;
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

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(testRequest)
    });

    if (!response.ok) {
      throw new Error(`UI-TARS API connection failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Capture screenshot for UI-TARS analysis
   */
  private async captureScreenshot(sessionId: string): Promise<string> {
    try {
      // Get the current page from browser engine
      const page = await this.browserEngine.getCurrentPage(sessionId);
      if (!page) {
        throw new Error('No active page found for session');
      }

      // Take screenshot
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      
      // Convert to base64
      return screenshot.toString('base64');
    } catch (error) {
      logger.error('❌ UI-TARS: Screenshot capture failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Analyze task with UI-TARS API
   */
  private async analyzeWithUITars(instruction: string, screenshot: string): Promise<{
    actions: UITarsAction[];
    reasoning: string;
    confidence: number;
  }> {
    try {
      const request = {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Task: ${instruction}\n\nAnalyze the screenshot and provide the next actions to complete this task.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshot}`
                }
              }
            ]
          }
        ],
        max_tokens: 512,
        temperature: 0.1,
        stream: false
      };

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`UI-TARS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseUITarsResponse(data);
    } catch (error) {
      logger.error('❌ UI-TARS: Analysis failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Parse UI-TARS API response
   */
  private parseUITarsResponse(data: any): {
    actions: UITarsAction[];
    reasoning: string;
    confidence: number;
  } {
    try {
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse actions from response
      const actions: UITarsAction[] = [];
      
      // Look for click actions with coordinates
      const clickMatches = content.match(/click\s*\((\d+),\s*(\d+)\)/g);
      if (clickMatches) {
        clickMatches.forEach(match => {
          const coords = match.match(/\((\d+),\s*(\d+)\)/);
          if (coords) {
            actions.push({
              type: 'click',
              coordinates: {
                x: parseInt(coords[1]),
                y: parseInt(coords[2])
              },
              confidence: 0.8
            });
          }
        });
      }
      
      // Look for type actions
      const typeMatches = content.match(/type\s*"([^"]+)"/g);
      if (typeMatches) {
        typeMatches.forEach(match => {
          const text = match.match(/type\s*"([^"]+)"/);
          if (text) {
            actions.push({
              type: 'type',
              text: text[1],
              confidence: 0.8
            });
          }
        });
      }
      
      // Look for navigation actions
      const navMatches = content.match(/navigate\s*"([^"]+)"/g);
      if (navMatches) {
        navMatches.forEach(match => {
          const url = match.match(/navigate\s*"([^"]+)"/);
          if (url) {
            actions.push({
              type: 'navigate',
              url: url[1],
              confidence: 0.8
            });
          }
        });
      }
      
      // Extract reasoning
      const reasoningMatch = content.match(/Reasoning:\s*(.+)/i);
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Task analysis completed';
      
      // Default confidence
      const confidence = 0.8;
      
      return {
        actions: actions.length > 0 ? actions : [{
          type: 'click',
          coordinates: { x: 100, y: 100 },
          confidence: 0.5
        }],
        reasoning,
        confidence
      };
    } catch (error) {
      logger.error('❌ UI-TARS: Response parsing failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      
      // Return default response
      return {
        actions: [{
          type: 'click',
          coordinates: { x: 100, y: 100 },
          confidence: 0.5
        }],
        reasoning: 'Failed to parse response',
        confidence: 0.5
      };
    }
  }

  /**
   * Execute actions on browser
   */
  private async executeActions(actions: UITarsAction[], sessionId: string): Promise<UITarsAction[]> {
    const executedActions: UITarsAction[] = [];
    
    try {
      const page = await this.browserEngine.getCurrentPage(sessionId);
      if (!page) {
        throw new Error('No active page found for session');
      }

      for (const action of actions) {
        try {
          switch (action.type) {
            case 'click':
              if (action.coordinates) {
                await page.mouse.click(action.coordinates.x, action.coordinates.y);
                logger.debug('🖱️ UI-TARS: Click executed', {
                  coordinates: action.coordinates
                });
              }
              break;
              
            case 'type':
              if (action.text) {
                await page.keyboard.type(action.text);
                logger.debug('⌨️ UI-TARS: Text typed', {
                  text: action.text
                });
              }
              break;
              
            case 'navigate':
              if (action.url) {
                await page.goto(action.url);
                logger.debug('🌐 UI-TARS: Navigation executed', {
                  url: action.url
                });
              }
              break;
              
            case 'scroll':
              await page.mouse.wheel(0, action.duration || 100);
              logger.debug('📜 UI-TARS: Scroll executed');
              break;
              
            case 'wait':
              await page.waitForTimeout(action.duration || 1000);
              logger.debug('⏳ UI-TARS: Wait executed', {
                duration: action.duration
              });
              break;
          }
          
          executedActions.push(action);
          
          // Small delay between actions
          await page.waitForTimeout(500);
        } catch (actionError) {
          logger.warn('⚠️ UI-TARS: Action failed', {
            action: action.type,
            error: actionError instanceof Error ? actionError.message : 'unknown error'
          });
          // Continue with next action
        }
      }
    } catch (error) {
      logger.error('❌ UI-TARS: Action execution failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
    
    return executedActions;
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): UITarsTask[] {
    return Array.from(this.activeTasks.values());
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

export default UITarsIntegration;
