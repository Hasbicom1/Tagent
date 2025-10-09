/**
 * ONEDOLLARAGENT NLP
 * Natural Language Processing for OneDollarAgent framework
 * Analyzes user input to determine if browser automation is needed
 */

export interface NLPAnalysis {
  intent: string;
  confidence: number;
  requiresBrowserAutomation: boolean;
  requiresClarification: boolean;
  clarificationQuestions: string[];
  entities: string[];
  action: 'navigate' | 'search' | 'click' | 'type' | 'scroll' | 'screenshot' | 'chat' | 'unknown';
  target?: string;
  parameters?: Record<string, any>;
}

export class OneDollarAgentNLP {
  private browserKeywords = [
    'navigate', 'go to', 'visit', 'open', 'browse',
    'search', 'find', 'look for', 'google',
    'click', 'tap', 'press', 'select',
    'type', 'enter', 'input', 'write',
    'scroll', 'scroll down', 'scroll up',
    'screenshot', 'capture', 'take picture',
    'website', 'page', 'site', 'url'
  ];

  private navigationKeywords = [
    'navigate', 'go to', 'visit', 'open', 'browse', 'url'
  ];

  private searchKeywords = [
    'search', 'find', 'look for', 'google', 'query'
  ];

  private interactionKeywords = [
    'click', 'tap', 'press', 'select', 'button', 'link'
  ];

  private inputKeywords = [
    'type', 'enter', 'input', 'write', 'fill'
  ];

  private scrollKeywords = [
    'scroll', 'scroll down', 'scroll up', 'move down', 'move up'
  ];

  private screenshotKeywords = [
    'screenshot', 'capture', 'take picture', 'snap'
  ];

  /**
   * Analyze user input to determine intent and required actions
   */
  public async analyze(input: string): Promise<NLPAnalysis> {
    const lowerInput = input.toLowerCase();
    
    // Check for browser automation keywords
    const hasBrowserKeywords = this.browserKeywords.some(keyword => 
      lowerInput.includes(keyword)
    );

    if (!hasBrowserKeywords) {
      return {
        intent: 'general chat',
        confidence: 0.9,
        requiresBrowserAutomation: false,
        requiresClarification: false,
        clarificationQuestions: [],
        entities: [],
        action: 'chat'
      };
    }

    // Determine specific action
    let action: NLPAnalysis['action'] = 'unknown';
    let target: string | undefined;
    let confidence = 0.7;

    if (this.navigationKeywords.some(keyword => lowerInput.includes(keyword))) {
      action = 'navigate';
      target = this.extractUrl(input);
      confidence = 0.9;
    } else if (this.searchKeywords.some(keyword => lowerInput.includes(keyword))) {
      action = 'search';
      target = this.extractSearchQuery(input);
      confidence = 0.9;
    } else if (this.interactionKeywords.some(keyword => lowerInput.includes(keyword))) {
      action = 'click';
      target = this.extractElement(input);
      confidence = 0.8;
    } else if (this.inputKeywords.some(keyword => lowerInput.includes(keyword))) {
      action = 'type';
      target = this.extractText(input);
      confidence = 0.8;
    } else if (this.scrollKeywords.some(keyword => lowerInput.includes(keyword))) {
      action = 'scroll';
      confidence = 0.9;
    } else if (this.screenshotKeywords.some(keyword => lowerInput.includes(keyword))) {
      action = 'screenshot';
      confidence = 0.9;
    }

    // Check if clarification is needed
    const requiresClarification = this.needsClarification(input, action, target);
    const clarificationQuestions = requiresClarification 
      ? this.generateClarificationQuestions(action, target)
      : [];

    return {
      intent: this.generateIntent(action, target),
      confidence,
      requiresBrowserAutomation: true,
      requiresClarification,
      clarificationQuestions,
      entities: this.extractEntities(input),
      action,
      target,
      parameters: this.extractParameters(input, action)
    };
  }

  private extractUrl(input: string): string | undefined {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = input.match(urlRegex);
    if (match) return match[0];

    // Check for common domains
    const domainRegex = /(?:go to|visit|open|navigate to)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const domainMatch = input.match(domainRegex);
    if (domainMatch) {
      const domain = domainMatch[1];
      return domain.startsWith('http') ? domain : `https://${domain}`;
    }

    return undefined;
  }

  private extractSearchQuery(input: string): string | undefined {
    const searchRegex = /(?:search|find|look for|google)\s+(?:for\s+)?(.+)/i;
    const match = input.match(searchRegex);
    return match ? match[1].trim() : undefined;
  }

  private extractElement(input: string): string | undefined {
    const elementRegex = /(?:click|tap|press|select)\s+(?:on\s+)?(.+)/i;
    const match = input.match(elementRegex);
    return match ? match[1].trim() : undefined;
  }

  private extractText(input: string): string | undefined {
    const textRegex = /(?:type|enter|input|write)\s+(?:the\s+)?(.+)/i;
    const match = input.match(textRegex);
    return match ? match[1].trim() : undefined;
  }

  private extractEntities(input: string): string[] {
    const entities: string[] = [];
    
    // Extract URLs
    const urls = input.match(/(https?:\/\/[^\s]+)/g);
    if (urls) entities.push(...urls);

    // Extract email addresses
    const emails = input.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emails) entities.push(...emails);

    // Extract phone numbers
    const phones = input.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    if (phones) entities.push(...phones);

    return entities;
  }

  private extractParameters(input: string, action: string): Record<string, any> {
    const parameters: Record<string, any> = {};

    switch (action) {
      case 'navigate':
        parameters.url = this.extractUrl(input);
        break;
      case 'search':
        parameters.query = this.extractSearchQuery(input);
        break;
      case 'click':
        parameters.element = this.extractElement(input);
        break;
      case 'type':
        parameters.text = this.extractText(input);
        break;
      case 'scroll':
        const scrollDirection = input.toLowerCase().includes('up') ? 'up' : 'down';
        parameters.direction = scrollDirection;
        break;
    }

    return parameters;
  }

  private needsClarification(input: string, action: string, target?: string): boolean {
    if (action === 'navigate' && !target) return true;
    if (action === 'search' && !target) return true;
    if (action === 'click' && !target) return true;
    if (action === 'type' && !target) return true;
    return false;
  }

  private generateClarificationQuestions(action: string, target?: string): string[] {
    const questions: string[] = [];

    switch (action) {
      case 'navigate':
        questions.push('Which website would you like me to navigate to?');
        break;
      case 'search':
        questions.push('What would you like me to search for?');
        break;
      case 'click':
        questions.push('Which element would you like me to click on?');
        break;
      case 'type':
        questions.push('What text would you like me to type?');
        break;
    }

    return questions;
  }

  private generateIntent(action: string, target?: string): string {
    switch (action) {
      case 'navigate':
        return `Navigate to ${target || 'a website'}`;
      case 'search':
        return `Search for ${target || 'something'}`;
      case 'click':
        return `Click on ${target || 'an element'}`;
      case 'type':
        return `Type ${target || 'text'}`;
      case 'scroll':
        return 'Scroll the page';
      case 'screenshot':
        return 'Take a screenshot';
      default:
        return 'Perform browser automation';
    }
  }
}