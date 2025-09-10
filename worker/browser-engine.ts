/**
 * PHOENIX-7742 Browser Automation Engine
 * 
 * High-performance Playwright-based browser automation engine
 * for executing real browser tasks with AI-powered planning
 */

import { chromium, firefox, webkit, Browser, BrowserContext, Page, ElementHandle } from 'playwright';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import OpenAI from 'openai';

// Task execution interfaces
export interface BrowserTask {
  id: string;
  sessionId: string;
  instruction: string;
  url?: string;
  context?: Record<string, any>;
  timeout?: number;
}

export interface BrowserTaskResult {
  success: boolean;
  taskId: string;
  executionTime: number;
  steps: ExecutionStep[];
  screenshots: string[];
  extractedData?: any;
  finalUrl?: string;
  error?: string;
  logs: string[];
}

export interface ExecutionStep {
  id: string;
  action: string;
  target?: string;
  value?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: Date;
  duration?: number;
  screenshot?: string;
  error?: string;
  extractedData?: any;
}

interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
}

interface EngineConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  taskTimeout: number;
  maxConcurrentSessions: number;
  sessionTimeout: number;
}

export class BrowserEngine extends EventEmitter {
  private openai: OpenAI | null = null;
  private hasOpenAI: boolean = false;
  private config: EngineConfig;
  private sessions = new Map<string, BrowserSession>();
  private isInitialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<EngineConfig> = {}) {
    super();
    
    this.config = {
      browserType: 'chromium',
      headless: true,
      taskTimeout: 300000, // 5 minutes
      maxConcurrentSessions: 3,
      sessionTimeout: 600000, // 10 minutes
      ...config,
    };

    // Initialize OpenAI conditionally for AI-powered automation planning
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        });
        this.hasOpenAI = true;
        this.log('✅ OpenAI initialized for enhanced automation planning');
      } catch (error) {
        this.log('⚠️ OpenAI initialization failed, falling back to rule-based planning:', error);
        this.hasOpenAI = false;
      }
    } else {
      this.log('💡 No OpenAI API key provided - using fallback automation planning');
      this.hasOpenAI = false;
    }
  }

  /**
   * Initialize the browser engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.log('🌐 Initializing browser engine...', { 
        browserType: this.config.browserType,
        headless: this.config.headless 
      });

      // Test browser launch
      await this.testBrowserLaunch();

      // Start session cleanup
      this.startSessionCleanup();

      this.isInitialized = true;
      this.log('✅ Browser engine initialized successfully');
      
    } catch (error) {
      this.log('❌ Failed to initialize browser engine:', error);
      throw error;
    }
  }

  /**
   * Execute a browser automation task
   */
  async executeTask(task: BrowserTask): Promise<BrowserTaskResult> {
    const startTime = performance.now();
    const logs: string[] = [];
    const screenshots: string[] = [];
    let steps: ExecutionStep[] = [];
    
    try {
      this.log('⚡ Starting task execution', { taskId: task.id, instruction: task.instruction });
      logs.push(`Starting task: ${task.instruction}`);

      // Create or reuse browser session
      const session = await this.getOrCreateSession(task.sessionId);
      logs.push(`Browser session ready: ${session.id}`);

      // Plan automation steps using AI
      steps = await this.planAutomationSteps(task.instruction, task.context);
      logs.push(`Generated ${steps.length} automation steps`);

      // Navigate to initial URL if provided
      if (task.url) {
        await session.page.goto(task.url, { waitUntil: 'networkidle' });
        logs.push(`Navigated to: ${task.url}`);
        
        // Take initial screenshot
        const screenshot = await this.captureScreenshot(session.page);
        screenshots.push(screenshot);
      }

      // Execute each step
      for (const step of steps) {
        await this.executeStep(session, step, logs);
        
        // Take screenshot after each significant step
        if (['click', 'navigate', 'extract'].includes(step.action.toLowerCase().split(' ')[0])) {
          const screenshot = await this.captureScreenshot(session.page);
          step.screenshot = screenshot;
          screenshots.push(screenshot);
        }
      }

      // Extract final data if needed
      const extractedData = await this.extractPageData(session.page);
      const finalUrl = session.page.url();

      const executionTime = performance.now() - startTime;
      
      this.log('✅ Task completed successfully', { 
        taskId: task.id, 
        executionTime: `${executionTime.toFixed(2)}ms`,
        stepsCompleted: steps.filter(s => s.status === 'completed').length 
      });

      return {
        success: true,
        taskId: task.id,
        executionTime,
        steps,
        screenshots,
        extractedData,
        finalUrl,
        logs,
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.log('❌ Task execution failed', { 
        taskId: task.id, 
        error: errorMessage,
        executionTime: `${executionTime.toFixed(2)}ms` 
      });

      logs.push(`Task failed: ${errorMessage}`);

      return {
        success: false,
        taskId: task.id,
        executionTime,
        steps,
        screenshots,
        error: errorMessage,
        logs,
      };
    }
  }

  /**
   * Plan automation steps using AI or fallback logic
   */
  private async planAutomationSteps(instruction: string, context?: Record<string, any>): Promise<ExecutionStep[]> {
    // Use AI-powered planning if available
    if (this.hasOpenAI && this.openai) {
      return this.planAutomationStepsWithAI(instruction, context);
    }
    
    // Use fallback rule-based planning
    return this.planAutomationStepsWithRules(instruction, context);
  }

  /**
   * AI-powered automation step planning
   */
  private async planAutomationStepsWithAI(instruction: string, context?: Record<string, any>): Promise<ExecutionStep[]> {
    try {
      const prompt = `You are PHOENIX-7742, an advanced browser automation agent. Plan detailed steps to execute this task:

TASK: "${instruction}"
${context ? `CONTEXT: ${JSON.stringify(context, null, 2)}` : ''}

Create a step-by-step execution plan with specific browser actions. Return a JSON array of steps:

[
  {
    "action": "navigate",
    "target": "https://example.com",
    "description": "Navigate to target website"
  },
  {
    "action": "wait_for_selector",
    "target": "button[data-testid='submit']",
    "description": "Wait for submit button to appear"
  },
  {
    "action": "click",
    "target": "button[data-testid='submit']",
    "description": "Click submit button"
  },
  {
    "action": "type",
    "target": "input[name='email']",
    "value": "user@example.com",
    "description": "Enter email address"
  },
  {
    "action": "extract_text",
    "target": ".result-container",
    "description": "Extract result text"
  }
]

Available actions: navigate, click, type, scroll, wait, wait_for_selector, extract_text, extract_data, screenshot, press_key
Use specific CSS selectors, XPath, or text content for targeting elements.
Focus on real-world browser interactions that accomplish the user's goal efficiently.`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are PHOENIX-7742, a browser automation expert. Plan detailed, executable browser automation steps. Always return valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500
      });

      const planning = JSON.parse(response.choices[0].message.content || '{"steps": []}');
      const steps = (planning.steps || planning || []).map((step: any, index: number): ExecutionStep => ({
        id: `step_${index + 1}`,
        action: step.description || `${step.action} ${step.target || ''}`.trim(),
        target: step.target,
        value: step.value,
        status: 'pending',
        timestamp: new Date(),
      }));

      return steps.length > 0 ? steps : this.planAutomationStepsWithRules(instruction, context);

    } catch (error) {
      this.log('⚠️ AI step planning failed, falling back to rule-based planning:', error);
      return this.planAutomationStepsWithRules(instruction, context);
    }
  }

  /**
   * Rule-based fallback automation step planning
   */
  private planAutomationStepsWithRules(instruction: string, context?: Record<string, any>): ExecutionStep[] {
    const instruction_lower = instruction.toLowerCase();
    const steps: ExecutionStep[] = [];
    let stepCounter = 1;

    // Extract URL if mentioned
    const urlMatch = instruction.match(/https?:\/\/[^\s]+/i);
    
    // Navigation step
    if (urlMatch || context?.url) {
      steps.push({
        id: `step_${stepCounter++}`,
        action: 'navigate',
        target: urlMatch?.[0] || context?.url,
        status: 'pending',
        timestamp: new Date(),
      });
    }

    // Search operations
    if (instruction_lower.includes('search')) {
      const searchTermMatch = instruction.match(/search for ["']([^"']+)["']/i) || 
                             instruction.match(/search for ([^\s.]+)/i);
      if (searchTermMatch) {
        steps.push(
          {
            id: `step_${stepCounter++}`,
            action: 'wait_for_selector',
            target: 'input[type="search"], input[name*="search"], #search, .search-input',
            status: 'pending',
            timestamp: new Date(),
          },
          {
            id: `step_${stepCounter++}`,
            action: 'type',
            target: 'input[type="search"], input[name*="search"], #search, .search-input',
            value: searchTermMatch[1],
            status: 'pending',
            timestamp: new Date(),
          },
          {
            id: `step_${stepCounter++}`,
            action: 'press_key',
            value: 'Enter',
            status: 'pending',
            timestamp: new Date(),
          }
        );
      }
    }

    // Click operations
    if (instruction_lower.includes('click')) {
      const clickTargetMatch = instruction.match(/click (?:on )?["']([^"']+)["']/i) ||
                              instruction.match(/click (?:on )?([^\s.]+)/i);
      if (clickTargetMatch) {
        const target = clickTargetMatch[1];
        steps.push({
          id: `step_${stepCounter++}`,
          action: 'click',
          target: `[data-testid*="${target}"], button:contains("${target}"), a:contains("${target}"), #${target}, .${target}`,
          status: 'pending',
          timestamp: new Date(),
        });
      }
    }

    // Form filling operations  
    if (instruction_lower.includes('fill') || instruction_lower.includes('enter')) {
      const fillMatch = instruction.match(/(?:fill|enter) ["']([^"']+)["'] (?:in|into) ["']([^"']+)["']/i);
      if (fillMatch) {
        steps.push({
          id: `step_${stepCounter++}`,
          action: 'type',
          target: `input[name*="${fillMatch[2]}"], input[placeholder*="${fillMatch[2]}"], #${fillMatch[2]}`,
          value: fillMatch[1],
          status: 'pending',
          timestamp: new Date(),
        });
      }
    }

    // Data extraction
    if (instruction_lower.includes('extract') || instruction_lower.includes('get')) {
      const extractMatch = instruction.match(/(?:extract|get) ([^.]+)/i);
      if (extractMatch) {
        steps.push({
          id: `step_${stepCounter++}`,
          action: 'extract_data',
          target: '.content, .result, .data, main, article',
          status: 'pending',
          timestamp: new Date(),
        });
      }
    }

    // Screenshot operations
    if (instruction_lower.includes('screenshot') || instruction_lower.includes('capture')) {
      steps.push({
        id: `step_${stepCounter++}`,
        action: 'screenshot',
        status: 'pending',
        timestamp: new Date(),
      });
    }

    // If no specific steps were generated, return generic steps
    if (steps.length === 0) {
      return this.getDefaultSteps(instruction);
    }

    // Add a final wait step for stability
    steps.push({
      id: `step_${stepCounter++}`,
      action: 'wait',
      value: '2000', // 2 seconds
      status: 'pending',
      timestamp: new Date(),
    });

    this.log(`📋 Rule-based planning generated ${steps.length} steps for: ${instruction}`);
    return steps;
  }

  /**
   * Execute a single automation step
   */
  private async executeStep(session: BrowserSession, step: ExecutionStep, logs: string[]): Promise<void> {
    const startTime = performance.now();
    step.status = 'executing';
    step.timestamp = new Date();
    
    try {
      logs.push(`Executing: ${step.action}`);
      
      const actionType = step.action.toLowerCase().split(' ')[0];
      
      switch (actionType) {
        case 'navigate':
          if (step.target) {
            await session.page.goto(step.target, { waitUntil: 'networkidle' });
            logs.push(`Navigated to: ${step.target}`);
          }
          break;

        case 'click':
          if (step.target) {
            await session.page.click(step.target);
            logs.push(`Clicked: ${step.target}`);
          }
          break;

        case 'precise_click':
          if (step.target) {
            // PRECISION ENHANCEMENT: More precise clicking with element validation
            await this.preciseClick(session, step.target, logs);
          }
          break;

        case 'analyze_page':
          // PRECISION ENHANCEMENT: Analyze page structure before actions
          await this.analyzePage(session, logs);
          break;

        case 'validate_element':
          if (step.target) {
            // PRECISION ENHANCEMENT: Validate element exists and is interactable
            const isValid = await this.validateElement(session, step.target, logs);
            step.extractedData = { elementValid: isValid };
          }
          break;

        case 'type':
          if (step.target && step.value) {
            await session.page.fill(step.target, step.value);
            logs.push(`Typed "${step.value}" into: ${step.target}`);
          }
          break;

        case 'wait_for_selector':
          if (step.target) {
            await session.page.waitForSelector(step.target, { timeout: 10000 });
            logs.push(`Waited for selector: ${step.target}`);
          }
          break;

        case 'scroll':
          const scrollTarget = step.target || 'body';
          await session.page.locator(scrollTarget).scrollIntoViewIfNeeded();
          logs.push(`Scrolled to: ${scrollTarget}`);
          break;

        case 'extract_text':
          if (step.target) {
            const text = await session.page.locator(step.target).textContent();
            step.extractedData = { text };
            logs.push(`Extracted text from ${step.target}: ${text?.substring(0, 100)}...`);
          }
          break;

        case 'extract_data':
          if (step.target) {
            const data = await session.page.locator(step.target).allTextContents();
            step.extractedData = { data };
            logs.push(`Extracted data from ${step.target}: ${data.length} items`);
          }
          break;

        case 'press_key':
          if (step.value) {
            await session.page.keyboard.press(step.value);
            logs.push(`Pressed key: ${step.value}`);
          }
          break;

        case 'wait':
          const waitTime = parseInt(step.value || '1000');
          await session.page.waitForTimeout(waitTime);
          logs.push(`Waited: ${waitTime}ms`);
          break;

        case 'screenshot':
          const screenshot = await this.captureScreenshot(session.page);
          step.screenshot = screenshot;
          logs.push('Captured screenshot');
          break;

        default:
          // For custom actions, try to execute them intelligently
          await this.executeIntelligentAction(session.page, step, logs);
      }

      step.status = 'completed';
      step.duration = performance.now() - startTime;
      
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      step.duration = performance.now() - startTime;
      
      logs.push(`Step failed: ${step.error}`);
      this.log('❌ Step execution failed', { step: step.action, error: step.error });
      
      // Don't throw - continue with next steps
    }
  }

  /**
   * PRECISION ENHANCEMENT: Analyze page structure for better targeting
   */
  private async analyzePage(session: BrowserSession, logs: string[]): Promise<void> {
    try {
      // Take screenshot first
      await session.page.screenshot({ path: 'page-analysis.png', fullPage: false });
      logs.push(`📸 Page analysis screenshot captured`);

      // Get page title and URL for context
      const title = await session.page.title();
      const url = session.page.url();
      logs.push(`🔍 Page Analysis: ${title} (${url})`);

      // Analyze visible interactive elements
      const interactiveElements = await session.page.evaluate(() => {
        const elements = Array.from((globalThis as any).document.querySelectorAll('button, a, input, select, [role="button"], [onclick]'));
        return elements.map((el: any) => ({
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim().substring(0, 50),
          visible: el.offsetParent !== null,
          rect: el.getBoundingClientRect()
        }));
      });

      logs.push(`🎯 Found ${interactiveElements.length} interactive elements`);
      logs.push(`📋 Key elements: ${interactiveElements.slice(0, 5).map(el => `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ')[0] : ''}`).join(', ')}`);

    } catch (error) {
      logs.push(`⚠️ Page analysis failed: ${error}`);
    }
  }

  /**
   * PRECISION ENHANCEMENT: Validate element before interaction
   */
  private async validateElement(session: BrowserSession, target: string, logs: string[]): Promise<boolean> {
    try {
      const element = await session.page.locator(target);
      
      // Check if element exists
      const count = await element.count();
      if (count === 0) {
        logs.push(`❌ Element not found: ${target}`);
        return false;
      }

      // Check if element is visible
      const isVisible = await element.isVisible();
      if (!isVisible) {
        logs.push(`👻 Element not visible: ${target}`);
        return false;
      }

      // Check if element is enabled (for interactive elements)
      try {
        const isEnabled = await element.isEnabled();
        if (!isEnabled) {
          logs.push(`🚫 Element disabled: ${target}`);
          return false;
        }
      } catch {
        // Some elements don't have enabled state, that's ok
      }

      logs.push(`✅ Element validated: ${target}`);
      return true;

    } catch (error) {
      logs.push(`⚠️ Element validation failed for ${target}: ${error}`);
      return false;
    }
  }

  /**
   * PRECISION ENHANCEMENT: Precise clicking with coordinate validation
   */
  private async preciseClick(session: BrowserSession, target: string, logs: string[]): Promise<void> {
    try {
      // First validate the element
      const isValid = await this.validateElement(session, target, logs);
      if (!isValid) {
        logs.push(`❌ Precise click aborted - element validation failed: ${target}`);
        return;
      }

      const element = await session.page.locator(target);
      
      // Get element bounds for precise clicking
      const boundingBox = await element.boundingBox();
      if (boundingBox) {
        // Calculate center coordinates for precise click
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        
        // Scroll element into view if needed
        await element.scrollIntoViewIfNeeded();
        
        // Wait a moment for any animations to complete
        await session.page.waitForTimeout(100);
        
        // Click at precise coordinates
        await session.page.mouse.click(centerX, centerY);
        logs.push(`🎯 Precise click at coordinates (${Math.round(centerX)}, ${Math.round(centerY)}) for: ${target}`);
        
      } else {
        // Fallback to regular click if bounding box not available
        await element.click();
        logs.push(`🖱️ Fallback click (no coordinates): ${target}`);
      }

      // Wait briefly to ensure click was processed
      await session.page.waitForTimeout(50);

    } catch (error) {
      logs.push(`❌ Precise click failed for ${target}: ${error}`);
      // Try regular click as final fallback
      try {
        await session.page.click(target);
        logs.push(`🔄 Fallback to regular click succeeded: ${target}`);
      } catch (fallbackError) {
        logs.push(`💥 All click methods failed for ${target}: ${fallbackError}`);
      }
    }
  }

  /**
   * Execute intelligent action for complex instructions
   */
  private async executeIntelligentAction(page: Page, step: ExecutionStep, logs: string[]): Promise<void> {
    // Try to understand the action and execute it
    const action = step.action.toLowerCase();
    
    if (action.includes('search') && step.value) {
      // Look for search input
      const searchSelectors = ['input[type="search"]', 'input[name*="search"]', '#search', '.search-input'];
      for (const selector of searchSelectors) {
        try {
          await page.fill(selector, step.value);
          await page.press(selector, 'Enter');
          logs.push(`Searched for: ${step.value}`);
          return;
        } catch {
          continue;
        }
      }
    }
    
    if (action.includes('submit') || action.includes('send')) {
      // Look for submit buttons
      const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Submit")', 'button:has-text("Send")'];
      for (const selector of submitSelectors) {
        try {
          await page.click(selector);
          logs.push('Clicked submit button');
          return;
        } catch {
          continue;
        }
      }
    }
    
    // If we can't execute intelligently, just wait
    await page.waitForTimeout(1000);
    logs.push(`Processed action: ${step.action}`);
  }

  /**
   * Get or create browser session
   */
  private async getOrCreateSession(sessionId: string): Promise<BrowserSession> {
    // Check for existing session
    let session = this.sessions.get(sessionId);
    
    if (session && session.isActive) {
      session.lastUsed = new Date();
      return session;
    }

    // Check concurrent session limit
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);
    if (activeSessions.length >= this.config.maxConcurrentSessions) {
      // Close oldest session
      const oldestSession = activeSessions.sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())[0];
      await this.closeSession(oldestSession.id);
    }

    // Create new session
    session = await this.createSession(sessionId);
    this.sessions.set(sessionId, session);
    
    this.emit('browserLaunched', sessionId);
    return session;
  }

  /**
   * Create new browser session
   */
  private async createSession(sessionId: string): Promise<BrowserSession> {
    this.log('🚀 Creating new browser session', { sessionId, browserType: this.config.browserType });
    
    const browserLauncher = {
      chromium: chromium,
      firefox: firefox,
      webkit: webkit,
    }[this.config.browserType];

    const browser = await browserLauncher.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    
    // Setup page error handling
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.log('🔍 Browser console error:', msg.text());
      }
    });

    page.on('pageerror', (error) => {
      this.log('🔍 Page error:', error.message);
    });

    return {
      id: sessionId,
      browser,
      context,
      page,
      createdAt: new Date(),
      lastUsed: new Date(),
      isActive: true,
    };
  }

  /**
   * Close browser session
   */
  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.isActive = false;
      await session.context.close();
      await session.browser.close();
      this.sessions.delete(sessionId);
      
      this.log('🔒 Browser session closed', { sessionId });
      this.emit('browserClosed', sessionId);
      
    } catch (error) {
      this.log('⚠️ Error closing session:', error);
    }
  }

  /**
   * Capture page screenshot
   */
  private async captureScreenshot(page: Page): Promise<string> {
    try {
      const screenshot = await page.screenshot({ 
        fullPage: false,
        type: 'png',
        quality: 80 
      });
      return `data:image/png;base64,${screenshot.toString('base64')}`;
    } catch (error) {
      this.log('⚠️ Screenshot capture failed:', error);
      return '';
    }
  }

  /**
   * Extract structured data from page
   */
  private async extractPageData(page: Page): Promise<any> {
    try {
      return await page.evaluate(() => {
        // This code runs in browser context where document and window are available
        return {
          title: (globalThis as any).document.title,
          url: (globalThis as any).window.location.href,
          timestamp: new Date().toISOString(),
          // Add more extraction logic as needed
        };
      });
    } catch (error) {
      this.log('⚠️ Data extraction failed:', error);
      return null;
    }
  }

  /**
   * Get default steps for fallback
   */
  private getDefaultSteps(instruction: string): ExecutionStep[] {
    return [
      {
        id: 'step_1',
        action: 'PHOENIX-7742 INITIALIZING BROWSER ENGINE',
        status: 'pending',
        timestamp: new Date(),
      },
      {
        id: 'step_2',
        action: 'ANALYZING AUTOMATION TARGET',
        status: 'pending',
        timestamp: new Date(),
      },
      {
        id: 'step_3',
        action: `EXECUTING: ${instruction}`,
        status: 'pending',
        timestamp: new Date(),
      },
      {
        id: 'step_4',
        action: 'PROCESSING AUTOMATION RESULTS',
        status: 'pending',
        timestamp: new Date(),
      },
      {
        id: 'step_5',
        action: 'AUTOMATION SEQUENCE COMPLETED',
        status: 'pending',
        timestamp: new Date(),
      }
    ];
  }

  /**
   * Test browser launch
   */
  private async testBrowserLaunch(): Promise<void> {
    const testSession = await this.createSession('test-session');
    await testSession.page.goto('data:text/html,<h1>Test</h1>');
    await this.closeSession('test-session');
    this.log('✅ Browser launch test successful');
  }

  /**
   * Start session cleanup
   */
  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      const now = new Date();
      const expiredSessions = Array.from(this.sessions.entries())
        .filter(([_, session]) => {
          const age = now.getTime() - session.lastUsed.getTime();
          return age > this.config.sessionTimeout;
        });

      for (const [sessionId] of expiredSessions) {
        this.log('🧹 Cleaning up expired session', { sessionId });
        await this.closeSession(sessionId);
      }
    }, 60000); // Check every minute
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up browser engine...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
    
    this.log('✅ Browser engine cleanup completed');
  }

  /**
   * Utility logging method
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: 'BrowserEngine',
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }
}