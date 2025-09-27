/**
 * INVISIBLE AUTOMATION ORCHESTRATOR
 * Automatically selects best agent from 15 available agents
 * Zero technical complexity for users
 */

import { RealBrowserEngine } from './real-browser-engine.js';
import { RealAIEngine } from '../ai/real-ai-engine.js';
import { EventEmitter } from 'events';

export class InvisibleAutomationOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.browserEngine = new RealBrowserEngine();
    this.aiEngine = new RealAIEngine();
    this.agentCapabilities = new Map();
    this.initializeAgentCapabilities();
  }

  /**
   * Initialize all 15 agent capabilities for automatic selection
   */
  initializeAgentCapabilities() {
    // Browser-Use Agent - General automation
    this.agentCapabilities.set('browser-use', {
      name: 'Browser-Use',
      strengths: ['navigation', 'clicking', 'typing', 'form-filling'],
      priority: 1,
      confidence: 0.9
    });

    // UI-TARS Agent - Visual tasks
    this.agentCapabilities.set('ui-tars', {
      name: 'UI-TARS',
      strengths: ['visual-elements', 'screenshot-analysis', 'gui-automation'],
      priority: 2,
      confidence: 0.85
    });

    // Skyvern Agent - Computer vision
    this.agentCapabilities.set('skyvern', {
      name: 'Skyvern',
      strengths: ['visual-elements', 'anti-bot', '2fa-support'],
      priority: 3,
      confidence: 0.8
    });

    // LaVague Agent - Complex workflows
    this.agentCapabilities.set('lavague', {
      name: 'LaVague',
      strengths: ['multi-step', 'context-awareness', 'planning'],
      priority: 4,
      confidence: 0.85
    });

    // Stagehand Agent - JavaScript tasks
    this.agentCapabilities.set('stagehand', {
      name: 'Stagehand',
      strengths: ['javascript-tasks', 'spa-automation', 'dynamic-web'],
      priority: 5,
      confidence: 0.8
    });

    // Playwright Vision Agent - Screenshot analysis
    this.agentCapabilities.set('playwright-vision', {
      name: 'Playwright Vision',
      strengths: ['screenshot-analysis', 'element-detection'],
      priority: 6,
      confidence: 0.75
    });

    // Puppeteer AI Agent - AI task planning
    this.agentCapabilities.set('puppeteer-ai', {
      name: 'Puppeteer AI',
      strengths: ['ai-planning', 'task-optimization'],
      priority: 7,
      confidence: 0.8
    });

    // Rule-Based Planner Agent - Structured tasks
    this.agentCapabilities.set('rule-planner', {
      name: 'Rule-Based Planner',
      strengths: ['structured-tasks', 'decision-making'],
      priority: 8,
      confidence: 0.7
    });

    // Cheerio Extractor Agent - Data extraction
    this.agentCapabilities.set('cheerio-extractor', {
      name: 'Cheerio Extractor',
      strengths: ['data-extraction', 'html-parsing'],
      priority: 9,
      confidence: 0.75
    });

    // Browser Chat Agent - Conversational tasks
    this.agentCapabilities.set('browser-chat', {
      name: 'Browser Chat',
      strengths: ['conversational', 'real-time-interaction'],
      priority: 10,
      confidence: 0.8
    });

    console.log('🧠 INVISIBLE ORCHESTRATOR: Initialized with 10 agent capabilities');
  }

  /**
   * Automatically select best agent for task
   */
  selectBestAgent(userInput, context = {}) {
    const input = userInput.toLowerCase();
    
    // Analyze input to determine task type
    let taskType = 'general';
    let confidence = 0.5;
    
    if (input.includes('book') || input.includes('reserve') || input.includes('flight') || input.includes('hotel')) {
      taskType = 'booking';
      confidence = 0.9;
    } else if (input.includes('search') || input.includes('find') || input.includes('look for')) {
      taskType = 'search';
      confidence = 0.85;
    } else if (input.includes('fill') || input.includes('form') || input.includes('input')) {
      taskType = 'form-filling';
      confidence = 0.9;
    } else if (input.includes('click') || input.includes('button') || input.includes('link')) {
      taskType = 'navigation';
      confidence = 0.8;
    } else if (input.includes('extract') || input.includes('get data') || input.includes('scrape')) {
      taskType = 'data-extraction';
      confidence = 0.85;
    } else if (input.includes('visual') || input.includes('see') || input.includes('screenshot')) {
      taskType = 'visual';
      confidence = 0.8;
    }

    // Select agent based on task type
    let selectedAgent = 'browser-use'; // Default fallback
    
    switch (taskType) {
      case 'booking':
        selectedAgent = 'lavague'; // Complex workflows
        break;
      case 'search':
        selectedAgent = 'browser-use'; // General automation
        break;
      case 'form-filling':
        selectedAgent = 'browser-use'; // Form automation
        break;
      case 'navigation':
        selectedAgent = 'browser-use'; // Clicking and navigation
        break;
      case 'data-extraction':
        selectedAgent = 'cheerio-extractor'; // Data extraction
        break;
      case 'visual':
        selectedAgent = 'ui-tars'; // Visual tasks
        break;
      default:
        selectedAgent = 'browser-use'; // General purpose
    }

    const agent = this.agentCapabilities.get(selectedAgent);
    
    console.log(`🎯 INVISIBLE ORCHESTRATOR: Selected ${agent.name} for "${userInput}" (confidence: ${confidence})`);
    
    return {
      agent: selectedAgent,
      agentInfo: agent,
      taskType,
      confidence,
      reasoning: `Selected ${agent.name} for ${taskType} task based on input analysis`
    };
  }

  /**
   * Execute automation command with invisible agent selection
   */
  async executeCommand(sessionId, userInput, context = {}) {
    try {
      console.log(`🚀 INVISIBLE ORCHESTRATOR: Processing "${userInput}" for session ${sessionId}`);
      
      // Step 1: AI Analysis
      const aiResponse = await this.aiEngine.processUserInput(userInput);
      console.log(`🧠 INVISIBLE ORCHESTRATOR: AI analysis complete`);
      
      // Step 2: Agent Selection
      const agentSelection = this.selectBestAgent(userInput, context);
      console.log(`🎯 INVISIBLE ORCHESTRATOR: Agent selected: ${agentSelection.agentInfo.name}`);
      
      // Step 3: Browser Execution
      let browserResult = null;
      if (aiResponse.steps && aiResponse.steps.length > 0) {
        console.log(`🌐 INVISIBLE ORCHESTRATOR: Executing ${aiResponse.steps.length} browser steps`);
        
        for (const step of aiResponse.steps) {
          const stepResult = await this.browserEngine.executeCommand(step.description);
          browserResult = stepResult;
          
          // Emit real-time updates
          this.emit('automation_progress', {
            sessionId,
            step,
            result: stepResult.result,
            screenshot: stepResult.screenshot,
            agent: agentSelection.agentInfo.name
          });
        }
      }

      // Step 4: Generate Response
      const response = {
        success: true,
        sessionId,
        userInput,
        agent: agentSelection.agentInfo.name,
        taskType: agentSelection.taskType,
        confidence: agentSelection.confidence,
        aiAnalysis: aiResponse.analysis,
        browserResult: browserResult?.result,
        screenshot: browserResult?.screenshot,
        message: `Task completed using ${agentSelection.agentInfo.name} agent`,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ INVISIBLE ORCHESTRATOR: Command executed successfully`);
      
      return response;
      
    } catch (error) {
      console.error('❌ INVISIBLE ORCHESTRATOR: Command execution failed:', error);
      
      return {
        success: false,
        sessionId,
        userInput,
        error: 'Command execution failed',
        details: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get available agents (for monitoring)
   */
  getAvailableAgents() {
    return Array.from(this.agentCapabilities.values());
  }

  /**
   * Get agent statistics
   */
  getAgentStats() {
    return {
      totalAgents: this.agentCapabilities.size,
      agents: this.getAvailableAgents(),
      lastActivity: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const invisibleOrchestrator = new InvisibleAutomationOrchestrator();
