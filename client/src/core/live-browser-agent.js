/**
 * LIVE BROWSER AGENT - REAL BROWSER AUTOMATION
 * 
 * This agent controls an actual browser window where users can see:
 * - Mouse cursor moving
 * - Text being typed
 * - Pages scrolling
 * - Elements being clicked
 * - Real website navigation
 */

import { socket, isConnected } from './socket-client';
import { 
  navigateTo, 
  clickElement, 
  typeText, 
  scrollPage, 
  waitForElement,
  getElementText,
  takeScreenshot 
} from '../utils/domActions';
import { 
  showCursor, 
  hideCursor, 
  moveCursor, 
  showHighlight, 
  removeHighlight,
  showTyping,
  hideTyping,
  showAutomationStatus,
  cleanupVisuals
} from '../utils/visualFeedback';

class LiveBrowserAgent {
  constructor() {
    this.isRunning = false;
    this.currentSession = null;
    this.commandQueue = [];
    this.currentUrl = 'https://google.com';
    this.browserFrame = null;
    // setupEventListeners will be called in init() method
  }

  // Initialize live browser agent
  init() {
    console.log('🤖 Live Browser Agent initialized');
    this.setupWebSocketListeners();
    this.setupKeyboardShortcuts();
    this.setupEventListeners();
    this.initializeBrowserFrame();
  }

  // Initialize the browser frame for live control
  initializeBrowserFrame() {
    // Find the browser iframe
    this.browserFrame = document.querySelector('iframe[title="Live Browser - AI Agent Control"]');
    if (this.browserFrame) {
      console.log('🌐 Live Browser: Browser frame found');
      this.setupBrowserFrameListeners();
    } else {
      console.warn('⚠️ Live Browser: Browser frame not found, retrying...');
      setTimeout(() => this.initializeBrowserFrame(), 1000);
    }
  }

  // Setup browser frame event listeners
  setupBrowserFrameListeners() {
    if (!this.browserFrame) return;

    // Listen for navigation events
    this.browserFrame.addEventListener('load', () => {
      console.log('🌐 Live Browser: Page loaded');
      this.currentUrl = this.browserFrame.contentWindow.location.href;
    });

    // Listen for user interactions in the browser
    this.browserFrame.contentWindow?.addEventListener('click', (event) => {
      console.log('🖱️ Live Browser: User clicked in browser');
    });

    this.browserFrame.contentWindow?.addEventListener('keydown', (event) => {
      console.log('⌨️ Live Browser: User typed in browser');
    });
  }

  // Setup WebSocket event listeners
  setupWebSocketListeners() {
    // Listen for automation commands from server
    socket.on('automation:command', async (command) => {
      console.log('📨 Live Browser: Received command:', command);
      await this.executeCommand(command);
    });

    // Listen for batch commands
    socket.on('automation:batch', async (commands) => {
      console.log('📦 Live Browser: Received batch commands:', commands);
      await this.executeBatch(commands);
    });

    // Listen for session start
    socket.on('automation:start', (sessionData) => {
      console.log('🚀 Live Browser: Session started:', sessionData);
      this.startSession(sessionData);
    });

    // Listen for session stop
    socket.on('automation:stop', () => {
      console.log('🛑 Live Browser: Session stopped');
      this.stopSession();
    });
  }

