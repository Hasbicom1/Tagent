/**
 * RULE-BASED PLANNER AGENT
 * 
 * Intelligent task planning using rule-based AI without external APIs
 * No API keys required - works entirely locally with smart rules
 */

import { AgentTask, AgentResult, AgentAction } from './free-agent-registry';
import { logger } from '../logger';

export class RuleBasedPlannerAgent {
  private rules: Map<string, any> = new Map();
  private patterns: Map<string, RegExp> = new Map();

  constructor() {
    this.initializeRules();
    this.initializePatterns();
  }

  /**
   * Initialize planning rules
   */
  private initializeRules(): void {
    // Navigation rules
    this.rules.set('navigate', {
      keywords: ['go to', 'navigate', 'visit', 'open', 'browse'],
      actions: ['navigate'],
      priority: 1
    });

    // Form filling rules
    this.rules.set('form_fill', {
      keywords: ['fill', 'form', 'input', 'enter', 'type', 'submit'],
      actions: ['type', 'click'],
      priority: 2
    });

    // Clicking rules
    this.rules.set('click', {
      keywords: ['click', 'press', 'tap', 'select', 'choose'],
      actions: ['click'],
      priority: 3
    });

    // Data extraction rules
    this.rules.set('extract', {
      keywords: ['extract', 'scrape', 'get', 'collect', 'gather', 'data'],
      actions: ['extract', 'screenshot'],
      priority: 4
    });

    // Scrolling rules
    this.rules.set('scroll', {
      keywords: ['scroll', 'down', 'up', 'move', 'browse'],
      actions: ['scroll'],
      priority: 5
    });

    // Waiting rules
    this.rules.set('wait', {
      keywords: ['wait', 'pause', 'delay', 'load', 'timeout'],
      actions: ['wait'],
      priority: 6
    });

    logger.info('📋 Rule-Based Planner: Initialized with 6 rule categories');
  }

  /**
   * Initialize pattern matching
   */
  private initializePatterns(): void {
    // URL patterns
    this.patterns.set('url', /https?:\/\/[^\s]+/gi);
    
    // Email patterns
    this.patterns.set('email', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi);
    
    // Phone patterns
    this.patterns.set('phone', /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/gi);
    
    // Form field patterns
    this.patterns.set('form_field', /(input|field|box|text|area)\s+([a-zA-Z0-9\s]+)/gi);
    
    // Button patterns
    this.patterns.set('button', /(button|btn|link|click)\s+([a-zA-Z0-9\s]+)/gi);
    
    // Number patterns
    this.patterns.set('number', /\d+/g);
    
    logger.info('🔍 Rule-Based Planner: Initialized with 6 pattern matchers');
  }

  /**
   * Execute rule-based planning task
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      logger.info('🎯 Rule-Based Planner: Executing task', {
        taskId: task.id,
        instruction: task.instruction
      });

      // Step 1: Analyze instruction
      const analysis = this.analyzeInstruction(task.instruction);
      
      // Step 2: Generate action plan
      const actions = this.generateActionPlan(analysis, task.context);
      
      // Step 3: Optimize plan
      const optimizedActions = this.optimizePlan(actions);
      
      // Step 4: Execute plan (simulation for now)
      const executionResults = await this.executePlan(optimizedActions);
      
      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Rule-Based Planner: Task completed', {
        taskId: task.id,
        executionTime: `${executionTime}ms`,
        actionsCount: optimizedActions.length
      });

      return {
        success: true,
        taskId: task.id,
        agentId: 'rule-based-planner',
        actions: optimizedActions,
        confidence: 0.85,
        executionTime,
        metadata: {
          analysis,
          executionResults
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('❌ Rule-Based Planner: Task failed', {
        taskId: task.id,
        error: errorMessage,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        taskId: task.id,
        agentId: 'rule-based-planner',
        actions: [],
        confidence: 0,
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Analyze instruction using rules and patterns
   */
  private analyzeInstruction(instruction: string): any {
    const analysis = {
      original: instruction,
      keywords: [] as string[],
      patterns: {} as Record<string, string[]>,
      rules: [] as string[],
      entities: {} as Record<string, any>,
      complexity: 'simple'
    };

    const instructionLower = instruction.toLowerCase();

    // Extract keywords
    for (const [ruleName, rule] of this.rules) {
      for (const keyword of rule.keywords) {
        if (instructionLower.includes(keyword)) {
          analysis.keywords.push(keyword);
          analysis.rules.push(ruleName);
        }
      }
    }

    // Extract patterns
    for (const [patternName, pattern] of this.patterns) {
      const matches = instruction.match(pattern);
      if (matches) {
        analysis.patterns[patternName] = matches;
      }
    }

    // Extract entities
    analysis.entities.urls = analysis.patterns.url || [];
    analysis.entities.emails = analysis.patterns.email || [];
    analysis.entities.phones = analysis.patterns.phone || [];
    analysis.entities.numbers = analysis.patterns.number || [];

    // Determine complexity
    const ruleCount = new Set(analysis.rules).size;
    const patternCount = Object.keys(analysis.patterns).length;
    
    if (ruleCount > 3 || patternCount > 2) {
      analysis.complexity = 'complex';
    } else if (ruleCount > 1 || patternCount > 1) {
      analysis.complexity = 'medium';
    }

    return analysis;
  }

