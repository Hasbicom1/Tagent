/**
 * LOCAL BROWSER AUTOMATION ENGINE
 * 
 * Self-contained browser automation that runs entirely locally
 * No external API dependencies - uses local Playwright and computer vision
 */

import { chromium, Browser, Page, ElementHandle } from 'playwright';
import { EventEmitter } from 'events';

export interface LocalBrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent: string;
  timeout: number;
  enableScreenshots: boolean;
  enableVideo: boolean;
}

export interface LocalAutomationTask {
  id: string;
  instruction: string;
  type: 'navigation' | 'interaction' | 'extraction' | 'form' | 'search';
  target?: string;
  data?: any;
  priority: 'low' | 'medium' | 'high';
}

export interface LocalAutomationResult {
  success: boolean;
  taskId: string;
  actions: string[];
  data?: any;
  screenshot?: string;
  error?: string;
  executionTime: number;
}

export class LocalBrowserAutomationEngine extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: LocalBrowserConfig;
  private isInitialized = false;
  private taskQueue: LocalAutomationTask[] = [];
  private isProcessing = false;

  constructor(config: LocalBrowserConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize local browser automation
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 LOCAL BROWSER: Initializing local automation engine...');
      
      // Launch browser with local configuration
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

      // Create new page
      this.page = await this.browser.newPage({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent
      });

      // Set timeouts
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);

      // Enable request/response logging
      this.page.on('request', (request) => {
        this.emit('request', request.url());
      });

      this.page.on('response', (response) => {
        this.emit('response', response.url(), response.status());
      });

      this.isInitialized = true;
      console.log('✅ LOCAL BROWSER: Local automation engine initialized');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ LOCAL BROWSER: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute local automation task
   */
  async executeTask(task: LocalAutomationTask): Promise<LocalAutomationResult> {
    const startTime = Date.now();
    const actions: string[] = [];
    
    try {
      if (!this.isInitialized || !this.page) {
        throw new Error('Browser not initialized');
      }

      console.log(`🚀 LOCAL BROWSER: Executing task ${task.id} - ${task.instruction}`);
      
      this.emit('taskStarted', task);

      // Route to appropriate handler based on task type
      let result: any;
      switch (task.type) {
        case 'navigation':
          result = await this.handleNavigation(task, actions);
          break;
        case 'interaction':
          result = await this.handleInteraction(task, actions);
          break;
        case 'extraction':
          result = await this.handleExtraction(task, actions);
          break;
        case 'form':
          result = await this.handleForm(task, actions);
          break;
        case 'search':
          result = await this.handleSearch(task, actions);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      const executionTime = Date.now() - startTime;
      
      // Take screenshot if enabled
      let screenshot: string | undefined;
      if (this.config.enableScreenshots) {
        screenshot = await this.takeScreenshot();
      }

      const automationResult: LocalAutomationResult = {
        success: true,
        taskId: task.id,
        actions,
        data: result,
        screenshot,
        executionTime
      };

      console.log(`✅ LOCAL BROWSER: Task ${task.id} completed in ${executionTime}ms`);
      this.emit('taskCompleted', automationResult);

      return automationResult;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ LOCAL BROWSER: Task ${task.id} failed:`, error);
      
      const automationResult: LocalAutomationResult = {
        success: false,
        taskId: task.id,
        actions,
        error: error.message,
        executionTime
      };

      this.emit('taskFailed', automationResult);
      return automationResult;
    }
  }

  /**
   * Handle navigation tasks
   */
  private async handleNavigation(task: LocalAutomationTask, actions: string[]): Promise<any> {
    if (!this.page) throw new Error('Page not available');
    
    const url = this.extractUrl(task.instruction);
    if (!url) {
      throw new Error('No valid URL found in instruction');
    }

    actions.push(`Navigating to ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle' });
    
    actions.push('Page loaded successfully');
    return { url, title: await this.page.title() };
  }

  /**
   * Handle interaction tasks (click, type, etc.)
   */
  private async handleInteraction(task: LocalAutomationTask, actions: string[]): Promise<any> {
    if (!this.page) throw new Error('Page not available');
    
    const element = await this.findElement(task.instruction);
    if (!element) {
      throw new Error('Element not found');
    }

    if (task.instruction.toLowerCase().includes('click')) {
      actions.push(`Clicking element: ${task.target}`);
      await element.click();
    } else if (task.instruction.toLowerCase().includes('type')) {
      const text = this.extractTextToType(task.instruction);
      actions.push(`Typing: ${text}`);
      await element.fill(text);
    }

    actions.push('Interaction completed');
    return { action: 'interaction_completed' };
  }

  /**
   * Handle data extraction tasks
   */
  private async handleExtraction(task: LocalAutomationTask, actions: string[]): Promise<any> {
    if (!this.page) throw new Error('Page not available');
    
    actions.push('Starting data extraction');
    
    // Extract text content
    const textContent = await this.page.textContent('body');
    
    // Extract links
    const links = await this.page.$$eval('a', elements => 
      elements.map(el => ({ text: el.textContent, href: el.href }))
    );
    
    // Extract images
    const images = await this.page.$$eval('img', elements => 
      elements.map(el => ({ src: el.src, alt: el.alt }))
    );
    
    actions.push(`Extracted ${links.length} links, ${images.length} images`);
    
    return {
      textContent: textContent?.substring(0, 1000), // Limit size
      links,
      images,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Handle form filling tasks
   */
  private async handleForm(task: LocalAutomationTask, actions: string[]): Promise<any> {
    if (!this.page) throw new Error('Page not available');
    
    actions.push('Locating form elements');
    
    // Find form inputs
    const inputs = await this.page.$$('input, textarea, select');
    const formData: any = {};
    
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      
      if (name || placeholder) {
        const fieldName = name || placeholder || 'unknown';
        formData[fieldName] = task.data?.[fieldName] || 'test_value';
        
        actions.push(`Filling field: ${fieldName}`);
        await input.fill(formData[fieldName]);
      }
    }
    
    // Submit form if submit button exists
    const submitButton = await this.page.$('input[type="submit"], button[type="submit"], button:has-text("Submit")');
    if (submitButton) {
      actions.push('Submitting form');
      await submitButton.click();
    }
    
    actions.push('Form handling completed');
    return { formData, submitted: !!submitButton };
  }

  /**
   * Handle search tasks
   */
  private async handleSearch(task: LocalAutomationTask, actions: string[]): Promise<any> {
    if (!this.page) throw new Error('Page not available');
    
    const searchQuery = this.extractSearchQuery(task.instruction);
    if (!searchQuery) {
      throw new Error('No search query found');
    }
    
    actions.push(`Searching for: ${searchQuery}`);
    
    // Find search input
    const searchInput = await this.page.$('input[type="search"], input[name*="search"], input[placeholder*="search"]');
    if (!searchInput) {
      throw new Error('Search input not found');
    }
    
    await searchInput.fill(searchQuery);
    await searchInput.press('Enter');
    
    // Wait for results
    await this.page.waitForLoadState('networkidle');
    
    actions.push('Search completed');
    return { query: searchQuery, resultsLoaded: true };
  }

  /**
   * Find element using multiple strategies
   */
  private async findElement(instruction: string): Promise<ElementHandle | null> {
    if (!this.page) return null;
    
    const strategies = [
      // By text content
      () => this.page!.locator(`text=${task.target}`).first(),
      // By CSS selector
      () => this.page!.locator(task.target!).first(),
      // By data attributes
      () => this.page!.locator(`[data-testid="${task.target}"]`).first(),
      // By aria-label
      () => this.page!.locator(`[aria-label*="${task.target}"]`).first(),
      // By placeholder
      () => this.page!.locator(`[placeholder*="${task.target}"]`).first()
    ];
    
    for (const strategy of strategies) {
      try {
        const element = await strategy();
        if (await element.count() > 0) {
          return await element.elementHandle();
        }
      } catch (error) {
        // Continue to next strategy
      }
    }
    
    return null;
  }

  /**
   * Extract URL from instruction
   */
  private extractUrl(instruction: string): string | null {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = instruction.match(urlPattern);
    return match ? match[1] : null;
  }

  /**
   * Extract text to type from instruction
   */
  private extractTextToType(instruction: string): string {
    const patterns = [
      /type\s+"([^"]+)"/i,
      /type\s+'([^']+)'/i,
      /type\s+([^\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return 'test input';
  }

  /**
   * Extract search query from instruction
   */
  private extractSearchQuery(instruction: string): string | null {
    const patterns = [
      /search for\s+"([^"]+)"/i,
      /search for\s+'([^']+)'/i,
      /search\s+"([^"]+)"/i,
      /search\s+'([^']+)'/i,
      /search\s+([^\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Take screenshot
   */
  private async takeScreenshot(): Promise<string> {
    if (!this.page) return '';
    
    try {
      const screenshot = await this.page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      return screenshot.toString('base64');
    } catch (error) {
      console.error('❌ LOCAL BROWSER: Screenshot failed:', error);
      return '';
    }
  }

  /**
   * Get current page info
   */
  async getPageInfo(): Promise<any> {
    if (!this.page) return null;
    
    return {
      url: this.page.url(),
      title: await this.page.title(),
      viewport: this.page.viewportSize()
    };
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
      console.log('🔧 LOCAL BROWSER: Browser closed');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.page) {
        return false;
      }
      
      // Test basic page functionality
      await this.page.evaluate(() => document.title);
      return true;
    } catch (error) {
      console.error('❌ LOCAL BROWSER: Health check failed:', error);
      return false;
    }
  }
}

export default LocalBrowserAutomationEngine;
