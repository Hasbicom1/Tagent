// Main automation agent that handles DOM control and WebSocket communication
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
import { showAutomationStatus, cleanupVisuals } from '../utils/visualFeedback';

class AutomationAgent {
  constructor() {
    this.isRunning = false;
    this.currentSession = null;
    this.commandQueue = [];
    this.setupEventListeners();
  }

  // Initialize automation agent
  init() {
    console.log('🤖 Automation Agent initialized');
    this.setupWebSocketListeners();
    this.setupKeyboardShortcuts();
  }

  // Setup WebSocket event listeners
  setupWebSocketListeners() {
    // Listen for automation commands from server
    socket.on('automation:command', async (command) => {
      console.log('📨 Received command:', command);
      await this.executeCommand(command);
    });

    // Listen for batch commands
    socket.on('automation:batch', async (commands) => {
      console.log('📦 Received batch commands:', commands);
      await this.executeBatch(commands);
    });

    // Listen for session start
    socket.on('automation:start', (sessionData) => {
      console.log('🚀 Automation session started:', sessionData);
      this.startSession(sessionData);
    });

    // Listen for session stop
    socket.on('automation:stop', () => {
      console.log('🛑 Automation session stopped');
      this.stopSession();
    });
  }

  // Setup keyboard shortcuts for manual control
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+A to start automation
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        this.startSession();
      }
      
      // Ctrl+Shift+S to stop automation
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        this.stopSession();
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
  startSession(sessionData = null) {
    if (this.isRunning) {
      console.log('⚠️ Automation already running');
      return;
    }

    this.isRunning = true;
    this.currentSession = sessionData || { id: Date.now() };
    
    console.log('🚀 Starting automation session:', this.currentSession);
    showAutomationStatus('🤖 Automation Active', 'success');
    
    // Notify server that session started
    socket.emit('automation:session:start', {
      sessionId: this.currentSession.id,
      url: window.location.href,
      timestamp: Date.now()
    });
  }

  // Stop automation session
  stopSession() {
    if (!this.isRunning) {
      console.log('⚠️ No automation session running');
      return;
    }

    this.isRunning = false;
    this.currentSession = null;
    this.commandQueue = [];
    
    console.log('🛑 Stopping automation session');
    showAutomationStatus('🛑 Automation Stopped', 'info');
    cleanupVisuals();
    
    // Notify server that session stopped
    socket.emit('automation:session:stop', {
      timestamp: Date.now()
    });
  }

  // Pause automation session
  pauseSession() {
    if (!this.isRunning) return;
    
    console.log('⏸️ Pausing automation session');
    showAutomationStatus('⏸️ Automation Paused', 'info');
  }

  // Resume automation session
  resumeSession() {
    if (!this.isRunning) return;
    
    console.log('▶️ Resuming automation session');
    showAutomationStatus('▶️ Automation Resumed', 'success');
  }

  // Test automation functionality
  async testAutomation() {
    console.log('🧪 Testing automation functionality');
    
    try {
      // Test basic automation commands
      const testCommands = [
        { action: 'screenshot', description: 'Taking test screenshot' },
        { action: 'scroll', y: 100, description: 'Testing scroll' }
      ];
      
      for (const command of testCommands) {
        console.log(`🧪 Testing: ${command.description}`);
        await this.executeCommand(command);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between commands
      }
      
      console.log('✅ Automation test completed successfully');
      showAutomationStatus('✅ Test completed successfully', 'success');
      
    } catch (error) {
      console.error('❌ Automation test failed:', error);
      showAutomationStatus('❌ Test failed', 'error');
    }
  }

  // Execute single command
  async executeCommand(command) {
    if (!this.isRunning) {
      console.log('⚠️ No automation session running, ignoring command');
      return;
    }

    try {
      console.log('🎯 Executing command:', command);
      
      let result;
      const startTime = Date.now();
      
      switch (command.action) {
        case 'navigate':
          result = await navigateTo(command.url);
          break;
          
        case 'click':
          result = await clickElement(command.selector);
          break;
          
        case 'type':
          result = await typeText(command.selector, command.text);
          break;
          
        case 'scroll':
          result = await scrollPage(command.y);
          break;
          
        case 'wait':
          await waitForElement(command.selector, command.timeout || 5000);
          result = { success: true, action: 'wait', selector: command.selector };
          break;
          
        case 'getText':
          result = await getElementText(command.selector);
          break;
          
        case 'screenshot':
          result = await takeScreenshot();
          break;
          
        default:
          throw new Error(`Unknown action: ${command.action}`);
      }
      
      const duration = Date.now() - startTime;
      
      // Send success result back to server
      socket.emit('automation:result', {
        status: 'success',
        command,
        result,
        duration,
        timestamp: Date.now()
      });
      
      console.log('✅ Command executed successfully:', result);
      
    } catch (error) {
      console.error('❌ Command execution failed:', error);
      
      // Send error result back to server
      socket.emit('automation:result', {
        status: 'error',
        command,
        error: error.message,
        timestamp: Date.now()
      });
      
      showAutomationStatus(`❌ Error: ${error.message}`, 'error');
    }
  }

  // Execute batch of commands
  async executeBatch(commands) {
    if (!this.isRunning) {
      console.log('⚠️ No automation session running, ignoring batch');
      return;
    }

    console.log('📦 Executing batch of', commands.length, 'commands');
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`🎯 Executing command ${i + 1}/${commands.length}:`, command);
      
      await this.executeCommand(command);
      
      // Small delay between commands
      if (i < commands.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('✅ Batch execution completed');
  }

  // Get current session status
  getStatus() {
    return {
      isRunning: this.isRunning,
      session: this.currentSession,
      queueLength: this.commandQueue.length,
      connected: isConnected
    };
  }

  // Manual command execution (for testing)
  async executeManualCommand(action, params) {
    const command = { action, ...params };
    await this.executeCommand(command);
  }
}

// Create global automation agent instance
const automationAgent = new AutomationAgent();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    automationAgent.init();
  });
} else {
  automationAgent.init();
}

// Export for use in other modules
export default automationAgent;
export { AutomationAgent };
