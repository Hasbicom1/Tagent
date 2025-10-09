/**
 * EKO BROWSER AGENT
 * Real implementation based on Eko framework
 * NO FAKE WRAPPERS - ACTUAL BROWSER AUTOMATION
 */

import { Agent, AgentContext, AgentChain } from '../core/eko-framework';
import { 
  navigateTo, 
  clickElement, 
  typeText, 
  scrollPage, 
  waitForElement,
  getElementText,
  takeScreenshot 
} from '../utils/domActions';
import { showCursor, hideCursor, highlightElement, removeHighlight } from '../utils/visualFeedback';

export class EkoBrowserAgent implements Agent {
  public Name = "BrowserAgent";
  public Description = "Real browser automation agent with visual feedback";
  public AgentContext?: any;

  async run(context: AgentContext, agentChain: AgentChain): Promise<string> {
    console.log('🤖 EKO BROWSER AGENT: Starting real browser automation');
    
    try {
      // Get task prompt from context
      const taskPrompt = context.context.chain.taskPrompt;
      console.log('🎯 EKO BROWSER AGENT: Task:', taskPrompt);
      
      // Parse natural language into browser actions
      const actions = await this.parseTaskToActions(taskPrompt);
      console.log('📋 EKO BROWSER AGENT: Parsed actions:', actions);
      
      // Execute actions with visual feedback
      const results: string[] = [];
      
      for (const action of actions) {
        console.log('🎬 EKO BROWSER AGENT: Executing action:', action);
        
        let result: any;
        
        switch (action.type) {
          case 'navigate':
            result = await this.executeNavigate(action);
            break;
          case 'click':
            result = await this.executeClick(action);
            break;
          case 'type':
            result = await this.executeType(action);
            break;
          case 'scroll':
            result = await this.executeScroll(action);
            break;
          case 'wait':
            result = await this.executeWait(action);
            break;
          case 'screenshot':
            result = await this.executeScreenshot(action);
            break;
          default:
            result = { success: false, error: `Unknown action: ${action.type}` };
        }
        
        results.push(`Action ${action.type}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        
        // Add delay between actions for natural behavior
        await this.delay(500 + Math.random() * 1000);
      }
      
      const finalResult = results.join('\n');
      console.log('✅ EKO BROWSER AGENT: Completed with results:', finalResult);
      
      return finalResult;
      
    } catch (error) {
      console.error('❌ EKO BROWSER AGENT: Error:', error);
      return `Browser automation failed: ${error}`;
    }
  }

  /**
   * Parse natural language task into structured actions
   */
  private async parseTaskToActions(taskPrompt: string): Promise<BrowserAction[]> {
    const actions: BrowserAction[] = [];
    const prompt = taskPrompt.toLowerCase();
    
    // Navigate to URL
    const urlMatch = prompt.match(/(?:go to|navigate to|visit|open)\s+(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      actions.push({
        type: 'navigate',
        url: urlMatch[1]
      });
    }
    
    // Click elements
    const clickMatches = prompt.match(/(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?([^,.\n]+)/g);
    if (clickMatches) {
      for (const match of clickMatches) {
        const element = match.replace(/(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?/, '').trim();
        actions.push({
          type: 'click',
          selector: this.getElementSelector(element)
        });
      }
    }
    
    // Type text
    const typeMatches = prompt.match(/(?:type|enter|input)\s+(?:the\s+)?["']([^"']+)["']\s+(?:in|into|on)\s+(?:the\s+)?([^,.\n]+)/g);
    if (typeMatches) {
      for (const match of typeMatches) {
        const [, text, element] = match.match(/(?:type|enter|input)\s+(?:the\s+)?["']([^"']+)["']\s+(?:in|into|on)\s+(?:the\s+)?(.+)/) || [];
        if (text && element) {
          actions.push({
            type: 'type',
            selector: this.getElementSelector(element),
            text: text
          });
        }
      }
    }
    
    // Scroll
    if (prompt.includes('scroll')) {
      if (prompt.includes('down')) {
        actions.push({ type: 'scroll', direction: 'down', amount: 500 });
      } else if (prompt.includes('up')) {
        actions.push({ type: 'scroll', direction: 'up', amount: 500 });
      } else {
        actions.push({ type: 'scroll', direction: 'down', amount: 300 });
      }
    }
    
    // Wait for element
    const waitMatches = prompt.match(/(?:wait for|wait until)\s+(?:the\s+)?([^,.\n]+)/g);
    if (waitMatches) {
      for (const match of waitMatches) {
        const element = match.replace(/(?:wait for|wait until)\s+(?:the\s+)?/, '').trim();
        actions.push({
          type: 'wait',
          selector: this.getElementSelector(element),
          timeout: 5000
        });
      }
    }
    
    // Screenshot
    if (prompt.includes('screenshot') || prompt.includes('capture')) {
      actions.push({ type: 'screenshot' });
    }
    
    // Default action if none found
    if (actions.length === 0) {
      actions.push({ type: 'navigate', url: 'https://google.com' });
    }
    
    return actions;
  }

  /**
   * Convert natural language element description to CSS selector
   */
  private getElementSelector(description: string): string {
    const desc = description.toLowerCase().trim();
    
    // Common element mappings
    if (desc.includes('button') || desc.includes('btn')) {
      return 'button';
    }
    if (desc.includes('input') || desc.includes('field')) {
      return 'input';
    }
    if (desc.includes('link') || desc.includes('a ')) {
      return 'a';
    }
    if (desc.includes('search')) {
      return 'input[type="search"], input[placeholder*="search" i]';
    }
    if (desc.includes('submit')) {
      return 'input[type="submit"], button[type="submit"]';
    }
    if (desc.includes('login') || desc.includes('sign in')) {
      return 'button:contains("login"), button:contains("sign in"), input[type="submit"]';
    }
    
    // Try to find by text content
    return `*:contains("${description}")`;
  }

  /**
   * Execute navigation action
   */
  private async executeNavigate(action: NavigateAction): Promise<ActionResult> {
    try {
      showCursor();
      const result = await navigateTo(action.url);
      hideCursor();
      return { success: true, result };
    } catch (error) {
      hideCursor();
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute click action with visual feedback
   */
  private async executeClick(action: ClickAction): Promise<ActionResult> {
    try {
      showCursor();
      
      // Find element
      const element = document.querySelector(action.selector);
      if (!element) {
        throw new Error(`Element not found: ${action.selector}`);
      }
      
      // Highlight element
      highlightElement(element);
      
      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.delay(300);
      
      // Click with visual feedback
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Move cursor to element
      await this.moveCursorTo(centerX, centerY);
      await this.delay(200);
      
      // Click
      (element as HTMLElement).click();
      
      // Cleanup
      removeHighlight();
      hideCursor();
      
      return { success: true, result: `Clicked ${action.selector}` };
    } catch (error) {
      removeHighlight();
      hideCursor();
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute type action with character-by-character animation
   */
  private async executeType(action: TypeAction): Promise<ActionResult> {
    try {
      showCursor();
      
      // Find element
      const element = document.querySelector(action.selector) as HTMLInputElement;
      if (!element) {
        throw new Error(`Element not found: ${action.selector}`);
      }
      
      // Focus and highlight
      element.focus();
      highlightElement(element);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.delay(200);
      
      // Clear existing content
      element.value = '';
      
      // Type character by character
      for (let i = 0; i < action.text.length; i++) {
        const char = action.text[i];
        element.value += char;
        
        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Random delay between characters
        const delay = 50 + Math.random() * 100;
        await this.delay(delay);
      }
      
      // Trigger change event
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Cleanup
      removeHighlight();
      hideCursor();
      
      return { success: true, result: `Typed "${action.text}" into ${action.selector}` };
    } catch (error) {
      removeHighlight();
      hideCursor();
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute scroll action
   */
  private async executeScroll(action: ScrollAction): Promise<ActionResult> {
    try {
      showCursor();
      
      const amount = action.direction === 'down' ? action.amount : -action.amount;
      const result = await scrollPage(amount);
      
      hideCursor();
      return { success: true, result };
    } catch (error) {
      hideCursor();
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute wait action
   */
  private async executeWait(action: WaitAction): Promise<ActionResult> {
    try {
      await waitForElement(action.selector, action.timeout);
      return { success: true, result: `Element found: ${action.selector}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute screenshot action
   */
  private async executeScreenshot(action: ScreenshotAction): Promise<ActionResult> {
    try {
      const result = await takeScreenshot();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Move cursor to specific coordinates
   */
  private async moveCursorTo(x: number, y: number): Promise<void> {
    const cursor = document.getElementById('automation-cursor');
    if (cursor) {
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
      cursor.style.display = 'block';
      await this.delay(100);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Action Types
interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot';
}

interface NavigateAction extends BrowserAction {
  type: 'navigate';
  url: string;
}

interface ClickAction extends BrowserAction {
  type: 'click';
  selector: string;
}

interface TypeAction extends BrowserAction {
  type: 'type';
  selector: string;
  text: string;
}

interface ScrollAction extends BrowserAction {
  type: 'scroll';
  direction: 'up' | 'down';
  amount: number;
}

interface WaitAction extends BrowserAction {
  type: 'wait';
  selector: string;
  timeout: number;
}

interface ScreenshotAction extends BrowserAction {
  type: 'screenshot';
}

interface ActionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export default EkoBrowserAgent;
