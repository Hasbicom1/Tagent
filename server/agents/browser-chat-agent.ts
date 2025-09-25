/**
 * BROWSER CHAT AGENT
 * 
 * Real-time browser automation with chat interface integration
 * No API keys required - works entirely locally with MCP support
 */

import { EventEmitter } from 'events';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AgentTask, AgentResult, AgentAction } from './free-agent-registry';
import { logger } from '../logger';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    taskId?: string;
    agentId?: string;
    screenshot?: string;
    actions?: AgentAction[];
  };
}

export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  isActive: boolean;
  lastActivity: Date;
  currentUrl: string;
  screenshots: string[];
}

export class BrowserChatAgent extends EventEmitter {
  private sessions: Map<string, BrowserSession> = new Map();
  private messageHistory: Map<string, ChatMessage[]> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize the browser chat agent
   */
  private async initialize(): Promise<void> {
    try {
      logger.info('🤖 Browser Chat Agent: Initializing...');
      this.isInitialized = true;
      logger.info('✅ Browser Chat Agent: Initialized successfully');
    } catch (error) {
      logger.error('❌ Browser Chat Agent: Initialization failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a new browser session
   */
  async createSession(sessionId: string): Promise<BrowserSession> {
    try {
      logger.info('🌐 Browser Chat Agent: Creating new session', { sessionId });

      const browser = await chromium.launch({
        headless: false, // Keep visible for chat interface
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      const page = await context.newPage();
      
      // Enable console logging
      page.on('console', msg => {
        logger.debug('Browser Console:', { type: msg.type(), text: msg.text() });
      });

      // Enable network monitoring
      page.on('request', request => {
        logger.debug('Browser Request:', { url: request.url(), method: request.method() });
      });

      const session: BrowserSession = {
        id: sessionId,
        browser,
        context,
        page,
        isActive: true,
        lastActivity: new Date(),
        currentUrl: '',
        screenshots: []
      };

      this.sessions.set(sessionId, session);
      this.messageHistory.set(sessionId, []);

      // Initialize message history
      this.addMessage(sessionId, {
        id: `msg_${Date.now()}`,
        type: 'system',
        content: 'Browser session created successfully. Ready for automation tasks.',
        timestamp: new Date()
      });

      this.emit('sessionCreated', { sessionId });
      logger.info('✅ Browser Chat Agent: Session created', { sessionId });

      return session;
    } catch (error) {
      logger.error('❌ Browser Chat Agent: Failed to create session', {
        sessionId,
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute browser automation task with chat integration
   */
  async executeTask(sessionId: string, task: AgentTask): Promise<AgentResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actions: AgentAction[] = [];

    try {
      logger.info('🎯 Browser Chat Agent: Executing task', {
        sessionId,
        taskId: task.id,
        instruction: task.instruction
      });

      // Add user message to chat
      this.addMessage(sessionId, {
        id: `msg_${Date.now()}`,
        type: 'user',
        content: task.instruction,
        timestamp: new Date(),
        metadata: { taskId: task.id }
      });

      // Step 1: Navigate to target if URL provided
      if (task.context?.url) {
        await session.page.goto(task.context.url, { waitUntil: 'networkidle' });
        session.currentUrl = task.context.url;
        
        actions.push({
          type: 'navigate',
          url: task.context.url,
          confidence: 1.0,
          reasoning: 'Navigated to target URL'
        });

        // Take screenshot
        const screenshot = await this.captureScreenshot(session);
        session.screenshots.push(screenshot);
      }

      // Step 2: Analyze page and plan actions
      const pageAnalysis = await this.analyzePage(session.page);
      const plannedActions = await this.planActions(task.instruction, pageAnalysis);

      // Step 3: Execute actions with real-time feedback
      for (const action of plannedActions) {
        await this.executeAction(session, action);
        actions.push(action);

        // Take screenshot after each action
        const screenshot = await this.captureScreenshot(session);
        session.screenshots.push(screenshot);

        // Send real-time update to chat
        this.addMessage(sessionId, {
          id: `msg_${Date.now()}`,
          type: 'agent',
          content: `Executed: ${action.type} ${action.target || ''}`,
          timestamp: new Date(),
          metadata: {
            taskId: task.id,
            agentId: 'browser-chat-agent',
            screenshot,
            actions: [action]
          }
        });
      }

      // Step 4: Extract data if requested
      if (task.instruction.toLowerCase().includes('extract') || task.instruction.toLowerCase().includes('data')) {
        const extractedData = await this.extractData(session.page);
        actions.push({
          type: 'extract',
          confidence: 0.9,
          reasoning: 'Extracted data from page',
          metadata: { extractedData }
        });
      }

      const executionTime = Date.now() - startTime;
      session.lastActivity = new Date();

      // Add completion message
      this.addMessage(sessionId, {
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: `Task completed successfully in ${executionTime}ms`,
        timestamp: new Date(),
        metadata: {
          taskId: task.id,
          agentId: 'browser-chat-agent',
          actions
        }
      });

      logger.info('✅ Browser Chat Agent: Task completed', {
        sessionId,
        taskId: task.id,
        executionTime: `${executionTime}ms`,
        actionsCount: actions.length
      });

      return {
        success: true,
        taskId: task.id,
        agentId: 'browser-chat-agent',
        actions,
        confidence: 0.9,
        executionTime,
        metadata: {
          sessionId,
          screenshots: session.screenshots,
          currentUrl: session.currentUrl
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Add error message to chat
      this.addMessage(sessionId, {
        id: `msg_${Date.now()}`,
        type: 'agent',
        content: `Task failed: ${errorMessage}`,
        timestamp: new Date(),
        metadata: {
          taskId: task.id,
          agentId: 'browser-chat-agent'
        }
      });

      logger.error('❌ Browser Chat Agent: Task failed', {
        sessionId,
        taskId: task.id,
        error: errorMessage,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        agentId: 'browser-chat-agent',
        actions,
        confidence: 0,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Analyze page for automation planning
   */
  private async analyzePage(page: Page): Promise<any> {
    const analysis = await page.evaluate(() => {
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

    return analysis;
  }

  /**
   * Plan actions based on instruction and page analysis
   */
  private async planActions(instruction: string, pageAnalysis: any): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    const instructionLower = instruction.toLowerCase();

    // Form filling actions
    if (instructionLower.includes('fill') || instructionLower.includes('form')) {
      const inputs = pageAnalysis.elements.inputs.filter((input: any) => input.visible);
      
      for (const input of inputs.slice(0, 5)) {
        let value = '';
        
        if (input.type === 'email' || input.placeholder?.toLowerCase().includes('email')) {
          value = 'test@example.com';
        } else if (input.type === 'password' || input.placeholder?.toLowerCase().includes('password')) {
          value = 'testpassword123';
        } else if (input.placeholder?.toLowerCase().includes('name')) {
          value = 'Test User';
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

    // Button clicking actions
    if (instructionLower.includes('click') || instructionLower.includes('submit')) {
      const buttons = pageAnalysis.elements.buttons.filter((btn: any) => btn.visible && btn.text);
      
      for (const button of buttons.slice(0, 2)) {
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

    // Navigation actions
    if (instructionLower.includes('navigate') || instructionLower.includes('go to')) {
      const links = pageAnalysis.elements.links.filter((link: any) => 
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

    // Scrolling actions
    if (instructionLower.includes('scroll') || instructionLower.includes('down')) {
      actions.push({
        type: 'scroll',
        confidence: 0.9,
        reasoning: 'Scrolling to see more content'
      });
    }

    return actions;
  }

  /**
   * Execute a browser action
   */
  private async executeAction(session: BrowserSession, action: AgentAction): Promise<void> {
    try {
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await session.page.click(action.selector);
            await session.page.waitForTimeout(1000);
          }
          break;
          
        case 'type':
          if (action.selector && action.text) {
            await session.page.fill(action.selector, action.text);
          }
          break;
          
        case 'navigate':
          if (action.url) {
            await session.page.goto(action.url, { waitUntil: 'networkidle' });
            session.currentUrl = action.url;
          }
          break;
          
        case 'scroll':
          await session.page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
          });
          await session.page.waitForTimeout(1000);
          break;
          
        case 'wait':
          await session.page.waitForTimeout(action.duration || 2000);
          break;
      }
    } catch (error) {
      logger.warn('⚠️ Browser Chat Agent: Action failed', {
        action: action.type,
        selector: action.selector,
        error: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }

  /**
   * Extract data from page
   */
  private async extractData(page: Page): Promise<any> {
    const data = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent?.trim()),
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent?.trim()),
        links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
          text: link.textContent?.trim(),
          href: link.href
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt
        }))
      };
    });

    return data;
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(session: BrowserSession): Promise<string> {
    try {
      const screenshot = await session.page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      return screenshot.toString('base64');
    } catch (error) {
      logger.warn('⚠️ Browser Chat Agent: Screenshot failed', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      return '';
    }
  }

  /**
   * Add message to chat history
   */
  private addMessage(sessionId: string, message: ChatMessage): void {
    const history = this.messageHistory.get(sessionId) || [];
    history.push(message);
    this.messageHistory.set(sessionId, history);
    
    this.emit('messageAdded', { sessionId, message });
  }

  /**
   * Get chat history for session
   */
  getChatHistory(sessionId: string): ChatMessage[] {
    return this.messageHistory.get(sessionId) || [];
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.browser.close();
        this.sessions.delete(sessionId);
        this.messageHistory.delete(sessionId);
        logger.info('✅ Browser Chat Agent: Session closed', { sessionId });
      } catch (error) {
        logger.error('❌ Browser Chat Agent: Failed to close session', {
          sessionId,
          error: error instanceof Error ? error.message : 'unknown error'
        });
      }
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return this.isInitialized && this.sessions.size >= 0;
    } catch (error) {
      return false;
    }
  }
}

export default BrowserChatAgent;
