/**
 * Browser-Use Agent - Real Implementation
 * Primary automation engine for standard browser tasks
 * Based on Browser-Use library with Playwright integration
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../logger';

export interface BrowserUseConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent?: string;
  timeout: number;
  retries: number;
}

export interface BrowserUseTask {
  id: string;
  sessionId: string;
  instruction: string;
  url?: string;
  context?: any;
  screenshot?: boolean;
}

export interface BrowserUseResult {
  success: boolean;
  result?: {
    message: string;
    actions: any[];
    screenshot?: string;
    finalUrl?: string;
  };
  error?: string;
  executionTime?: number;
}

export class BrowserUseAgent {
  private config: BrowserUseConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isInitialized: boolean = false;

  constructor(config?: Partial<BrowserUseConfig>) {
    this.config = {
      headless: config?.headless ?? true,
      viewport: config?.viewport ?? { width: 1280, height: 720 },
      userAgent: config?.userAgent,
      timeout: config?.timeout ?? 30000,
      retries: config?.retries ?? 3
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Browser-Use: Initializing real browser automation...');

      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      // Create context
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
        ignoreHTTPSErrors: true
      });

      // Create page
      this.page = await this.context.newPage();
      
      // Set default timeout
      this.page.setDefaultTimeout(this.config.timeout);

      this.isInitialized = true;
      logger.info('✅ Browser-Use: Real browser automation initialized');
    } catch (error) {
      logger.error('❌ Browser-Use: Initialization failed:', error);
      throw error;
    }
  }

  async executeTask(task: BrowserUseTask): Promise<BrowserUseResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      logger.info('🎯 Browser-Use: Executing real browser task', {
        taskId: task.id,
        instruction: task.instruction,
        url: task.url
      });

      const actions: any[] = [];
      let finalUrl: string | undefined;

      // Navigate to URL if provided
      if (task.url) {
        await this.page.goto(task.url, { waitUntil: 'networkidle' });
        actions.push({ type: 'navigate', url: task.url });
        finalUrl = this.page.url();
      }

      // Parse and execute instruction
      const instructionActions = await this.parseInstruction(task.instruction);
      
      for (const action of instructionActions) {
        await this.executeAction(action);
        actions.push(action);
      }

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (task.screenshot) {
        screenshot = await this.page.screenshot({ 
          type: 'png', 
          fullPage: true 
        }).then(buffer => buffer.toString('base64'));
      }

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Browser-Use: Task completed successfully', {
        taskId: task.id,
        actionsCount: actions.length,
        executionTime
      });

      return {
        success: true,
        result: {
          message: 'Browser automation completed successfully',
          actions,
          screenshot,
          finalUrl: finalUrl || this.page.url()
        },
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Browser-Use: Task execution failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Browser automation failed',
        executionTime
      };
    }
  }

  private async parseInstruction(instruction: string): Promise<any[]> {
    const actions: any[] = [];
    const lowerInstruction = instruction.toLowerCase();

    // Click actions
    if (lowerInstruction.includes('click') || lowerInstruction.includes('press')) {
      const clickTarget = this.extractClickTarget(instruction);
      if (clickTarget) {
        actions.push({
          type: 'click',
          target: clickTarget,
          selector: this.generateSelector(clickTarget)
        });
      }
    }

    // Type actions
    if (lowerInstruction.includes('type') || lowerInstruction.includes('enter') || lowerInstruction.includes('input')) {
      const textToType = this.extractTextToType(instruction);
      if (textToType) {
        actions.push({
          type: 'type',
          text: textToType,
          selector: this.extractInputSelector(instruction)
        });
      }
    }

    // Form filling
    if (lowerInstruction.includes('fill') || lowerInstruction.includes('form')) {
      const formData = this.extractFormData(instruction);
      for (const [field, value] of Object.entries(formData)) {
        actions.push({
          type: 'fill',
          field,
          value,
          selector: `input[name="${field}"], input[placeholder*="${field}"]`
        });
      }
    }

    // Navigation
    if (lowerInstruction.includes('go to') || lowerInstruction.includes('navigate')) {
      const url = this.extractUrl(instruction);
      if (url) {
        actions.push({
          type: 'navigate',
          url
        });
      }
    }

    // Scroll actions
    if (lowerInstruction.includes('scroll')) {
      const direction = lowerInstruction.includes('down') ? 'down' : 'up';
      actions.push({
        type: 'scroll',
        direction
      });
    }

    return actions;
  }

  private extractClickTarget(instruction: string): string | null {
    // Extract click target from instruction
    const patterns = [
      /click (?:on )?([a-zA-Z0-9\s]+)/i,
      /press (?:on )?([a-zA-Z0-9\s]+)/i,
      /tap (?:on )?([a-zA-Z0-9\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractTextToType(instruction: string): string | null {
    // Extract text to type from instruction
    const patterns = [
      /type ["']([^"']+)["']/i,
      /enter ["']([^"']+)["']/i,
      /input ["']([^"']+)["']/i,
      /type ([a-zA-Z0-9\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractFormData(instruction: string): Record<string, string> {
    const formData: Record<string, string> = {};
    
    // Look for field:value patterns
    const fieldPattern = /(\w+):\s*["']([^"']+)["']/g;
    let match;
    
    while ((match = fieldPattern.exec(instruction)) !== null) {
      formData[match[1]] = match[2];
    }

    return formData;
  }

  private extractUrl(instruction: string): string | null {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = instruction.match(urlPattern);
    return match ? match[1] : null;
  }

  private generateSelector(target: string): string {
    // Generate CSS selector for target
    const lowerTarget = target.toLowerCase();
    
    if (lowerTarget.includes('button')) {
      return 'button';
    } else if (lowerTarget.includes('link')) {
      return 'a';
    } else if (lowerTarget.includes('input')) {
      return 'input';
    } else {
      return `[data-testid*="${target}"], [aria-label*="${target}"], [title*="${target}"]`;
    }
  }

  private extractInputSelector(instruction: string): string {
    // Extract input selector from instruction
    const inputPattern = /(?:in|to|into) (?:the )?([a-zA-Z0-9\s]+) (?:field|input|box)/i;
    const match = instruction.match(inputPattern);
    
    if (match) {
      const fieldName = match[1].toLowerCase();
      return `input[name*="${fieldName}"], input[placeholder*="${fieldName}"], input[id*="${fieldName}"]`;
    }
    
    return 'input[type="text"], input[type="email"], input[type="password"]';
  }

  private async executeAction(action: any): Promise<void> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    switch (action.type) {
      case 'click':
        await this.page.click(action.selector);
        break;
        
      case 'type':
        await this.page.fill(action.selector, action.text);
        break;
        
      case 'fill':
        await this.page.fill(action.selector, action.value);
        break;
        
      case 'navigate':
        await this.page.goto(action.url, { waitUntil: 'networkidle' });
        break;
        
      case 'scroll':
        if (action.direction === 'down') {
          await this.page.evaluate(() => window.scrollBy(0, 500));
        } else {
          await this.page.evaluate(() => window.scrollBy(0, -500));
        }
        break;
        
      default:
        logger.warn(`⚠️ Browser-Use: Unknown action type: ${action.type}`);
    }

    // Wait for action to complete
    await this.page.waitForTimeout(1000);
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

  async getPageContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    return await this.page.content();
  }

  async getPageTitle(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    return await this.page.title();
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    return this.page.url();
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.browser || !this.page) {
        return false;
      }

      // Test basic page functionality
      await this.page.evaluate(() => document.title);
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
      
      logger.info('✅ Browser-Use: Browser closed successfully');
    } catch (error) {
      logger.error('❌ Browser-Use: Error closing browser:', error);
    }
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      browserConnected: !!this.browser,
      pageReady: !!this.page,
      config: this.config
    };
  }
}

export default BrowserUseAgent;
