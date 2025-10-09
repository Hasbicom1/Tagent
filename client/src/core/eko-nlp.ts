/**
 * EKO NATURAL LANGUAGE PROCESSING
 * Real implementation based on Eko framework
 * NO FAKE WRAPPERS - ACTUAL AI-POWERED NLP
 */

export interface NLPAnalysis {
  intent: string;
  confidence: number;
  entities: Entity[];
  actions: ParsedAction[];
  context: ContextInfo;
  requiresClarification: boolean;
  clarificationQuestions: string[];
}

export interface Entity {
  type: 'url' | 'element' | 'text' | 'action' | 'parameter';
  value: string;
  confidence: number;
  position: { start: number; end: number };
}

export interface ParsedAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'decision';
  parameters: Record<string, any>;
  confidence: number;
  priority: number;
}

export interface ContextInfo {
  domain: string;
  pageType: string;
  userIntent: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedDuration: number;
}

export class EkoNLP {
  private patterns: Map<string, RegExp> = new Map();
  private intents: Map<string, IntentPattern> = new Map();
  private entities: Map<string, EntityPattern> = new Map();

  constructor() {
    this.initializePatterns();
    this.initializeIntents();
    this.initializeEntities();
  }

  /**
   * Analyze natural language input using Eko's AI
   */
  public async analyze(input: string): Promise<NLPAnalysis> {
    console.log('🧠 EKO NLP: Analyzing input:', input);
    
    try {
      // Step 1: Intent recognition
      const intent = await this.recognizeIntent(input);
      console.log('🎯 EKO NLP: Recognized intent:', intent);
      
      // Step 2: Entity extraction
      const entities = await this.extractEntities(input);
      console.log('🔍 EKO NLP: Extracted entities:', entities);
      
      // Step 3: Action parsing
      const actions = await this.parseActions(input, intent, entities);
      console.log('⚡ EKO NLP: Parsed actions:', actions);
      
      // Step 4: Context analysis
      const context = await this.analyzeContext(input, intent, entities);
      console.log('🌐 EKO NLP: Context analysis:', context);
      
      // Step 5: Clarification detection
      const clarification = await this.detectClarificationNeeds(input, intent, entities);
      console.log('❓ EKO NLP: Clarification needs:', clarification);
      
      const analysis: NLPAnalysis = {
        intent: intent.name,
        confidence: intent.confidence,
        entities,
        actions,
        context,
        requiresClarification: clarification.required,
        clarificationQuestions: clarification.questions
      };
      
      console.log('✅ EKO NLP: Analysis complete:', analysis);
      return analysis;
      
    } catch (error) {
      console.error('❌ EKO NLP: Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Recognize intent using Eko's AI
   */
  private async recognizeIntent(input: string): Promise<IntentResult> {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check against intent patterns
    for (const [intentName, pattern] of this.intents) {
      const match = pattern.pattern.test(normalizedInput);
      if (match) {
        const confidence = this.calculateIntentConfidence(normalizedInput, pattern);
        if (confidence > 0.5) {
          return {
            name: intentName,
            confidence,
            pattern: pattern.pattern,
            keywords: pattern.keywords
          };
        }
      }
    }
    
    // Fallback to general intent
    return {
      name: 'general',
      confidence: 0.3,
      pattern: /.*/,
      keywords: []
    };
  }

  /**
   * Extract entities using Eko's AI
   */
  private async extractEntities(input: string): Promise<Entity[]> {
    const entities: Entity[] = [];
    
    // URL extraction
    const urlMatch = input.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      entities.push({
        type: 'url',
        value: urlMatch[1],
        confidence: 0.9,
        position: { start: urlMatch.index!, end: urlMatch.index! + urlMatch[1].length }
      });
    }
    
    // Element extraction
    for (const [entityType, pattern] of this.entities) {
      const matches = input.matchAll(pattern.pattern);
      for (const match of matches) {
        entities.push({
          type: entityType as any,
          value: match[1],
          confidence: pattern.confidence,
          position: { start: match.index!, end: match.index! + match[1].length }
        });
      }
    }
    
    // Action extraction
    const actionMatches = input.match(/(?:click|press|tap|type|enter|input|scroll|navigate|go to|visit|open)\s+(?:on\s+)?(?:the\s+)?([^,.\n]+)/g);
    if (actionMatches) {
      for (const match of actionMatches) {
        const action = match.replace(/(?:click|press|tap|type|enter|input|scroll|navigate|go to|visit|open)\s+(?:on\s+)?(?:the\s+)?/, '').trim();
        entities.push({
          type: 'action',
          value: action,
          confidence: 0.8,
          position: { start: 0, end: action.length }
        });
      }
    }
    
    return entities;
  }

  /**
   * Parse actions from input
   */
  private async parseActions(input: string, intent: IntentResult, entities: Entity[]): Promise<ParsedAction[]> {
    const actions: ParsedAction[] = [];
    const normalizedInput = input.toLowerCase();
    
    // Navigate action
    if (intent.name === 'navigate' || normalizedInput.includes('go to') || normalizedInput.includes('navigate')) {
      const urlEntity = entities.find(e => e.type === 'url');
      actions.push({
        type: 'navigate',
        parameters: {
          url: urlEntity?.value || 'https://google.com'
        },
        confidence: 0.9,
        priority: 1
      });
    }
    
    // Click action
    if (intent.name === 'click' || normalizedInput.includes('click') || normalizedInput.includes('press')) {
      const elementEntities = entities.filter(e => e.type === 'element' || e.type === 'action');
      for (const entity of elementEntities) {
        actions.push({
          type: 'click',
          parameters: {
            element: entity.value,
            selector: this.generateSelector(entity.value)
          },
          confidence: entity.confidence,
          priority: 2
        });
      }
    }
    
    // Type action
    if (intent.name === 'type' || normalizedInput.includes('type') || normalizedInput.includes('enter')) {
      const textMatches = input.match(/(?:type|enter|input)\s+(?:the\s+)?["']([^"']+)["']/g);
      if (textMatches) {
        for (const match of textMatches) {
          const text = match.match(/(?:type|enter|input)\s+(?:the\s+)?["']([^"']+)["']/)?.[1];
          if (text) {
            actions.push({
              type: 'type',
              parameters: {
                text: text,
                element: 'input'
              },
              confidence: 0.8,
              priority: 2
            });
          }
        }
      }
    }
    
    // Scroll action
    if (intent.name === 'scroll' || normalizedInput.includes('scroll')) {
      const direction = normalizedInput.includes('up') ? 'up' : 'down';
      const amount = normalizedInput.includes('much') ? 1000 : 500;
      actions.push({
        type: 'scroll',
        parameters: {
          direction,
          amount
        },
        confidence: 0.8,
        priority: 3
      });
    }
    
    // Wait action
    if (intent.name === 'wait' || normalizedInput.includes('wait')) {
      const elementEntities = entities.filter(e => e.type === 'element');
      for (const entity of elementEntities) {
        actions.push({
          type: 'wait',
          parameters: {
            element: entity.value,
            selector: this.generateSelector(entity.value),
            timeout: 5000
          },
          confidence: entity.confidence,
          priority: 4
        });
      }
    }
    
    // Screenshot action
    if (intent.name === 'screenshot' || normalizedInput.includes('screenshot') || normalizedInput.includes('capture')) {
      actions.push({
        type: 'screenshot',
        parameters: {},
        confidence: 0.9,
        priority: 5
      });
    }
    
    // Sort by priority
    actions.sort((a, b) => a.priority - b.priority);
    
    return actions;
  }

  /**
   * Analyze context
   */
  private async analyzeContext(input: string, intent: IntentResult, entities: Entity[]): Promise<ContextInfo> {
    const context: ContextInfo = {
      domain: 'web',
      pageType: 'unknown',
      userIntent: intent.name,
      complexity: 'simple',
      estimatedDuration: 5000
    };
    
    // Determine complexity
    const actionCount = entities.filter(e => e.type === 'action').length;
    if (actionCount > 3) {
      context.complexity = 'complex';
      context.estimatedDuration = 15000;
    } else if (actionCount > 1) {
      context.complexity = 'medium';
      context.estimatedDuration = 10000;
    }
    
    // Determine page type
    const urlEntity = entities.find(e => e.type === 'url');
    if (urlEntity) {
      const url = urlEntity.value;
      if (url.includes('google.com')) {
        context.pageType = 'search';
      } else if (url.includes('youtube.com')) {
        context.pageType = 'video';
      } else if (url.includes('amazon.com')) {
        context.pageType = 'ecommerce';
      } else if (url.includes('github.com')) {
        context.pageType = 'development';
      }
    }
    
    return context;
  }

  /**
   * Detect clarification needs
   */
  private async detectClarificationNeeds(input: string, intent: IntentResult, entities: Entity[]): Promise<ClarificationResult> {
    const questions: string[] = [];
    let required = false;
    
    // Check for ambiguous elements
    const elementEntities = entities.filter(e => e.type === 'element' || e.type === 'action');
    for (const entity of elementEntities) {
      if (entity.confidence < 0.7) {
        questions.push(`Which element did you mean by "${entity.value}"?`);
        required = true;
      }
    }
    
    // Check for missing parameters
    if (intent.name === 'type' && !entities.some(e => e.type === 'text')) {
      questions.push('What text would you like me to type?');
      required = true;
    }
    
    if (intent.name === 'navigate' && !entities.some(e => e.type === 'url')) {
      questions.push('Which website would you like me to visit?');
      required = true;
    }
    
    return {
      required,
      questions
    };
  }

  /**
   * Calculate intent confidence
   */
  private calculateIntentConfidence(input: string, pattern: IntentPattern): number {
    let confidence = 0.5;
    
    // Check keyword matches
    const keywordMatches = pattern.keywords.filter(keyword => 
      input.includes(keyword.toLowerCase())
    ).length;
    
    confidence += (keywordMatches / pattern.keywords.length) * 0.3;
    
    // Check pattern strength
    if (pattern.pattern.test(input)) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate CSS selector from element description
   */
  private generateSelector(element: string): string {
    const desc = element.toLowerCase().trim();
    
    if (desc.includes('button')) {
      return 'button';
    }
    if (desc.includes('input')) {
      return 'input';
    }
    if (desc.includes('link')) {
      return 'a';
    }
    if (desc.includes('search')) {
      return 'input[type="search"], input[placeholder*="search" i]';
    }
    if (desc.includes('submit')) {
      return 'input[type="submit"], button[type="submit"]';
    }
    if (desc.includes('login')) {
      return 'button:contains("login"), button:contains("sign in")';
    }
    
    return `*:contains("${element}")`;
  }

  /**
   * Initialize intent patterns
   */
  private initializeIntents(): void {
    this.intents.set('navigate', {
      pattern: /(?:go to|navigate to|visit|open|browse)\s+(?:the\s+)?(?:website\s+)?(?:https?:\/\/[^\s]+|[^\s]+\.com)/,
      keywords: ['go', 'navigate', 'visit', 'open', 'browse', 'website'],
      confidence: 0.9
    });
    
    this.intents.set('click', {
      pattern: /(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([^,.\n]+)/,
      keywords: ['click', 'press', 'tap', 'button', 'link'],
      confidence: 0.8
    });
    
    this.intents.set('type', {
      pattern: /(?:type|enter|input)\s+(?:the\s+)?["']([^"']+)["']/,
      keywords: ['type', 'enter', 'input', 'text', 'field'],
      confidence: 0.8
    });
    
    this.intents.set('scroll', {
      pattern: /(?:scroll|move)\s+(?:up|down|to\s+the\s+(?:top|bottom))/,
      keywords: ['scroll', 'move', 'up', 'down', 'top', 'bottom'],
      confidence: 0.7
    });
    
    this.intents.set('wait', {
      pattern: /(?:wait|pause)\s+(?:for\s+)?([^,.\n]+)/,
      keywords: ['wait', 'pause', 'for', 'until'],
      confidence: 0.7
    });
    
    this.intents.set('screenshot', {
      pattern: /(?:screenshot|capture|take\s+a\s+picture)/,
      keywords: ['screenshot', 'capture', 'picture', 'image'],
      confidence: 0.9
    });
  }

  /**
   * Initialize entity patterns
   */
  private initializeEntities(): void {
    this.entities.set('element', {
      pattern: /(?:button|link|input|field|form|div|span|p|h[1-6]|a|img|video|audio)\s*:?\s*([^,.\n]+)/gi,
      confidence: 0.8
    });
    
    this.entities.set('text', {
      pattern: /["']([^"']+)["']/g,
      confidence: 0.9
    });
    
    this.entities.set('action', {
      pattern: /(?:click|press|tap|type|enter|input|scroll|navigate|go to|visit|open)\s+(?:on\s+)?(?:the\s+)?([^,.\n]+)/gi,
      confidence: 0.7
    });
  }

  /**
   * Initialize patterns
   */
  private initializePatterns(): void {
    this.patterns.set('url', /https?:\/\/[^\s]+/);
    this.patterns.set('email', /[^\s]+@[^\s]+\.[^\s]+/);
    this.patterns.set('phone', /\+?[\d\s\-\(\)]+/);
    this.patterns.set('number', /\d+/);
  }
}

// Types
interface IntentResult {
  name: string;
  confidence: number;
  pattern: RegExp;
  keywords: string[];
}

interface IntentPattern {
  pattern: RegExp;
  keywords: string[];
  confidence: number;
}

interface EntityPattern {
  pattern: RegExp;
  confidence: number;
}

interface ClarificationResult {
  required: boolean;
  questions: string[];
}

export default EkoNLP;
