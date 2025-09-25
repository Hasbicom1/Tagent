/**
 * PUPPETEER AI AGENT
 * 
 * Puppeteer with AI-powered task planning and execution
 * No API keys required - works entirely locally
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { AgentTask, AgentResult, AgentAction } from './free-agent-registry';
import { logger } from '../logger';

export class PuppeteerAIAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Keep visible for AI tasks
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
      
      this.page = await this.browser.newPage();
      
      // Set viewport for consistent rendering
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      logger.info('✅ Puppeteer AI Agent: Initialized successfully');
    } catch (error) {
      logger.error('❌ Puppeteer AI Agent: Initialization failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute AI-powered automation task
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    if (!this.page) {
      throw new Error('Puppeteer AI Agent not initialized');
    }

    const startTime = Date.now();
    const actions: AgentAction[] = [];
    
    try {
      logger.info('🎯 Puppeteer AI: Executing task', {
        taskId: task.id,
        instruction: task.instruction
      });

      // Step 1: Navigate to target if URL provided
      if (task.context?.url) {
        await this.page.goto(task.context.url, { waitUntil: 'networkidle2' });
        actions.push({
          type: 'navigate',
          url: task.context.url,
          confidence: 1.0,
          reasoning: 'Navigated to target URL'
        });
      }

      // Step 2: Analyze page structure
      const pageStructure = await this.analyzePageStructure();
      
      // Step 3: Plan AI-powered actions
      const aiActions = await this.planAIActions(task.instruction, pageStructure);
      
      // Step 4: Execute actions with AI reasoning
      for (const action of aiActions) {
        await this.executeAIAction(action);
        actions.push(action);
      }

      // Step 5: Extract data if requested
      if (task.instruction.toLowerCase().includes('extract') || task.instruction.toLowerCase().includes('data')) {
        const extractedData = await this.extractData();
        actions.push({
          type: 'extract',
          confidence: 0.9,
          reasoning: 'Extracted data from page',
          metadata: { extractedData }
        });
      }

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Puppeteer AI: Task completed', {
        taskId: task.id,
        executionTime: `${executionTime}ms`,
        actionsCount: actions.length
      });

      return {
        success: true,
        taskId: task.id,
        agentId: 'puppeteer-ai',
        actions,
        confidence: 0.9,
        executionTime,
        metadata: {
          pageStructure,
          extractedData: actions.find(a => a.type === 'extract')?.metadata?.extractedData
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('❌ Puppeteer AI: Task failed', {
        taskId: task.id,
        error: errorMessage,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        agentId: 'puppeteer-ai',
        actions,
        confidence: 0,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Analyze page structure for AI planning
   */
  private async analyzePageStructure(): Promise<any> {
    if (!this.page) throw new Error('Page not available');

    const structure = await this.page.evaluate(() => {
      const elements = {
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim() || '',
          id: btn.id,
          className: btn.className,
          visible: btn.offsetParent !== null
        })),
        inputs: Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          placeholder: input.placeholder,
          name: input.name,
          id: input.id,
          visible: input.offsetParent !== null
        })),
        links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
          text: link.textContent?.trim() || '',
          href: link.href,
          visible: link.offsetParent !== null
        })),
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          inputs: form.querySelectorAll('input').length
        }))
      };

      return {
        title: document.title,
        url: window.location.href,
        elements,
        textContent: document.body.textContent?.substring(0, 1000) || ''
      };
    });

    return structure;
  }

  /**
   * Plan AI-powered actions based on instruction
   */
  private async planAIActions(instruction: string, pageStructure: any): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    const instructionLower = instruction.toLowerCase();

    // Smart form filling
    if (instructionLower.includes('fill') || instructionLower.includes('form')) {
      const inputs = pageStructure.elements.inputs.filter((input: any) => input.visible);
      
      for (const input of inputs.slice(0, 5)) { // Limit to 5 inputs
        let value = '';
        
        if (input.type === 'email' || input.placeholder?.toLowerCase().includes('email')) {
          value = 'test@example.com';
        } else if (input.type === 'password' || input.placeholder?.toLowerCase().includes('password')) {
          value = 'testpassword123';
        } else if (input.placeholder?.toLowerCase().includes('name')) {
          value = 'Test User';
        } else if (input.placeholder?.toLowerCase().includes('phone')) {
          value = '123-456-7890';
        } else if (input.placeholder?.toLowerCase().includes('address')) {
          value = '123 Test Street';
        } else {
          value = 'Test Value';
        }

        const selector = input.id ? `#${input.id}` : 
                       input.name ? `input[name="${input.name}"]` :
                       `input[placeholder="${input.placeholder}"]`;

        actions.push({
          type: 'type',
          selector,
          text: value,
          confidence: 0.9,
          reasoning: `Filling ${input.placeholder || input.type} field`
        });
      }
    }

    // Smart button clicking
    if (instructionLower.includes('click') || instructionLower.includes('submit')) {
      const buttons = pageStructure.elements.buttons.filter((btn: any) => btn.visible && btn.text);
      
      // Prioritize buttons by text content
      const priorityButtons = buttons.filter((btn: any) => 
        btn.text.toLowerCase().includes('submit') ||
        btn.text.toLowerCase().includes('send') ||
        btn.text.toLowerCase().includes('continue') ||
        btn.text.toLowerCase().includes('next')
      );

      const targetButtons = priorityButtons.length > 0 ? priorityButtons : buttons;
      
      for (const button of targetButtons.slice(0, 2)) {
        const selector = button.id ? `#${button.id}` : 
                        button.className ? `.${button.className.split(' ')[0]}` :
                        `button:contains("${button.text}")`;

        actions.push({
          type: 'click',
          selector,
          confidence: 0.8,
          reasoning: `Clicking button: ${button.text}`
        });
      }
    }

    // Smart navigation
    if (instructionLower.includes('navigate') || instructionLower.includes('go to')) {
      const links = pageStructure.elements.links.filter((link: any) => 
        link.visible && link.href && link.href.startsWith('http')
      );
      
      for (const link of links.slice(0, 1)) {
        actions.push({
          type: 'navigate',
          url: link.href,
          confidence: 0.7,
          reasoning: `Navigating to: ${link.text}`
        });
      }
    }

    // Smart scrolling
    if (instructionLower.includes('scroll') || instructionLower.includes('down')) {
      actions.push({
        type: 'scroll',
        confidence: 0.9,
        reasoning: 'Scrolling to see more content'
      });
    }

    // Smart waiting
    if (instructionLower.includes('wait') || instructionLower.includes('load')) {
      actions.push({
        type: 'wait',
        duration: 2000,
        confidence: 0.8,
        reasoning: 'Waiting for page to load'
      });
    }

    return actions;
  }

  /**
   * Execute an AI-powered action
   */
  private async executeAIAction(action: AgentAction): Promise<void> {
    if (!this.page) throw new Error('Page not available');

    try {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await this.page.click(action.selector);
            await this.page.waitForTimeout(1000); // Wait for action to complete
          }
          break;
          
        case 'type':
          if (action.selector && action.text) {
            await this.page.type(action.selector, action.text, { delay: 100 });
          }
          break;
          
        case 'navigate':
          if (action.url) {
            await this.page.goto(action.url, { waitUntil: 'networkidle2' });
          }
          break;
          
        case 'scroll':
          await this.page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
          });
          await this.page.waitForTimeout(1000);
          break;
          
        case 'wait':
          await this.page.waitForTimeout(action.duration || 2000);
          break;
      }
    } catch (error) {
      logger.warn('⚠️ Puppeteer AI: Action failed', {
        action: action.type,
        selector: action.selector,
        error: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }

  /**
   * Extract data from page
   */
  private async extractData(): Promise<any> {
    if (!this.page) throw new Error('Page not available');

    const data = await this.page.evaluate(() => {
      const extractText = (selector: string) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => el.textContent?.trim()).filter(Boolean);
      };

      return {
        title: document.title,
        url: window.location.href,
        headings: extractText('h1, h2, h3, h4, h5, h6'),
        paragraphs: extractText('p'),
        links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
          text: link.textContent?.trim(),
          href: link.href
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt
        })),
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input')).map(input => ({
            type: input.type,
            name: input.name,
            placeholder: input.placeholder
          }))
        }))
      };
    });

    return data;
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
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      logger.info('✅ Puppeteer AI Agent: Cleaned up successfully');
    } catch (error) {
      logger.error('❌ Puppeteer AI Agent: Cleanup failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser || !this.page) {
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

export default PuppeteerAIAgent;