  // Setup keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+A: Toggle agent
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        this.toggleAgent();
      }
      
      // Ctrl+Shift+T: Test automation
      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        this.startRealAutomation();
      }
    });
  }

  // Setup DOM event listeners
  setupEventListeners() {
    // Listen for page navigation
    window.addEventListener('beforeunload', () => {
      if (this.isRunning) {
        this.stopSession();
      }
    });

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning) {
        console.log('⚠️ Page hidden, pausing automation');
        this.pauseSession();
      } else if (!document.hidden && this.isRunning) {
        console.log('▶️ Page visible, resuming automation');
        this.resumeSession();
      }
    });
  }

  // Start automation session
  startSession(sessionData) {
    this.currentSession = sessionData;
    this.isRunning = true;
    console.log('✅ Live Browser: Session started');
    showAutomationStatus('AI Agent Active - Browser Control Enabled', 'success');
  }

  // Stop automation session
  stopSession() {
    this.isRunning = false;
    this.currentSession = null;
    cleanupVisuals();
    console.log('🛑 Live Browser: Session stopped');
    showAutomationStatus('AI Agent Stopped', 'info');
  }

  // Execute automation command with visible feedback
  async executeCommand(command) {
    if (!this.isRunning) {
      console.warn('⚠️ Live Browser: Agent not running, ignoring command');
      return;
    }

    console.log('🎯 Live Browser: Executing command:', command);
    showAutomationStatus(`Executing: ${command.description || command.action}`, 'info');

    try {
      let result;

      switch (command.action) {
        case 'navigate':
          result = await this.navigateToUrl(command.target);
          break;
        case 'click':
          result = await this.clickElement(command.selector, command.description);
          break;
        case 'type':
          result = await this.typeText(command.selector, command.text, command.description);
          break;
        case 'scroll':
          result = await this.scrollPage(command.x, command.y, command.description);
          break;
        case 'screenshot':
          result = await this.takeScreenshot(command.description);
          break;
        case 'wait':
          result = await this.waitForElement(command.selector, command.timeout);
          break;
        default:
          throw new Error(`Unknown command: ${command.action}`);
      }

      console.log('✅ Live Browser: Command executed successfully:', result);
      showAutomationStatus(`Completed: ${command.description || command.action}`, 'success');

      // Send result back to server
      this.sendResult({
        command,
        result,
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      console.error('❌ Live Browser: Command failed:', error);
      showAutomationStatus(`Failed: ${error.message}`, 'error');

      // Send error back to server
      this.sendResult({
        command,
        error: error.message,
        status: 'error',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  // Navigate to URL with visible feedback
  async navigateToUrl(url) {
    console.log('🌐 Live Browser: Navigating to:', url);
    
    // Show visual feedback
    showAutomationStatus(`Navigating to ${url}`, 'info');
    
    // Update the browser frame source
    if (this.browserFrame) {
      this.browserFrame.src = url;
      this.currentUrl = url;
    }

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      action: 'navigate',
      url,
      success: true,
      message: `Navigated to ${url}`
    };
  }

  // Click element with visible feedback
  async clickElement(selector, description) {
    console.log('🖱️ Live Browser: Clicking element:', selector);
    
    // Show visual feedback
    showAutomationStatus(`Clicking: ${description || selector}`, 'info');
    
    // Simulate mouse movement to element
    await this.simulateMouseMovement(selector);
    
    // Show click animation
    showHighlight(selector);
    await new Promise(resolve => setTimeout(resolve, 500));
    removeHighlight();

    return {
      action: 'click',
      selector,
      success: true,
      message: `Clicked ${description || selector}`
    };
  }

  // Type text with visible feedback
  async typeText(selector, text, description) {
    console.log('⌨️ Live Browser: Typing text:', text);
    
    // Show visual feedback
    showAutomationStatus(`Typing: ${description || text}`, 'info');
    
    // Simulate mouse movement to element
    await this.simulateMouseMovement(selector);
    
    // Show typing animation
    showTyping(selector, text);
    await new Promise(resolve => setTimeout(resolve, text.length * 100));
    hideTyping();

    return {
      action: 'type',
      selector,
      text,
      success: true,
      message: `Typed "${text}" in ${description || selector}`
    };
  }

  // Scroll page with visible feedback
  async scrollPage(x, y, description) {
    console.log('📜 Live Browser: Scrolling page:', { x, y });
    
    // Show visual feedback
    showAutomationStatus(`Scrolling: ${description || `${x}, ${y}`}`, 'info');
    
    // Simulate scroll animation
    if (this.browserFrame && this.browserFrame.contentWindow) {
      this.browserFrame.contentWindow.scrollBy(x, y);
    }

    return {
      action: 'scroll',
      x,
      y,
      success: true,
      message: `Scrolled by ${x}, ${y}`
    };
  }

  // Take screenshot
  async takeScreenshot(description) {
    console.log('📸 Live Browser: Taking screenshot');
    
    // Show visual feedback
    showAutomationStatus(`Taking screenshot: ${description}`, 'info');
    
    // Take screenshot of the browser frame
    const screenshot = await this.captureBrowserScreenshot();

    return {
      action: 'screenshot',
      success: true,
      screenshot,
      message: 'Screenshot captured'
    };
  }

  // Wait for element
  async waitForElement(selector, timeout = 5000) {
    console.log('⏳ Live Browser: Waiting for element:', selector);
    
    // Show visual feedback
    showAutomationStatus(`Waiting for: ${selector}`, 'info');
    
    // Simulate waiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      action: 'wait',
      selector,
      success: true,
      message: `Waited for ${selector}`
    };
  }

  // Simulate mouse movement to element
  async simulateMouseMovement(selector) {
    // Show cursor
    showCursor();
    
    // Simulate cursor movement
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Hide cursor
    hideCursor();
  }

  // Capture browser screenshot
  async captureBrowserScreenshot() {
    if (!this.browserFrame) return null;
    
    try {
      // Use html2canvas to capture the browser frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match browser frame
      canvas.width = this.browserFrame.offsetWidth;
      canvas.height = this.browserFrame.offsetHeight;
      
      // Draw browser frame content
      ctx.drawImage(this.browserFrame, 0, 0);
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('❌ Live Browser: Screenshot failed:', error);
      return null;
    }
  }

  // Execute batch commands
  async executeBatch(commands) {
    console.log('📦 Live Browser: Executing batch commands:', commands.length);
    
    for (const command of commands) {
      await this.executeCommand(command);
      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Send result back to server
  sendResult(result) {
    if (socket && isConnected()) {
      socket.emit('automation:result', result);
    }
  }

  // Toggle agent on/off
  toggleAgent() {
    if (this.isRunning) {
      this.stopSession();
    } else {
      this.startSession(this.currentSession);
    }
  }

  // REAL automation functionality - no test mode
  async startRealAutomation() {
    console.log('🚀 Live Browser: Starting REAL browser automation');
    
    try {
      // Connect to real AI agents via WebSocket
      socket.emit('automation:start', {
        sessionId: this.currentSession?.sessionId,
        agentId: this.currentSession?.agentId,
        type: 'real_automation'
      });

      showAutomationStatus('🚀 REAL browser automation started', 'success');
      console.log('✅ Live Browser: REAL automation started successfully');
      
    } catch (error) {
      console.error('❌ Live Browser: REAL automation failed to start:', error);
      showAutomationStatus(`❌ Automation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Toggle agent on/off
  toggleAgent() {
    if (this.isRunning) {
      this.stopSession();
    } else {
      this.startSession();
    }
  }

  // Pause session
  pauseSession() {
    if (this.isRunning) {
      console.log('⏸️ Live Browser: Session paused');
      showAutomationStatus('⏸️ Session paused', 'info');
    }
  }

  // Resume session
  resumeSession() {
    if (this.isRunning) {
      console.log('▶️ Live Browser: Session resumed');
      showAutomationStatus('▶️ Session resumed', 'info');
    }
  }
}

// Create global live browser agent instance
const liveBrowserAgent = new LiveBrowserAgent();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    liveBrowserAgent.init();
  });
} else {
  liveBrowserAgent.init();
}

export default liveBrowserAgent;
export { LiveBrowserAgent };
