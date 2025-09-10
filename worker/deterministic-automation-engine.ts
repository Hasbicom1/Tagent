/**
 * PHOENIX-7742 Deterministic Browser Automation Engine
 * 
 * Production-grade browser automation with state machine control,
 * multi-strategy element targeting, bounded retries, and comprehensive failure taxonomy.
 * 
 * This engine provides deterministic execution patterns for reliable browser automation
 * in production environments where precision and predictability are critical.
 */

import { Page, Locator, ElementHandle } from 'playwright';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// ===== STATE MACHINE DEFINITIONS =====

export enum ExecutionState {
  INITIALIZED = 'initialized',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  VALIDATING = 'validating',
  RETRYING = 'retrying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABORTED = 'aborted'
}

export enum StepState {
  PENDING = 'pending',
  PREPARING = 'preparing',
  TARGETING = 'targeting',
  VALIDATING = 'validating',
  EXECUTING = 'executing',
  VERIFYING = 'verifying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface StateTransition {
  from: ExecutionState | StepState;
  to: ExecutionState | StepState;
  condition?: string;
  timestamp: Date;
  duration?: number;
}

// ===== FAILURE TAXONOMY =====

export enum FailureCategory {
  // Element targeting failures
  ELEMENT_NOT_FOUND = 'element_not_found',
  ELEMENT_NOT_VISIBLE = 'element_not_visible',
  ELEMENT_NOT_INTERACTIVE = 'element_not_interactive',
  ELEMENT_STALE = 'element_stale',
  
  // Interaction failures
  INTERACTION_BLOCKED = 'interaction_blocked',
  INTERACTION_TIMEOUT = 'interaction_timeout',
  INVALID_INPUT = 'invalid_input',
  
  // Page state failures
  PAGE_NOT_READY = 'page_not_ready',
  NAVIGATION_FAILED = 'navigation_failed',
  CONTENT_NOT_LOADED = 'content_not_loaded',
  
  // Network failures
  NETWORK_ERROR = 'network_error',
  RESOURCE_TIMEOUT = 'resource_timeout',
  
  // Validation failures
  ASSERTION_FAILED = 'assertion_failed',
  UNEXPECTED_STATE = 'unexpected_state',
  
  // System failures
  BROWSER_CRASH = 'browser_crash',
  MEMORY_EXHAUSTION = 'memory_exhaustion',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface FailureContext {
  category: FailureCategory;
  message: string;
  recoverable: boolean;
  retryable: boolean;
  stackTrace?: string;
  screenshot?: string;
  pageState?: PageSnapshot;
  elementState?: ElementSnapshot;
  networkLogs?: NetworkEvent[];
}

// ===== MULTI-STRATEGY ELEMENT TARGETING =====

export enum TargetingStrategy {
  TEST_ID = 'test_id',           // data-testid attributes
  SEMANTIC_ROLE = 'semantic_role', // ARIA roles and semantic HTML
  TEXT_CONTENT = 'text_content',   // Visible text matching
  CSS_SELECTOR = 'css_selector',   // CSS selectors
  XPATH = 'xpath',               // XPath expressions
  COORDINATE = 'coordinate',     // Absolute coordinates
  RELATIVE_POSITION = 'relative_position', // Relative to other elements
  AI_VISION = 'ai_vision'       // AI-powered visual targeting
}

export interface TargetingResult {
  strategy: TargetingStrategy;
  selector: string;
  confidence: number;
  element?: ElementHandle;
  boundingBox?: { x: number; y: number; width: number; height: number };
  fallbackStrategies?: TargetingStrategy[];
  timing: {
    searchTime: number;
    validationTime: number;
  };
}

// ===== RETRY CONFIGURATION =====

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableFailures: FailureCategory[];
}

// ===== EXECUTION CONTEXT =====

export interface ExecutionContext {
  taskId: string;
  sessionId: string;
  currentState: ExecutionState;
  stateHistory: StateTransition[];
  page: Page;
  retryConfig: RetryConfig;
  timeout: number;
  strictMode: boolean; // Enable aggressive validation
}

