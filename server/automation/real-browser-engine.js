import puppeteer from 'puppeteer';
import { EventEmitter } from 'events';

/**
 * REAL BROWSER AUTOMATION ENGINE
 * No simulations, no mocks - actual browser control
 */
export class RealBrowserEngine extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.page = null;
    this.isActive = false;
  }

  /**
   * Launch real browser instance
   */
  async initialize() {
    try {
      console.log('🚀 REAL BROWSER: Launching actual Chrome browser...');
      
      this.browser = await puppeteer.launch({
        headless: false, // Show browser to user
        defaultViewport: null,
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

      this.page = await this.browser.newPage();
      this.isActive = true;
      
      console.log('✅ REAL BROWSER: Chrome launched successfully');
      this.emit('browserReady');
      
      return true;
    } catch (error) {
      console.error('❌ REAL BROWSER: Failed to launch browser:', error);
      throw error;
    }
  }

  /**
   * Execute real browser automation command
   */
  async executeCommand(command) {
    if (!this.isActive || !this.page) {
      throw new Error('Browser not initialized');
    }

    console.log(`🎯 REAL BROWSER: Executing command: ${command}`);
    
    try {
      const result = await this.parseAndExecute(command);
      this.emit('commandExecuted', { command, result });
      return result;
    } catch (error) {
      console.error(`❌ REAL BROWSER: Command failed: ${command}`, error);
      this.emit('commandError', { command, error });
      throw error;
    }
  }

  /**
   * Parse natural language command and execute
   */
  async parseAndExecute(command) {
    const lowerCommand = command.toLowerCase();
    
    // Navigation commands
    if (lowerCommand.includes('go to') || lowerCommand.includes('navigate to')) {
      const url = this.extractUrl(command);
      return await this.navigateTo(url);
    }
    
    // Click commands
    if (lowerCommand.includes('click')) {
      const selector = this.extractSelector(command);
      return await this.clickElement(selector);
    }
    
    // Type commands
    if (lowerCommand.includes('type') || lowerCommand.includes('enter')) {
      const { selector, text } = this.extractTypeCommand(command);
      return await this.typeText(selector, text);
    }
    
    // Search commands
    if (lowerCommand.includes('search')) {
      const query = this.extractSearchQuery(command);
      return await this.performSearch(query);
    }
    
    // Screenshot command
    if (lowerCommand.includes('screenshot') || lowerCommand.includes('capture')) {
      return await this.takeScreenshot();
    }
    
    // Default: try to navigate to the command as URL
    return await this.navigateTo(command);
  }

  /**
   * Navigate to URL
   */
  async navigateTo(url) {
    console.log(`🌐 REAL BROWSER: Navigating to ${url}`);
    
    // Add protocol if missing
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    
    const screenshot = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      action: 'navigate',
      url: url,
      title: await this.page.title(),
      screenshot: screenshot,
      success: true
    };
  }

  /**
   * Click on element
   */
  async clickElement(selector) {
    console.log(`🖱️ REAL BROWSER: Clicking element: ${selector}`);
    
    await this.page.waitForSelector(selector, { timeout: 10000 });
    await this.page.click(selector);
    
    const screenshot = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      action: 'click',
      selector: selector,
      screenshot: screenshot,
      success: true
    };
  }

  /**
   * Type text into element
   */
  async typeText(selector, text) {
    console.log(`⌨️ REAL BROWSER: Typing "${text}" into ${selector}`);
    
    await this.page.waitForSelector(selector, { timeout: 10000 });
    await this.page.type(selector, text);
    
    const screenshot = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      action: 'type',
      selector: selector,
      text: text,
      screenshot: screenshot,
      success: true
    };
  }

  /**
   * Perform search on Google
   */
  async performSearch(query) {
    console.log(`🔍 REAL BROWSER: Searching for "${query}"`);
    
    await this.page.goto('https://www.google.com');
    await this.page.waitForSelector('input[name="q"]');
    await this.page.type('input[name="q"]', query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    const screenshot = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      action: 'search',
      query: query,
      screenshot: screenshot,
      success: true
    };
  }

  /**
   * Take screenshot
   */
  async takeScreenshot() {
    console.log('📸 REAL BROWSER: Taking screenshot');
    
    const screenshot = await this.page.screenshot({ 
      encoding: 'base64',
      fullPage: true 
    });
    
    return {
      action: 'screenshot',
      screenshot: screenshot,
      success: true
    };
  }

  /**
   * Extract URL from command
   */
  extractUrl(command) {
    const urlMatch = command.match(/(?:go to|navigate to)\s+(.+)/i);
    return urlMatch ? urlMatch[1].trim() : command.trim();
  }

  /**
   * Extract selector from click command
   */
  extractSelector(command) {
    const clickMatch = command.match(/click\s+(.+)/i);
    if (clickMatch) {
      const selector = clickMatch[1].trim();
      // Convert natural language to CSS selectors
      if (selector.includes('button')) return 'button';
      if (selector.includes('link')) return 'a';
      if (selector.includes('input')) return 'input';
      return selector;
    }
    return 'button'; // Default
  }

  /**
   * Extract type command details
   */
  extractTypeCommand(command) {
    const typeMatch = command.match(/type\s+"([^"]+)"\s+into\s+(.+)/i);
    if (typeMatch) {
      return {
        text: typeMatch[1],
        selector: typeMatch[2]
      };
    }
    
    // Fallback: try to extract text and selector
    const words = command.split(' ');
    const textIndex = words.indexOf('type');
    if (textIndex !== -1 && textIndex + 1 < words.length) {
      return {
        text: words[textIndex + 1],
        selector: 'input'
      };
    }
    
    return { text: 'test', selector: 'input' };
  }

  /**
   * Extract search query
   */
  extractSearchQuery(command) {
    const searchMatch = command.match(/search\s+for\s+(.+)/i);
    if (searchMatch) {
      return searchMatch[1].trim();
    }
    
    // Fallback: use the command as query
    return command.replace(/search\s+/i, '').trim();
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isActive = false;
      console.log('🔒 REAL BROWSER: Browser closed');
    }
  }

  /**
   * Get current page info
   */
  async getPageInfo() {
    if (!this.page) return null;
    
    return {
      url: this.page.url(),
      title: await this.page.title(),
      screenshot: await this.page.screenshot({ encoding: 'base64' })
    };
  }
}
