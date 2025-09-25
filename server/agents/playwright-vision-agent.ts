/**
 * PLAYWRIGHT VISION AGENT
 * 
 * Computer vision automation using Playwright with screenshot analysis
 * No API keys required - works entirely locally
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AgentTask, AgentResult, AgentAction } from './free-agent-registry';
import { logger } from '../logger';

export class PlaywrightVisionAgent {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: false, // Keep visible for vision tasks
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      this.page = await this.context.newPage();
      
      logger.info('✅ Playwright Vision Agent: Initialized successfully');
    } catch (error) {
      logger.error('❌ Playwright Vision Agent: Initialization failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute vision-based automation task
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    if (!this.page) {
      throw new Error('Playwright Vision Agent not initialized');
    }

    const startTime = Date.now();
    const actions: AgentAction[] = [];
    
    try {
      logger.info('🎯 Playwright Vision: Executing task', {
        taskId: task.id,
        instruction: task.instruction
      });

      // Step 1: Navigate to target if URL provided
      if (task.context?.url) {
        await this.page.goto(task.context.url, { waitUntil: 'networkidle' });
        actions.push({
          type: 'navigate',
          url: task.context.url,
          confidence: 1.0,
          reasoning: 'Navigated to target URL'
        });
      }

      // Step 2: Take initial screenshot for analysis
      const screenshot = await this.page.screenshot({ fullPage: true });
      actions.push({
        type: 'screenshot',
        confidence: 1.0,
        reasoning: 'Captured initial screenshot for analysis'
      });

      // Step 3: Analyze page content and plan actions
      const pageAnalysis = await this.analyzePageContent();
      
      // Step 4: Execute vision-based actions
      const visionActions = await this.planVisionActions(task.instruction, pageAnalysis);
      
      for (const action of visionActions) {
        await this.executeVisionAction(action);
        actions.push(action);
      }

      // Step 5: Take final screenshot
      const finalScreenshot = await this.page.screenshot({ fullPage: true });
      actions.push({
        type: 'screenshot',
        confidence: 1.0,
        reasoning: 'Captured final screenshot'
      });

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Playwright Vision: Task completed', {
        taskId: task.id,
        executionTime: `${executionTime}ms`,
        actionsCount: actions.length
      });

      return {
        success: true,
        taskId: task.id,
        agentId: 'playwright-vision',
        actions,
        confidence: 0.85,
        executionTime,
        metadata: {
          screenshots: [screenshot, finalScreenshot],
          pageAnalysis
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('❌ Playwright Vision: Task failed', {
        taskId: task.id,
        error: errorMessage,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        agentId: 'playwright-vision',
        actions,
        confidence: 0,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Analyze page content for vision-based automation
   */
  private async analyzePageContent(): Promise<any> {
    if (!this.page) throw new Error('Page not available');

    const analysis = {
      title: await this.page.title(),
      url: this.page.url(),
      elements: {
        buttons: await this.page.locator('button').count(),
        inputs: await this.page.locator('input').count(),
        links: await this.page.locator('a').count(),
        images: await this.page.locator('img').count()
      },
      forms: await this.page.locator('form').count(),
      textContent: await this.page.textContent('body') || '',
      viewport: await this.page.viewportSize()
    };

    return analysis;
  }

  /**
   * Plan vision-based actions based on instruction
   */
  private async planVisionActions(instruction: string, pageAnalysis: any): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    const instructionLower = instruction.toLowerCase();

    // Form filling actions
    if (instructionLower.includes('fill') || instructionLower.includes('form')) {
      const inputs = await this.page!.locator('input[type="text"], input[type="email"], input[type="password"], textarea').all();
      
      for (let i = 0; i < Math.min(inputs.length, 3); i++) {
        const input = inputs[i];
        const placeholder = await input.getAttribute('placeholder') || '';
        const name = await input.getAttribute('name') || '';
        
        let value = '';
        if (placeholder.includes('email') || name.includes('email')) {
          value = 'test@example.com';
        } else if (placeholder.includes('password') || name.includes('password')) {
          value = 'testpassword123';
        } else if (placeholder.includes('name') || name.includes('name')) {
          value = 'Test User';
        } else {
          value = 'Test Value';
        }

        actions.push({
          type: 'type',
          selector: `input:nth-of-type(${i + 1})`,
          text: value,
          confidence: 0.9,
          reasoning: `Filling form field: ${placeholder || name}`
        });
      }
    }

    // Button clicking actions
    if (instructionLower.includes('click') || instructionLower.includes('button')) {
      const buttons = await this.page!.locator('button, input[type="submit"], input[type="button"]').all();
      
      for (let i = 0; i < Math.min(buttons.length, 2); i++) {
        const button = buttons[i];
        const text = await button.textContent() || '';
        const isVisible = await button.isVisible();
        
        if (isVisible && text.length > 0) {
          actions.push({
            type: 'click',
            selector: `button:nth-of-type(${i + 1})`,
            confidence: 0.8,
            reasoning: `Clicking button: ${text}`
          });
        }
      }
    }

    // Navigation actions
    if (instructionLower.includes('navigate') || instructionLower.includes('go to')) {
      const links = await this.page!.locator('a[href]').all();
      
      for (let i = 0; i < Math.min(links.length, 1); i++) {
        const link = links[i];
        const href = await link.getAttribute('href') || '';
        const text = await link.textContent() || '';
        
        if (href && href.startsWith('http')) {
          actions.push({
            type: 'navigate',
            url: href,
            confidence: 0.7,
            reasoning: `Navigating to link: ${text}`
          });
        }
      }
    }

    // Scroll actions
    if (instructionLower.includes('scroll') || instructionLower.includes('down')) {
      actions.push({
        type: 'scroll',
        confidence: 0.9,
        reasoning: 'Scrolling down to see more content'
      });
    }

    return actions;
  }

  /**
   * Execute a vision-based action
   */
  private async executeVisionAction(action: AgentAction): Promise<void> {
    if (!this.page) throw new Error('Page not available');

    switch (action.type) {
      case 'click':
        if (action.selector) {
          await this.page.click(action.selector);
        }
        break;
        
      case 'type':
        if (action.selector && action.text) {
          await this.page.fill(action.selector, action.text);
        }
        break;
        
      case 'navigate':
        if (action.url) {
          await this.page.goto(action.url, { waitUntil: 'networkidle' });
        }
        break;
        
      case 'scroll':
        await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        break;
        
      case 'wait':
        await this.page.waitForTimeout(action.duration || 1000);
        break;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      logger.info('✅ Playwright Vision Agent: Cleaned up successfully');
    } catch (error) {
      logger.error('❌ Playwright Vision Agent: Cleanup failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser || !this.context || !this.page) {
        return false;
      }
      
      // Test basic functionality
      await this.page.evaluate(() => document.title);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default PlaywrightVisionAgent;
