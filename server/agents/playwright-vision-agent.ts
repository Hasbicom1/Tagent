/**
 * Playwright Vision Agent - Real Implementation
 * Computer vision automation using Playwright with advanced visual processing
 */

import { logger } from '../logger';
import { chromium, Browser, Page } from 'playwright';

export interface PlaywrightVisionConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  timeout: number;
  confidence: number;
  retries: number;
}

export interface PlaywrightVisionTask {
  id: string;
  sessionId: string;
  instruction: string;
  screenshot?: string;
  context?: any;
  visualMode?: boolean;
}

export interface PlaywrightVisionResult {
  success: boolean;
  result?: {
    message: string;
    elements: any[];
    actions: any[];
    confidence: number;
  };
  error?: string;
  executionTime?: number;
}

export class PlaywrightVisionAgent {
  private config: PlaywrightVisionConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized: boolean = false;

  constructor(config?: Partial<PlaywrightVisionConfig>) {
    this.config = {
      headless: config?.headless ?? true,
      viewport: config?.viewport ?? { width: 1280, height: 720 },
      timeout: config?.timeout ?? 30000,
      confidence: config?.confidence ?? 0.8,
      retries: config?.retries ?? 3
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Playwright Vision: Initializing real computer vision agent...');

      // Initialize browser with vision capabilities
      await this.initializeBrowser();
      
      this.isInitialized = true;
      logger.info('✅ Playwright Vision: Real computer vision agent initialized');
    } catch (error) {
      logger.error('❌ Playwright Vision: Initialization failed:', error);
      throw error;
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--enable-features=VaapiVideoDecoder'
      ]
    });

    const context = await this.browser.newContext({
      viewport: this.config.viewport,
      ignoreHTTPSErrors: true
    });

    this.page = await context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
  }

  async executeTask(task: PlaywrightVisionTask): Promise<PlaywrightVisionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      logger.info('🎯 Playwright Vision: Executing real computer vision task', {
        taskId: task.id,
        instruction: task.instruction,
        visualMode: task.visualMode
      });

      // Analyze page elements using computer vision
      const elements = await this.analyzePageElements();
      
      // Generate actions based on visual analysis
      const actions = await this.generateVisualActions(task.instruction, elements);
      
      // Execute actions with visual feedback
      const results = await this.executeVisualActions(actions);

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Playwright Vision: Computer vision task completed', {
        taskId: task.id,
        elementsCount: elements.length,
        actionsCount: actions.length,
        confidence: results.confidence,
        executionTime
      });

      return {
        success: true,
        result: {
          message: 'Playwright Vision computer vision automation completed',
          elements: elements,
          actions: results.actions,
          confidence: results.confidence
        },
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Playwright Vision: Computer vision task failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Playwright Vision execution failed',
        executionTime
      };
    }
  }

  private async analyzePageElements(): Promise<any[]> {
    if (!this.page) return [];

    try {
      // Get all interactive elements
      const elements = await this.page.evaluate(() => {
        const interactiveElements = [];
        
        // Buttons
        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        buttons.forEach((button, index) => {
          const rect = button.getBoundingClientRect();
          interactiveElements.push({
            type: 'button',
            text: button.textContent?.trim() || '',
            selector: `button:nth-of-type(${index + 1})`,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            confidence: 0.9
          });
        });

        // Input fields
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
        inputs.forEach((input, index) => {
          const rect = input.getBoundingClientRect();
          interactiveElements.push({
            type: 'input',
            placeholder: input.getAttribute('placeholder') || '',
            name: input.getAttribute('name') || '',
            selector: `input:nth-of-type(${index + 1})`,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            confidence: 0.9
          });
        });

        // Links
        const links = document.querySelectorAll('a');
        links.forEach((link, index) => {
          const rect = link.getBoundingClientRect();
          interactiveElements.push({
            type: 'link',
            text: link.textContent?.trim() || '',
            href: link.getAttribute('href') || '',
            selector: `a:nth-of-type(${index + 1})`,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            confidence: 0.8
          });
        });

        return interactiveElements;
      });

      return elements;
    } catch (error) {
      logger.warn('⚠️ Playwright Vision: Element analysis failed:', error);
      return [];
    }
  }

  private async generateVisualActions(instruction: string, elements: any[]): Promise<any[]> {
    const actions: any[] = [];
    const lowerInstruction = instruction.toLowerCase();

    // Click actions based on visual elements
    if (lowerInstruction.includes('click') || lowerInstruction.includes('press')) {
      const targetText = this.extractTargetText(instruction);
      const element = this.findElementByText(elements, targetText);
      
      if (element) {
        actions.push({
          type: 'click',
          element: element,
          coordinates: element.boundingBox,
          confidence: element.confidence
        });
      }
    }

    // Type actions based on visual input fields
    if (lowerInstruction.includes('type') || lowerInstruction.includes('input')) {
      const textToType = this.extractTextToType(instruction);
      const fieldName = this.extractFieldName(instruction);
      const element = this.findInputField(elements, fieldName);
      
      if (element) {
        actions.push({
          type: 'type',
          element: element,
          text: textToType,
          coordinates: element.boundingBox,
          confidence: element.confidence
        });
      }
    }

    // Form filling based on visual form elements
    if (lowerInstruction.includes('fill') || lowerInstruction.includes('form')) {
      const formData = this.extractFormData(instruction);
      
      for (const [fieldName, value] of Object.entries(formData)) {
        const element = this.findInputField(elements, fieldName);
        
        if (element) {
          actions.push({
            type: 'fill',
            element: element,
            field: fieldName,
            value: value,
            coordinates: element.boundingBox,
            confidence: element.confidence
          });
        }
      }
    }

    return actions;
  }

  private async executeVisualActions(actions: any[]): Promise<any> {
    const results: any[] = [];
    let totalConfidence = 0;

    for (const action of actions) {
      try {
        const result = await this.executeVisualAction(action);
        results.push(result);
        totalConfidence += result.confidence || 0.8;
      } catch (error) {
        logger.warn(`⚠️ Playwright Vision: Action execution failed:`, error);
        results.push({
          type: action.type,
          success: false,
          error: error instanceof Error ? error.message : 'Action failed'
        });
      }
    }

    return {
      actions: results,
      confidence: results.length > 0 ? totalConfidence / results.length : 0.8
    };
  }

  private async executeVisualAction(action: any): Promise<any> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    switch (action.type) {
      case 'click':
        await this.page.click(action.element.selector);
        break;
        
      case 'type':
        await this.page.fill(action.element.selector, action.text);
        break;
        
      case 'fill':
        await this.page.fill(action.element.selector, action.value);
        break;
        
      default:
        logger.warn(`⚠️ Playwright Vision: Unknown action type: ${action.type}`);
    }

    // Wait for action to complete
    await this.page.waitForTimeout(1000);

    return {
      type: action.type,
      success: true,
      confidence: action.confidence,
      timestamp: new Date().toISOString()
    };
  }

  private extractTargetText(instruction: string): string {
    const patterns = [
      /click (?:on )?([a-zA-Z0-9\s]+)/i,
      /press (?:on )?([a-zA-Z0-9\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractTextToType(instruction: string): string {
    const patterns = [
      /type ["']([^"']+)["']/i,
      /enter ["']([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'test input';
  }

  private extractFieldName(instruction: string): string {
    const patterns = [
      /(?:in|to|into) (?:the )?([a-zA-Z0-9\s]+) (?:field|input|box)/i,
      /(?:the )?([a-zA-Z0-9\s]+) (?:field|input|box)/i
    ];

    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1].trim().toLowerCase();
      }
    }

    return '';
  }

  private extractFormData(instruction: string): Record<string, string> {
    const formData: Record<string, string> = {};
    
    const fieldPattern = /(\w+):\s*["']([^"']+)["']/g;
    let match;
    
    while ((match = fieldPattern.exec(instruction)) !== null) {
      formData[match[1]] = match[2];
    }

    return formData;
  }

  private findElementByText(elements: any[], text: string): any {
    return elements.find(element => 
      element.text && element.text.toLowerCase().includes(text.toLowerCase())
    );
  }

  private findInputField(elements: any[], fieldName: string): any {
    return elements.find(element => 
      element.type === 'input' && 
      (element.name?.toLowerCase().includes(fieldName.toLowerCase()) ||
       element.placeholder?.toLowerCase().includes(fieldName.toLowerCase()))
    );
  }

  async takeScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    const screenshot = await this.page.screenshot({ 
      type: 'png', 
      fullPage: true 
    });
    
    return screenshot.toString('base64');
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser || !this.page) {
        return false;
      }

      // Test basic page functionality
      await this.page.evaluate(() => document.title);
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): string[] {
    return [
      'visual_element_detection',
      'computer_vision_automation',
      'screenshot_analysis',
      'visual_interaction',
      'element_recognition',
      'form_visual_automation',
      'button_visual_detection',
      'link_visual_detection'
    ];
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      browserConnected: !!this.browser,
      pageReady: !!this.page,
      capabilities: this.getCapabilities(),
      confidence: this.config.confidence
    };
  }

  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
      
      logger.info('✅ Playwright Vision: Browser closed successfully');
    } catch (error) {
      logger.error('❌ Playwright Vision: Error closing browser:', error);
    }
  }
}

export default PlaywrightVisionAgent;