  /**
   * Generate action plan based on analysis
   */
  private generateActionPlan(analysis: any, context?: Record<string, any>): AgentAction[] {
    const actions: AgentAction[] = [];
    const rules = analysis.rules;

    // Navigation actions
    if (rules.includes('navigate')) {
      if (analysis.entities.urls.length > 0) {
        actions.push({
          type: 'navigate',
          url: analysis.entities.urls[0],
          confidence: 0.9,
          reasoning: 'Navigate to detected URL'
        });
      } else if (context?.url) {
        actions.push({
          type: 'navigate',
          url: context.url,
          confidence: 0.8,
          reasoning: 'Navigate to context URL'
        });
      }
    }

    // Form filling actions
    if (rules.includes('form_fill')) {
      const formFields = this.generateFormFields(analysis);
      for (const field of formFields) {
        actions.push(field);
      }
    }

    // Clicking actions
    if (rules.includes('click')) {
      const clickActions = this.generateClickActions(analysis);
      for (const action of clickActions) {
        actions.push(action);
      }
    }

    // Data extraction actions
    if (rules.includes('extract')) {
      actions.push({
        type: 'extract',
        confidence: 0.8,
        reasoning: 'Extract data from page'
      });
      
      actions.push({
        type: 'screenshot',
        confidence: 0.7,
        reasoning: 'Capture screenshot for data extraction'
      });
    }

    // Scrolling actions
    if (rules.includes('scroll')) {
      actions.push({
        type: 'scroll',
        confidence: 0.8,
        reasoning: 'Scroll to see more content'
      });
    }

    // Waiting actions
    if (rules.includes('wait')) {
      actions.push({
        type: 'wait',
        duration: 2000,
        confidence: 0.7,
        reasoning: 'Wait for page to load'
      });
    }

    return actions;
  }

  /**
   * Generate form field actions
   */
  private generateFormFields(analysis: any): AgentAction[] {
    const actions: AgentAction[] = [];
    const emails = analysis.entities.emails;
    const phones = analysis.entities.phones;

    // Common form fields
    const commonFields = [
      { selector: 'input[name="email"], input[type="email"]', value: emails[0] || 'test@example.com', type: 'email' },
      { selector: 'input[name="password"], input[type="password"]', value: 'testpassword123', type: 'password' },
      { selector: 'input[name="name"], input[name="fullname"]', value: 'Test User', type: 'text' },
      { selector: 'input[name="phone"], input[type="tel"]', value: phones[0] || '123-456-7890', type: 'tel' },
      { selector: 'input[name="address"]', value: '123 Test Street', type: 'text' }
    ];

    for (const field of commonFields) {
      actions.push({
        type: 'type',
        selector: field.selector,
        text: field.value,
        confidence: 0.8,
        reasoning: `Fill ${field.type} field`
      });
    }

    return actions;
  }

  /**
   * Generate click actions
   */
  private generateClickActions(analysis: any): AgentAction[] {
    const actions: AgentAction[] = [];

    // Common button selectors
    const buttonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Submit")',
      'button:contains("Send")',
      'button:contains("Continue")',
      'button:contains("Next")',
      'a:contains("Login")',
      'a:contains("Sign in")'
    ];

    for (const selector of buttonSelectors) {
      actions.push({
        type: 'click',
        selector,
        confidence: 0.7,
        reasoning: `Click ${selector}`
      });
    }

    return actions;
  }

  /**
   * Optimize action plan
   */
  private optimizePlan(actions: AgentAction[]): AgentAction[] {
    const optimized: AgentAction[] = [];
    const seen = new Set<string>();

    for (const action of actions) {
      const key = `${action.type}-${action.selector || action.url || ''}`;
      
      if (!seen.has(key)) {
        optimized.push(action);
        seen.add(key);
      }
    }

    // Sort by confidence (highest first)
    return optimized.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Execute action plan (simulation)
   */
  private async executePlan(actions: AgentAction[]): Promise<any[]> {
    const results: any[] = [];

    for (const action of actions) {
      try {
        // Simulate execution delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        results.push({
          action: action.type,
          success: true,
          confidence: action.confidence,
          reasoning: action.reasoning
        });
      } catch (error) {
        results.push({
          action: action.type,
          success: false,
          error: error instanceof Error ? error.message : 'unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): any {
    return {
      name: 'Rule-Based Planner',
      id: 'rule-based-planner',
      description: 'Intelligent task planning using rule-based AI',
      strengths: [
        'task decomposition',
        'step planning',
        'workflow optimization',
        'error handling',
        'pattern recognition',
        'entity extraction'
      ],
      rules: Array.from(this.rules.keys()),
      patterns: Array.from(this.patterns.keys()),
      isLocal: true,
      requiresSetup: false
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test rule matching
      const testInstruction = 'go to https://example.com and fill the form';
      const analysis = this.analyzeInstruction(testInstruction);
      
      return analysis.rules.length > 0 && analysis.patterns.url !== undefined;
    } catch (error) {
      return false;
    }
  }
}

export default RuleBasedPlannerAgent;
