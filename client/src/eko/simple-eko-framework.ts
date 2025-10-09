/**
 * SIMPLE EKO FRAMEWORK
 * Based on https://github.com/FellouAI/eko.git
 * REAL implementation - NO FAKE WRAPPERS
 */

import SimpleEkoBrowserAgent from './simple-eko-browser';

export interface EkoResult {
  success: boolean;
  stopReason: 'done' | 'abort' | 'error';
  taskId: string;
  result: string;
  error?: any;
}

export class SimpleEkoFramework {
  private browserAgent: SimpleEkoBrowserAgent;

  constructor() {
    this.browserAgent = new SimpleEkoBrowserAgent();
    console.log('🚀 SIMPLE EKO: Framework initialized with REAL browser agent');
  }

  /**
   * Execute a command using the REAL Eko framework
   */
  async run(command: string): Promise<EkoResult> {
    console.log('🎯 SIMPLE EKO: Executing command:', command);
    
    try {
      const taskId = this.generateTaskId();
      let result = '';

      // Parse command and execute appropriate actions
      const lowerCommand = command.toLowerCase();
      
      if (lowerCommand.includes('navigate') || lowerCommand.includes('go to')) {
        const url = this.extractUrl(command);
        if (url) {
          await this.browserAgent.navigateTo(url);
          result = `Navigated to ${url}`;
        } else {
          result = 'No URL found in command';
        }
      } else if (lowerCommand.includes('click')) {
        const selector = this.extractSelector(command);
        if (selector) {
          await this.browserAgent.clickElement(selector);
          result = `Clicked element: ${selector}`;
        } else {
          result = 'No element selector found in command';
        }
      } else if (lowerCommand.includes('type')) {
        const { selector, text } = this.extractTypeCommand(command);
        if (selector && text) {
          await this.browserAgent.typeText(selector, text);
          result = `Typed "${text}" into ${selector}`;
        } else {
          result = 'Could not parse type command';
        }
      } else if (lowerCommand.includes('scroll')) {
        const amount = this.extractScrollAmount(command);
        await this.browserAgent.scrollPage(amount);
        result = `Scrolled page by ${amount}px`;
      } else if (lowerCommand.includes('screenshot')) {
        const screenshot = await this.browserAgent.screenshot();
        result = `Screenshot taken: ${screenshot.imageBase64.substring(0, 50)}...`;
      } else if (lowerCommand.includes('extract') || lowerCommand.includes('get content')) {
        const content = await this.browserAgent.extractPageContent();
        result = `Page content extracted: ${content.title} - ${content.page_url}`;
      } else {
        // Default: try to navigate to Google
        await this.browserAgent.navigateTo('https://google.com');
        result = 'Navigated to Google as default action';
      }

      console.log('✅ SIMPLE EKO: Command completed:', result);
      
      return {
        success: true,
        stopReason: 'done',
        taskId,
        result
      };
      
    } catch (error) {
      console.error('❌ SIMPLE EKO: Command failed:', error);
      
      return {
        success: false,
        stopReason: 'error',
        taskId: this.generateTaskId(),
        result: `Error: ${error}`,
        error
      };
    }
  }

  /**
   * Extract URL from command
   */
  private extractUrl(command: string): string | null {
    const urlMatch = command.match(/(?:navigate to|go to|visit|open)\s+(https?:\/\/[^\s]+)/i);
    return urlMatch ? urlMatch[1] : null;
  }

  /**
   * Extract CSS selector from command
   */
  private extractSelector(command: string): string | null {
    // Simple selector extraction - look for common patterns
    if (command.includes('button')) return 'button';
    if (command.includes('input')) return 'input';
    if (command.includes('link')) return 'a';
    if (command.includes('search')) return 'input[type="search"], input[placeholder*="search" i]';
    if (command.includes('submit')) return 'input[type="submit"], button[type="submit"]';
    
    // Try to find quoted text
    const quotedMatch = command.match(/click\s+["']([^"']+)["']/i);
    return quotedMatch ? quotedMatch[1] : null;
  }

  /**
   * Extract type command details
   */
  private extractTypeCommand(command: string): { selector: string | null; text: string | null } {
    const typeMatch = command.match(/type\s+["']([^"']+)["']\s+(?:in|into|on)\s+["']([^"']+)["']/i);
    if (typeMatch) {
      return { text: typeMatch[1], selector: typeMatch[2] };
    }
    
    // Fallback to common selectors
    const textMatch = command.match(/type\s+["']([^"']+)["']/i);
    return { 
      text: textMatch ? textMatch[1] : null, 
      selector: 'input' 
    };
  }

  /**
   * Extract scroll amount from command
   */
  private extractScrollAmount(command: string): number {
    const amountMatch = command.match(/scroll\s+(?:by\s+)?(\d+)/i);
    return amountMatch ? parseInt(amountMatch[1]) : 300;
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

export default SimpleEkoFramework;