export interface PageSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  loadState: string;
  timestamp: Date;
  domElementCount: number;
  visibleElementCount: number;
}

export interface ElementSnapshot {
  tagName: string;
  attributes: Record<string, string>;
  textContent: string;
  isVisible: boolean;
  isEnabled: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  computedStyles: Record<string, string>;
}

export interface NetworkEvent {
  url: string;
  method: string;
  status: number;
  timing: number;
  timestamp: Date;
}

// ===== DETERMINISTIC STEP EXECUTION =====

export interface DeterministicStep {
  id: string;
  action: string;
  target?: string;
  value?: string;
  state: StepState;
  stateHistory: StateTransition[];
  targetingResults: TargetingResult[];
  retryCount: number;
  maxRetries: number;
  timeout: number;
  preconditions: string[];
  postconditions: string[];
  rollbackActions: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: FailureContext;
  extractedData?: any;
  snapshots: {
    before?: PageSnapshot;
    after?: PageSnapshot;
  };
}

// ===== MAIN DETERMINISTIC AUTOMATION ENGINE =====

export class DeterministicAutomationEngine extends EventEmitter {
  private contexts = new Map<string, ExecutionContext>();
  private elementTargeter: MultiStrategyElementTargeter;
  private failureAnalyzer: FailureAnalyzer;
  private retryOrchestrator: RetryOrchestrator;
  
  constructor() {
    super();
    this.elementTargeter = new MultiStrategyElementTargeter();
    this.failureAnalyzer = new FailureAnalyzer();
    this.retryOrchestrator = new RetryOrchestrator();
  }

  /**
   * Extract canonical action verb from descriptive action strings
   */
  private extractCanonicalAction(action: string): string {
    const actionLower = action.toLowerCase().trim();
    
    // Navigation actions
    if (actionLower.includes('navigate') || actionLower.includes('go to') || actionLower.includes('visit')) {
      return 'navigate';
    }
    
    // Click actions
    if (actionLower.includes('click') || actionLower.includes('press') || actionLower.includes('tap')) {
      return 'click';
    }
    
    // Type/input actions
    if (actionLower.includes('type') || actionLower.includes('enter') || actionLower.includes('input') || actionLower.includes('fill')) {
      return 'type';
    }
    
    // Wait actions
    if (actionLower.includes('wait for') && (actionLower.includes('selector') || actionLower.includes('element'))) {
      return 'wait_for_selector';
    }
    
    if (actionLower.includes('wait')) {
      return 'wait';
    }
    
    // Scroll actions
    if (actionLower.includes('scroll')) {
      return 'scroll';
    }
    
    // Extract/get actions
    if (actionLower.includes('extract') || actionLower.includes('get') || actionLower.includes('retrieve')) {
      if (actionLower.includes('text')) {
        return 'extract_text';
      }
      return 'extract_data';
    }
    
    // Screenshot actions
    if (actionLower.includes('screenshot') || actionLower.includes('capture') || actionLower.includes('image')) {
      return 'screenshot';
    }
    
    // Key press actions
    if (actionLower.includes('press') && (actionLower.includes('key') || actionLower.includes('enter') || actionLower.includes('escape'))) {
      return 'press_key';
    }
    
    // Return first word as fallback (handles cases where action is already canonical)
    return actionLower.split(' ')[0];
  }

  /**
   * Execute a deterministic automation step with comprehensive error handling
   */
  async executeStep(context: ExecutionContext, step: DeterministicStep): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Normalize action to canonical form
      const canonicalAction = this.extractCanonicalAction(step.action);
      step.action = canonicalAction;
      
      // State transition: pending -> preparing
      this.transitionStepState(step, StepState.PREPARING, 'Beginning step preparation');
      
      // Pre-execution validation
      await this.validatePreconditions(context, step);
      
