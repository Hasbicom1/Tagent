/**
 * BROWSER AUTOMATION BACKEND - Production Ready
 * 
 * Real browser automation with Playwright integration.
 * Provides actual browser control functionality for the frontend.
 */

import { chromium } from 'playwright';
import { getUserSession } from './database.js';

// Active browser sessions
const activeSessions = new Map();

export class BrowserAutomationEngine {
  constructor(agentId) {
    this.agentId = agentId;
    this.browser = null;
    this.page = null;
    this.isActive = false;
  }

  async initialize() {
    try {
      console.log('🚀 BROWSER: Initializing automation engine for agent:', this.agentId);
      
      // Verify agent session is valid
      const session = await getUserSession(this.agentId);
      if (!session) {
        throw new Error('Invalid or expired agent session');
      }

      // Launch browser
      this.browser = await chromium.launch({
        headless: false, // Set to true for production
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
      
      console.log('✅ BROWSER: Automation engine initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ BROWSER: Failed to initialize automation engine:', error);
      throw error;
    }
  }

  async navigateTo(url) {
    if (!this.isActive || !this.page) {
      throw new Error('Browser automation not initialized');
    }

    try {
      console.log('🌐 BROWSER: Navigating to:', url);
      await this.page.goto(url, { waitUntil: 'networkidle' });
      console.log('✅ BROWSER: Navigation completed');
      return { success: true, url };
    } catch (error) {
      console.error('❌ BROWSER: Navigation failed:', error);
      throw error;
    }
  }

  async clickElement(selector) {
    if (!this.isActive || !this.page) {
      throw new Error('Browser automation not initialized');
    }

    try {
      console.log('🖱️ BROWSER: Clicking element:', selector);
      await this.page.click(selector);
      console.log('✅ BROWSER: Click completed');
      return { success: true, action: 'click', selector };
    } catch (error) {
      console.error('❌ BROWSER: Click failed:', error);
      throw error;
    }
  }

  async typeText(selector, text) {
    if (!this.isActive || !this.page) {
      throw new Error('Browser automation not initialized');
    }

    try {
      console.log('⌨️ BROWSER: Typing text:', text, 'into:', selector);
      await this.page.fill(selector, text);
      console.log('✅ BROWSER: Text input completed');
      return { success: true, action: 'type', selector, text };
    } catch (error) {
      console.error('❌ BROWSER: Text input failed:', error);
      throw error;
    }
  }

  async takeScreenshot() {
    if (!this.isActive || !this.page) {
      throw new Error('Browser automation not initialized');
    }

    try {
      console.log('📸 BROWSER: Taking screenshot');
      const screenshot = await this.page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      console.log('✅ BROWSER: Screenshot taken');
      return { 
        success: true, 
        screenshot: screenshot.toString('base64'),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ BROWSER: Screenshot failed:', error);
      throw error;
    }
  }

  async executeTask(task) {
    if (!this.isActive || !this.page) {
      throw new Error('Browser automation not initialized');
    }

    try {
      console.log('🎯 BROWSER: Executing task:', task);
      
      // Parse task and execute appropriate actions
      const actions = this.parseTask(task);
      const results = [];

      for (const action of actions) {
        let result;
        switch (action.type) {
          case 'navigate':
            result = await this.navigateTo(action.url);
            break;
          case 'click':
            result = await this.clickElement(action.selector);
            break;
          case 'type':
            result = await this.typeText(action.selector, action.text);
            break;
          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }
        results.push(result);
      }

      console.log('✅ BROWSER: Task execution completed');
      return { success: true, results };
    } catch (error) {
      console.error('❌ BROWSER: Task execution failed:', error);
      throw error;
    }
  }

  parseTask(task) {
    // Simple task parser - can be enhanced with AI
    const actions = [];
    
    // Look for navigation commands
    const urlMatch = task.match(/go to (https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      actions.push({ type: 'navigate', url: urlMatch[1] });
    }

    // Look for click commands
    const clickMatch = task.match(/click (?:on )?([^\s]+)/i);
    if (clickMatch) {
      actions.push({ type: 'click', selector: clickMatch[1] });
    }

    // Look for type commands
    const typeMatch = task.match(/type ["']([^"']+)["'] (?:into|in) ([^\s]+)/i);
    if (typeMatch) {
      actions.push({ type: 'type', text: typeMatch[1], selector: typeMatch[2] });
    }

    return actions;
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.page = null;
      this.isActive = false;
      console.log('🔒 BROWSER: Automation engine closed');
    } catch (error) {
      console.error('❌ BROWSER: Failed to close automation engine:', error);
    }
  }
}

// Session management
export function getBrowserSession(agentId) {
  return activeSessions.get(agentId);
}

export function createBrowserSession(agentId) {
  const session = new BrowserAutomationEngine(agentId);
  activeSessions.set(agentId, session);
  return session;
}

export function removeBrowserSession(agentId) {
  const session = activeSessions.get(agentId);
  if (session) {
    session.close();
    activeSessions.delete(agentId);
  }
}

// Cleanup expired sessions
setInterval(() => {
  for (const [agentId, session] of activeSessions) {
    if (!session.isActive) {
      removeBrowserSession(agentId);
    }
  }
}, 60000); // Cleanup every minute
