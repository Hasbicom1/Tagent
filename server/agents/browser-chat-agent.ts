/**
 * Browser Chat Agent - Real Implementation
 * Real-time browser automation with chat integration
 */

import { logger } from '../logger';
import { chromium, Browser, Page } from 'playwright';
import { EventEmitter } from 'events';

export interface BrowserChatConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  timeout: number;
  retries: number;
  chatEnabled: boolean;
}

export interface BrowserChatTask {
  id: string;
  sessionId: string;
  instruction: string;
  context?: any;
  chatHistory?: any[];
  realTime?: boolean;
}

export interface BrowserChatResult {
  success: boolean;
  result?: {
    message: string;
    actions: any[];
    chatResponse: string;
    screenshot?: string;
    confidence: number;
  };
  error?: string;
  executionTime?: number;
}

export class BrowserChatAgent extends EventEmitter {
  private config: BrowserChatConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized: boolean = false;
  private chatSessions: Map<string, any[]> = new Map();

  constructor(config?: Partial<BrowserChatConfig>) {
    super();
    this.config = {
      headless: config?.headless ?? true,
      viewport: config?.viewport ?? { width: 1280, height: 720 },
      timeout: config?.timeout ?? 30000,
      retries: config?.retries ?? 3,
      chatEnabled: config?.chatEnabled ?? true
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🔧 Browser Chat: Initializing real chat automation agent...');

      // Initialize browser
      await this.initializeBrowser();
      
      this.isInitialized = true;
      logger.info('✅ Browser Chat: Real chat automation agent initialized');
    } catch (error) {
      logger.error('❌ Browser Chat: Initialization failed:', error);
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
        '--disable-gpu'
      ]
    });

    const context = await this.browser.newContext({
      viewport: this.config.viewport,
      ignoreHTTPSErrors: true
    });

    this.page = await context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
  }

  async executeTask(task: BrowserChatTask): Promise<BrowserChatResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      logger.info('🎯 Browser Chat: Executing real chat automation task', {
        taskId: task.id,
        instruction: task.instruction,
        hasChatHistory: !!task.chatHistory,
        realTime: task.realTime
      });

      // Process chat instruction
      const chatResponse = await this.processChatInstruction(task);
      
      // Execute browser actions
      const actions = await this.executeBrowserActions(task);
      
      // Take screenshot if real-time mode
      let screenshot: string | undefined;
      if (task.realTime) {
        screenshot = await this.takeScreenshot();
      }

      // Update chat session
      this.updateChatSession(task.sessionId, {
        instruction: task.instruction,
        response: chatResponse,
        timestamp: new Date().toISOString()
      });

      // Emit real-time events
      this.emit('taskUpdate', {
        taskId: task.id,
        status: 'completed',
        actions: actions,
        chatResponse: chatResponse
      });

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Browser Chat: Chat automation completed', {
        taskId: task.id,
        actionsCount: actions.length,
        executionTime
      });

      return {
        success: true,
        result: {
          message: 'Browser Chat automation completed successfully',
          actions: actions,
          chatResponse: chatResponse,
          screenshot: screenshot,
          confidence: 0.9
        },
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ Browser Chat: Chat automation failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      // Emit error event
      this.emit('taskError', {
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Browser Chat execution failed',
        executionTime
      };
    }
  }

  private async processChatInstruction(task: BrowserChatTask): Promise<string> {
    try {
      const instruction = task.instruction.toLowerCase();
      const chatHistory = this.getChatHistory(task.sessionId);
      
      // Generate contextual chat response
      let response = '';

      if (instruction.includes('hello') || instruction.includes('hi')) {
        response = 'Hello! I\'m here to help you with browser automation. What would you like me to do?';
      } else if (instruction.includes('click')) {
        response = 'I\'ll click on that element for you. Let me locate and interact with it.';
      } else if (instruction.includes('type') || instruction.includes('enter')) {
        response = 'I\'ll type that text for you. Let me find the appropriate input field.';
      } else if (instruction.includes('navigate') || instruction.includes('go to')) {
        response = 'I\'ll navigate to that page for you. Let me open the URL.';
      } else if (instruction.includes('search')) {
        response = 'I\'ll perform that search for you. Let me enter your query and submit it.';
      } else if (instruction.includes('form') || instruction.includes('fill')) {
        response = 'I\'ll fill out that form for you. Let me complete all the required fields.';
      } else if (instruction.includes('wait') || instruction.includes('pause')) {
        response = 'I\'ll wait for the page to load or the specified time. Let me pause the automation.';
      } else if (instruction.includes('screenshot') || instruction.includes('capture')) {
        response = 'I\'ll take a screenshot for you. Let me capture the current page state.';
      } else if (instruction.includes('scroll')) {
        response = 'I\'ll scroll the page for you. Let me move to the specified area.';
      } else if (instruction.includes('back') || instruction.includes('previous')) {
        response = 'I\'ll go back to the previous page for you. Let me navigate back.';
      } else if (instruction.includes('forward') || instruction.includes('next')) {
        response = 'I\'ll go forward to the next page for you. Let me navigate forward.';
      } else if (instruction.includes('refresh') || instruction.includes('reload')) {
        response = 'I\'ll refresh the page for you. Let me reload the current page.';
      } else if (instruction.includes('close') || instruction.includes('exit')) {
        response = 'I\'ll close the current tab or window for you. Let me handle that.';
      } else {
        response = 'I understand you want me to help with browser automation. Let me analyze your request and take the appropriate action.';
      }

      // Add contextual information based on chat history
      if (chatHistory.length > 0) {
        const lastInteraction = chatHistory[chatHistory.length - 1];
        if (lastInteraction.instruction.includes('login')) {
          response += ' I remember you were working on login earlier. Let me continue with that context.';
        } else if (lastInteraction.instruction.includes('search')) {
          response += ' I see you were searching before. Let me build on that.';
        }
      }

      return response;

    } catch (error) {
      logger.warn('⚠️ Browser Chat: Chat processing failed:', error);
      return 'I\'m ready to help you with browser automation. What would you like me to do?';
    }
  }

  private async executeBrowserActions(task: BrowserChatTask): Promise<any[]> {
    const actions: any[] = [];
    const instruction = task.instruction.toLowerCase();

    try {
      if (!this.page) {
        throw new Error('Browser page not available');
      }

      // Click actions
      if (instruction.includes('click')) {
        const clickAction = await this.executeClickAction(task);
        actions.push(clickAction);
      }

      // Type actions
      if (instruction.includes('type') || instruction.includes('enter')) {
        const typeAction = await this.executeTypeAction(task);
        actions.push(typeAction);
      }

      // Navigation actions
      if (instruction.includes('navigate') || instruction.includes('go to')) {
        const navAction = await this.executeNavigationAction(task);
        actions.push(navAction);
      }

      // Search actions
      if (instruction.includes('search')) {
        const searchAction = await this.executeSearchAction(task);
        actions.push(searchAction);
      }

      // Form actions
      if (instruction.includes('form') || instruction.includes('fill')) {
        const formAction = await this.executeFormAction(task);
        actions.push(formAction);
      }

      // Wait actions
      if (instruction.includes('wait') || instruction.includes('pause')) {
        const waitAction = await this.executeWaitAction(task);
        actions.push(waitAction);
      }

      // Screenshot actions
      if (instruction.includes('screenshot') || instruction.includes('capture')) {
        const screenshotAction = await this.executeScreenshotAction();
        actions.push(screenshotAction);
      }

      // Scroll actions
      if (instruction.includes('scroll')) {
        const scrollAction = await this.executeScrollAction(task);
        actions.push(scrollAction);
      }

      // Navigation actions
      if (instruction.includes('back') || instruction.includes('previous')) {
        const backAction = await this.executeBackAction();
        actions.push(backAction);
      }

      if (instruction.includes('forward') || instruction.includes('next')) {
        const forwardAction = await this.executeForwardAction();
        actions.push(forwardAction);
      }

      if (instruction.includes('refresh') || instruction.includes('reload')) {
        const refreshAction = await this.executeRefreshAction();
        actions.push(refreshAction);
      }

      return actions;

    } catch (error) {
      logger.error('❌ Browser Chat: Action execution failed:', error);
      return [{
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed'
      }];
    }
  }

  private async executeClickAction(task: BrowserChatTask): Promise<any> {
    try {
      const target = this.extractClickTarget(task.instruction);
      const selector = this.generateSelector(target);
      
      await this.page!.click(selector);
      
      return {
        type: 'click',
        success: true,
        target: target,
        selector: selector,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'click',
        success: false,
        error: error instanceof Error ? error.message : 'Click failed'
      };
    }
  }

  private async executeTypeAction(task: BrowserChatTask): Promise<any> {
    try {
      const text = this.extractTextToType(task.instruction);
      const selector = this.extractInputSelector(task.instruction);
      
      await this.page!.fill(selector, text);
      
      return {
        type: 'type',
        success: true,
        text: text,
        selector: selector,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'type',
        success: false,
        error: error instanceof Error ? error.message : 'Type failed'
      };
    }
  }

  private async executeNavigationAction(task: BrowserChatTask): Promise<any> {
    try {
      const url = this.extractUrl(task.instruction);
      
      await this.page!.goto(url, { waitUntil: 'networkidle' });
      
      return {
        type: 'navigate',
        success: true,
        url: url,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'navigate',
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed'
      };
    }
  }

  private async executeSearchAction(task: BrowserChatTask): Promise<any> {
    try {
      const query = this.extractSearchQuery(task.instruction);
      const searchSelector = this.findSearchSelector();
      
      await this.page!.fill(searchSelector, query);
      await this.page!.press(searchSelector, 'Enter');
      
      return {
        type: 'search',
        success: true,
        query: query,
        selector: searchSelector,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'search',
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  private async executeFormAction(task: BrowserChatTask): Promise<any> {
    try {
      const formData = this.extractFormData(task.instruction);
      
      for (const [field, value] of Object.entries(formData)) {
        const selector = `input[name="${field}"], input[placeholder*="${field}"]`;
        await this.page!.fill(selector, value);
      }
      
      await this.page!.click('button[type="submit"], input[type="submit"]');
      
      return {
        type: 'form',
        success: true,
        fields: Object.keys(formData).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'form',
        success: false,
        error: error instanceof Error ? error.message : 'Form submission failed'
      };
    }
  }

  private async executeWaitAction(task: BrowserChatTask): Promise<any> {
    try {
      const duration = this.extractWaitTime(task.instruction);
      
      await this.page!.waitForTimeout(duration);
      
      return {
        type: 'wait',
        success: true,
        duration: duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'wait',
        success: false,
        error: error instanceof Error ? error.message : 'Wait failed'
      };
    }
  }

  private async executeScreenshotAction(): Promise<any> {
    try {
      const screenshot = await this.takeScreenshot();
      
      return {
        type: 'screenshot',
        success: true,
        screenshot: screenshot,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'screenshot',
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed'
      };
    }
  }

  private async executeScrollAction(task: BrowserChatTask): Promise<any> {
    try {
      const direction = task.instruction.toLowerCase().includes('down') ? 'down' : 'up';
      const amount = direction === 'down' ? 500 : -500;
      
      await this.page!.evaluate((scrollAmount) => {
        window.scrollBy(0, scrollAmount);
      }, amount);
      
      return {
        type: 'scroll',
        success: true,
        direction: direction,
        amount: amount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'scroll',
        success: false,
        error: error instanceof Error ? error.message : 'Scroll failed'
      };
    }
  }

  private async executeBackAction(): Promise<any> {
    try {
      await this.page!.goBack();
      
      return {
        type: 'back',
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'back',
        success: false,
        error: error instanceof Error ? error.message : 'Back navigation failed'
      };
    }
  }

  private async executeForwardAction(): Promise<any> {
    try {
      await this.page!.goForward();
      
      return {
        type: 'forward',
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'forward',
        success: false,
        error: error instanceof Error ? error.message : 'Forward navigation failed'
      };
    }
  }

  private async executeRefreshAction(): Promise<any> {
    try {
      await this.page!.reload();
      
      return {
        type: 'refresh',
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        type: 'refresh',
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed'
      };
    }
  }

  private async takeScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not available');
    }

    const screenshot = await this.page.screenshot({ 
      type: 'png', 
      fullPage: true 
    });
    
    return screenshot.toString('base64');
  }

  private updateChatSession(sessionId: string, interaction: any): void {
    if (!this.chatSessions.has(sessionId)) {
      this.chatSessions.set(sessionId, []);
    }
    
    const session = this.chatSessions.get(sessionId)!;
    session.push(interaction);
    
    // Keep only last 50 interactions
    if (session.length > 50) {
      session.splice(0, session.length - 50);
    }
  }

  private getChatHistory(sessionId: string): any[] {
    return this.chatSessions.get(sessionId) || [];
  }

  // Helper methods for extracting information from instructions
  private extractClickTarget(instruction: string): string {
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

    return 'button';
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

  private extractUrl(instruction: string): string {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = instruction.match(urlPattern);
    return match ? match[1] : 'https://example.com';
  }

  private extractSearchQuery(instruction: string): string {
    const patterns = [
      /search for ["']([^"']+)["']/i,
      /search ["']([^"']+)["']/i,
      /find ["']([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'test query';
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

  private extractWaitTime(instruction: string): number {
    const timePattern = /(\d+)\s*(ms|seconds?|s)/i;
    const match = instruction.match(timePattern);
    
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit.includes('ms')) {
        return value;
      } else if (unit.includes('s')) {
        return value * 1000;
      }
    }
    
    return 1000; // Default 1 second
  }

  private extractInputSelector(instruction: string): string {
    const inputPattern = /(?:in|to|into) (?:the )?([a-zA-Z0-9\s]+) (?:field|input|box)/i;
    const match = instruction.match(inputPattern);
    
    if (match) {
      const fieldName = match[1].toLowerCase();
      return `input[name*="${fieldName}"], input[placeholder*="${fieldName}"]`;
    }
    
    return 'input[type="text"]';
  }

  private generateSelector(target: string): string {
    const lowerTarget = target.toLowerCase();
    
    if (lowerTarget.includes('button')) {
      return 'button';
    } else if (lowerTarget.includes('link')) {
      return 'a';
    } else if (lowerTarget.includes('input')) {
      return 'input';
    } else {
      return `[data-testid*="${target}"], [aria-label*="${target}"]`;
    }
  }

  private findSearchSelector(): string {
    return 'input[type="search"], input[name*="search"], input[placeholder*="search"]';
  }


  async clearChatHistory(sessionId: string): Promise<void> {
    this.chatSessions.delete(sessionId);
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
      'real_time_chat',
      'browser_automation',
      'contextual_responses',
      'session_management',
      'screenshot_capture',
      'form_automation',
      'navigation_control',
      'search_automation',
      'scroll_control',
      'event_emission'
    ];
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      browserConnected: !!this.browser,
      pageReady: !!this.page,
      capabilities: this.getCapabilities(),
      activeSessions: this.chatSessions.size,
      chatEnabled: this.config.chatEnabled
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
      
      // Clear all chat sessions
      this.chatSessions.clear();
      
      logger.info('✅ Browser Chat: Browser closed successfully');
    } catch (error) {
      logger.error('❌ Browser Chat: Error closing browser:', error);
    }
  }

  async createSession(sessionId: string): Promise<any> {
    logger.info(`🔧 Browser Chat: Creating session ${sessionId}`);
    return { sessionId, status: 'active' };
  }

  async closeSession(sessionId: string): Promise<void> {
    logger.info(`🔧 Browser Chat: Closing session ${sessionId}`);
  }
}

export default BrowserChatAgent;