      // Capture before snapshot
      step.snapshots.before = await this.capturePageSnapshot(context.page);
      
      // Multi-strategy element targeting
      await this.performElementTargeting(context, step);
      
      // State transition: preparing -> executing
      this.transitionStepState(step, StepState.EXECUTING, 'Beginning step execution');
      
      // Execute the actual action
      await this.executeAction(context, step);
      
      // State transition: executing -> verifying
      this.transitionStepState(step, StepState.VERIFYING, 'Verifying step completion');
      
      // Post-execution validation
      await this.validatePostconditions(context, step);
      
      // Capture after snapshot
      step.snapshots.after = await this.capturePageSnapshot(context.page);
      
      // State transition: verifying -> completed
      this.transitionStepState(step, StepState.COMPLETED, 'Step completed successfully');
      
      step.completedAt = new Date();
      
      this.emit('stepCompleted', { context, step, duration: performance.now() - startTime });
      
    } catch (error: any) {
      // Comprehensive failure analysis
      const failureContext = await this.failureAnalyzer.analyzeFailure(
        error,
        context,
        step,
        await this.capturePageSnapshot(context.page)
      );
      
      step.error = failureContext;
      
      // Determine if retry is appropriate
      if (this.shouldRetry(step, failureContext)) {
        this.transitionStepState(step, StepState.FAILED, 'Step failed, retry scheduled');
        await this.scheduleRetry(context, step);
      } else {
        this.transitionStepState(step, StepState.FAILED, 'Step failed permanently');
        step.completedAt = new Date();
        this.emit('stepFailed', { context, step, failure: failureContext });
        throw error;
      }
    }
  }

  /**
   * Multi-strategy element targeting with fallback mechanisms
   */
  private async performElementTargeting(context: ExecutionContext, step: DeterministicStep): Promise<void> {
    // Skip targeting for actions that don't need it or when no target provided
    if (!step.target) {
      this.emit('targetingSkipped', { 
        action: step.action, 
        reason: 'No target provided' 
      });
      return;
    }
    
    this.transitionStepState(step, StepState.TARGETING, 'Beginning element targeting');
    
    const strategies = this.elementTargeter.planTargetingStrategies(step.target, step.action);
    
    for (const strategy of strategies) {
      try {
        const result = await this.elementTargeter.executeStrategy(
          context.page, 
          step.target, 
          strategy,
          step.timeout
        );
        
        // Enhanced validation: ensure element handle exists for actions that require it
        const requiresElement = this.actionRequiresElement(step.action);
        
        if (requiresElement && !result.element) {
          // Lower confidence if element handle is missing but required
          result.confidence = Math.min(result.confidence, 0.5);
          continue;
        }
        
        if (result.confidence > 0.8 && (!requiresElement || result.element)) {
          step.targetingResults.push(result);
          this.emit('targetingSuccess', {
            strategy: result.strategy,
            confidence: result.confidence,
            hasElement: !!result.element,
            action: step.action
          });
          return; // Success
        }
        
        // Store result for potential fallback use
        if (result.confidence > 0.5) {
          step.targetingResults.push(result);
        }
        
      } catch (error) {
        // Log strategy failure and continue to next strategy
        this.emit('targetingStrategyFailed', { 
          strategy, 
          target: step.target, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // If we have any results, use the best one
    if (step.targetingResults.length > 0) {
      step.targetingResults.sort((a, b) => b.confidence - a.confidence);
      
      const bestResult = step.targetingResults[0];
      if (bestResult.confidence > 0.5) {
        this.emit('targetingFallback', {
          strategy: bestResult.strategy,
          confidence: bestResult.confidence,
          hasElement: !!bestResult.element
        });
        return; // Use best available result
      }
    }
    
    // If all strategies failed
    throw new Error(`ELEMENT_TARGETING_FAILED: Could not locate element '${step.target}' using any strategy`);
  }

  /**
   * Check if an action requires a valid element handle
   */
  private actionRequiresElement(action: string): boolean {
    const elementRequiringActions = [
      'click', 'precise_click', 'type', 'extract_text', 'extract_data'
    ];
    return elementRequiringActions.includes(action.toLowerCase());
  }

  /**
   * Execute the actual browser action with deterministic behavior
   */
  private async executeAction(context: ExecutionContext, step: DeterministicStep): Promise<void> {
    const { page } = context;
    const { action, target, value } = step;
    
    switch (action.toLowerCase()) {
      case 'navigate':
        if (!target) throw new Error('Navigate action requires target URL');
        await page.goto(target, { 
          waitUntil: 'networkidle',
          timeout: step.timeout 
        });
        break;
        
      case 'click':
      case 'precise_click':
        if (!step.targetingResults.length) throw new Error('No targeting results available for click');
        await this.executePreciseClick(page, step.targetingResults[0]);
        break;
        
      case 'type':
        if (!target || value === undefined) throw new Error('Type action requires target and value');
        const inputElement = await this.getValidatedElement(page, step.targetingResults[0]);
        await inputElement.fill(value);
        break;
        
      case 'wait_for_selector':
        if (!target) throw new Error('Wait action requires target selector');
        await page.waitForSelector(target, { timeout: step.timeout });
        break;
        
      case 'screenshot':
        const screenshot = await page.screenshot({ 
          fullPage: action === 'screenshot_full',
          type: 'png'
        });
        step.extractedData = {
          type: 'screenshot',
          data: screenshot.toString('base64')
        };
        break;
        
      case 'extract_text':
        if (!target) throw new Error('Extract action requires target selector');
        const textElement = await this.getValidatedElement(page, step.targetingResults[0]);
        const extractedText = await textElement.textContent();
        step.extractedData = {
          type: 'text',
          data: extractedText
        };
        break;
        
      case 'extract_data':
        if (!target) throw new Error('Extract data action requires target selector');
        const dataElement = await this.getValidatedElement(page, step.targetingResults[0]);
        const extractedData = await dataElement.textContent();
        step.extractedData = {
          type: 'data',
          data: extractedData
        };
        break;
        
      case 'scroll':
        if (step.targetingResults.length > 0) {
          // Scroll to specific element
          const scrollElement = await this.getValidatedElement(page, step.targetingResults[0]);
          await scrollElement.scrollIntoViewIfNeeded();
        } else if (target) {
          // Scroll using selector
          await page.locator(target).scrollIntoViewIfNeeded();
        } else {
          // Default scroll down
          await page.evaluate(() => (globalThis as any).window.scrollBy(0, 500));
        }
        break;
        
      case 'wait':
        const waitTime = parseInt(value || '1000');
        if (waitTime > 0) {
          await page.waitForTimeout(waitTime);
        }
        break;
        
      case 'press_key':
        if (!value) throw new Error('Press key action requires key value');
        await page.keyboard.press(value);
        break;
        
      default:
        throw new Error(`UNSUPPORTED_ACTION: Action '${action}' is not supported`);
    }
  }

  /**
   * Execute a precise click with coordinate validation
   */
  private async executePreciseClick(page: Page, targetingResult: TargetingResult): Promise<void> {
    if (!targetingResult.element) {
      throw new Error('CLICK_FAILED: No element found for precise click');
    }
    
    const boundingBox = await targetingResult.element.boundingBox();
    if (!boundingBox) {
      throw new Error('CLICK_FAILED: Element has no bounding box');
    }
    
    // Calculate center coordinates
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    
    // Scroll element into view
    await targetingResult.element.scrollIntoViewIfNeeded();
    
    // Wait for any animations to complete
    await page.waitForTimeout(200);
    
    // Execute precise click
    await page.mouse.click(centerX, centerY);
    
    this.emit('preciseClickExecuted', { 
      coordinates: { x: centerX, y: centerY },
      strategy: targetingResult.strategy,
      confidence: targetingResult.confidence
    });
  }

  /**
   * Get validated element from targeting results
   */
  private async getValidatedElement(page: Page, targetingResult: TargetingResult): Promise<ElementHandle> {
    if (!targetingResult.element) {
      throw new Error('ELEMENT_VALIDATION_FAILED: No element available in targeting results');
    }
    
    // Validate element is still attached to DOM
    try {
      await targetingResult.element.isVisible();
      return targetingResult.element;
    } catch (error) {
      throw new Error('ELEMENT_STALE: Element is no longer attached to DOM');
    }
  }

  /**
   * Capture comprehensive page snapshot for debugging
   */
  private async capturePageSnapshot(page: Page): Promise<PageSnapshot> {
    return {
      url: page.url(),
      title: await page.title(),
      viewport: page.viewportSize() || { width: 0, height: 0 },
      loadState: await page.evaluate(() => (globalThis as any).document.readyState),
      timestamp: new Date(),
      domElementCount: await page.evaluate(() => (globalThis as any).document.querySelectorAll('*').length),
      visibleElementCount: await page.evaluate(() => {
        const doc = (globalThis as any).document;
        return Array.from(doc.querySelectorAll('*'))
          .filter((el: any) => el.offsetParent !== null).length;
      })
    };
  }

  /**
   * Validate step preconditions
   */
  private async validatePreconditions(context: ExecutionContext, step: DeterministicStep): Promise<void> {
    for (const precondition of step.preconditions) {
      const isValid = await this.evaluateCondition(context.page, precondition);
      if (!isValid) {
        throw new Error(`PRECONDITION_FAILED: ${precondition}`);
      }
    }
  }

  /**
   * Validate step postconditions
   */
  private async validatePostconditions(context: ExecutionContext, step: DeterministicStep): Promise<void> {
    for (const postcondition of step.postconditions) {
      const isValid = await this.evaluateCondition(context.page, postcondition);
      if (!isValid) {
        throw new Error(`POSTCONDITION_FAILED: ${postcondition}`);
      }
    }
  }

  /**
   * Evaluate a condition against the current page state
   */
  private async evaluateCondition(page: Page, condition: string): Promise<boolean> {
    try {
      // Simple condition evaluation - can be expanded for complex conditions
      if (condition.startsWith('element_exists:')) {
        const selector = condition.replace('element_exists:', '');
        const element = await page.$(selector);
        return element !== null;
      }
      
      if (condition.startsWith('element_visible:')) {
        const selector = condition.replace('element_visible:', '');
        const element = await page.$(selector);
        return element ? await element.isVisible() : false;
      }
      
      if (condition.startsWith('url_contains:')) {
        const urlPart = condition.replace('url_contains:', '');
        return page.url().includes(urlPart);
      }
      
      return true; // Default to true for unknown conditions
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Determine if a step should be retried based on failure analysis
   */
  private shouldRetry(step: DeterministicStep, failure: FailureContext): boolean {
    return step.retryCount < step.maxRetries && 
           failure.retryable && 
           failure.recoverable;
  }

  /**
   * Schedule a retry with exponential backoff
   */
  private async scheduleRetry(context: ExecutionContext, step: DeterministicStep): Promise<void> {
    step.retryCount++;
    
    const delay = this.retryOrchestrator.calculateDelay(
      context.retryConfig,
      step.retryCount
    );
    
    this.emit('retryScheduled', { 
      stepId: step.id, 
      retryCount: step.retryCount, 
      delay 
    });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Execute the retry
    await this.executeStep(context, step);
  }

  /**
   * Transition step state with tracking
   */
  private transitionStepState(step: DeterministicStep, newState: StepState, condition?: string): void {
    const transition: StateTransition = {
      from: step.state,
      to: newState,
      condition,
      timestamp: new Date()
    };
    
    step.stateHistory.push(transition);
    step.state = newState;
    
    this.emit('stateTransition', { step, transition });
  }
}

// ===== SUPPORTING CLASSES =====

/**
 * Multi-strategy element targeting with intelligent fallbacks
 */
class MultiStrategyElementTargeter {
  /**
   * Plan targeting strategies based on target and action
   */
  planTargetingStrategies(target: string, action: string): TargetingStrategy[] {
    const strategies: TargetingStrategy[] = [];
    
    // Prioritize test-id attributes for reliability
    if (target.includes('[data-testid') || target.includes('data-testid')) {
      strategies.push(TargetingStrategy.TEST_ID);
    }
    
    // Use semantic targeting for common actions
    if (['click', 'type', 'select'].includes(action.toLowerCase())) {
      strategies.push(TargetingStrategy.SEMANTIC_ROLE);
    }
    
    // Text-based targeting for user-friendly selectors
    if (target.includes('text=') || /["']/.test(target)) {
      strategies.push(TargetingStrategy.TEXT_CONTENT);
    }
    
    // CSS selector as primary fallback
    strategies.push(TargetingStrategy.CSS_SELECTOR);
    
    // XPath for complex selections
    if (target.startsWith('//') || target.includes('xpath=')) {
      strategies.push(TargetingStrategy.XPATH);
    }
    
    return strategies;
  }

  /**
   * Execute a specific targeting strategy
   */
  async executeStrategy(
    page: Page, 
    target: string, 
    strategy: TargetingStrategy,
    timeout: number = 30000
  ): Promise<TargetingResult> {
    const startTime = performance.now();
    
    let selector = target;
    let element: ElementHandle | null = null;
    
    switch (strategy) {
      case TargetingStrategy.TEST_ID:
        selector = this.buildTestIdSelector(target);
        element = await page.waitForSelector(selector, { timeout, state: 'attached' });
        break;
        
      case TargetingStrategy.SEMANTIC_ROLE:
        selector = this.buildSemanticSelector(target);
        element = await page.waitForSelector(selector, { timeout, state: 'attached' });
        break;
        
      case TargetingStrategy.TEXT_CONTENT:
        selector = this.buildTextContentSelector(target);
        element = await page.waitForSelector(selector, { timeout, state: 'attached' });
        break;
        
      case TargetingStrategy.CSS_SELECTOR:
        element = await page.waitForSelector(target, { timeout, state: 'attached' });
        break;
        
      case TargetingStrategy.XPATH:
        selector = this.buildXPathSelector(target);
        element = await page.waitForSelector(selector, { timeout, state: 'attached' });
        break;
    }
    
    const searchTime = performance.now() - startTime;
    const validationStart = performance.now();
    
    // Validate element if found
    let confidence = 0;
    let boundingBox = null;
    
    if (element) {
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled().catch(() => true);
      boundingBox = await element.boundingBox();
      
      confidence = this.calculateConfidence(element, isVisible, isEnabled, boundingBox);
    } else {
      confidence = this.calculateConfidence(null, false, false, null);
    }
    
    const validationTime = performance.now() - validationStart;
    
    return {
      strategy,
      selector,
      confidence,
      element: element || undefined,
      boundingBox: boundingBox || undefined,
      timing: {
        searchTime,
        validationTime
      }
    };
  }

  private buildTestIdSelector(target: string): string {
    // Extract test-id value from various formats
    if (target.includes('data-testid=')) {
      return target;
    }
    
    const testIdMatch = target.match(/testid[=:]?["']?([^"'\s]+)/i);
    if (testIdMatch) {
      return `[data-testid="${testIdMatch[1]}"]`;
    }
    
    return `[data-testid*="${target}"]`;
  }

  private buildSemanticSelector(target: string): string {
    // Build selector based on semantic meaning
    const lowerTarget = target.toLowerCase();
    
    if (lowerTarget.includes('button') || lowerTarget.includes('click')) {
      return `button, [role="button"], input[type="button"], input[type="submit"]`;
    }
    
    if (lowerTarget.includes('input') || lowerTarget.includes('type')) {
      return `input, textarea, [role="textbox"]`;
    }
    
    if (lowerTarget.includes('link')) {
      return `a, [role="link"]`;
    }
    
    return target;
  }

  private buildTextContentSelector(target: string): string {
    const textMatch = target.match(/text=["']?([^"']+)/i);
    if (textMatch) {
      return `text=${textMatch[1]}`;
    }
    
    return `text=${target}`;
  }

  private buildXPathSelector(target: string): string {
    if (target.startsWith('//')) {
      return target;
    }
    
    if (target.startsWith('xpath=')) {
      return target.replace('xpath=', '');
    }
    
    return `//*[contains(text(), "${target}")]`;
  }

  private calculateConfidence(
    element: ElementHandle | null,
    isVisible: boolean,
    isEnabled: boolean,
    boundingBox: any
  ): number {
    // Element handle is required for high confidence
    if (!element) {
      return 0.2; // Very low confidence without element handle
    }
    
    let confidence = 0.6; // Base confidence when element exists
    
    if (isVisible) confidence += 0.3;
    if (isEnabled) confidence += 0.1;
    if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}

/**
 * Comprehensive failure analysis and categorization
 */
class FailureAnalyzer {
  async analyzeFailure(
    error: Error,
    context: ExecutionContext,
    step: DeterministicStep,
    pageSnapshot: PageSnapshot
  ): Promise<FailureContext> {
    const category = this.categorizeFailure(error);
    const isRecoverable = this.isRecoverable(category);
    const isRetryable = this.isRetryable(category);
    
    return {
      category,
      message: error.message,
      recoverable: isRecoverable,
      retryable: isRetryable,
      stackTrace: error.stack,
      pageState: pageSnapshot
    };
  }

  private categorizeFailure(error: Error): FailureCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('element not found') || message.includes('no such element')) {
      return FailureCategory.ELEMENT_NOT_FOUND;
    }
    
    if (message.includes('not visible') || message.includes('hidden')) {
      return FailureCategory.ELEMENT_NOT_VISIBLE;
    }
    
    if (message.includes('not clickable') || message.includes('not enabled')) {
      return FailureCategory.ELEMENT_NOT_INTERACTIVE;
    }
    
    if (message.includes('stale') || message.includes('detached')) {
      return FailureCategory.ELEMENT_STALE;
    }
    
    if (message.includes('timeout')) {
      return FailureCategory.INTERACTION_TIMEOUT;
    }
    
    if (message.includes('navigation') || message.includes('goto')) {
      return FailureCategory.NAVIGATION_FAILED;
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return FailureCategory.NETWORK_ERROR;
    }
    
    return FailureCategory.UNKNOWN_ERROR;
  }

  private isRecoverable(category: FailureCategory): boolean {
    const recoverableFailures = [
      FailureCategory.ELEMENT_NOT_VISIBLE,
      FailureCategory.ELEMENT_NOT_INTERACTIVE,
      FailureCategory.PAGE_NOT_READY,
      FailureCategory.CONTENT_NOT_LOADED,
      FailureCategory.NETWORK_ERROR,
      FailureCategory.RESOURCE_TIMEOUT
    ];
    
    return recoverableFailures.includes(category);
  }

  private isRetryable(category: FailureCategory): boolean {
    const nonRetryableFailures = [
      FailureCategory.ELEMENT_NOT_FOUND,
      FailureCategory.INVALID_INPUT,
      FailureCategory.ASSERTION_FAILED,
      FailureCategory.BROWSER_CRASH,
      FailureCategory.MEMORY_EXHAUSTION
    ];
    
    return !nonRetryableFailures.includes(category);
  }
}

/**
 * Sophisticated retry orchestration with exponential backoff
 */
class RetryOrchestrator {
  calculateDelay(config: RetryConfig, retryCount: number): number {
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, retryCount - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter if enabled
    if (config.jitterEnabled) {
      const jitter = delay * 0.1 * Math.random();
      delay += jitter;
    }
    
    return Math.floor(delay);
  }
}