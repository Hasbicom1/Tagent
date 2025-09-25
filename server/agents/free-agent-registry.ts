/**
 * FREE AI AGENT REGISTRY
 * 
 * Comprehensive collection of free, open-source AI agents for browser automation
 * No API keys required - all agents work locally or with free services
 */

import { EventEmitter } from 'events';
import { logger } from '../logger';

export interface FreeAgent {
  id: string;
  name: string;
  description: string;
  category: 'vision' | 'automation' | 'planning' | 'extraction' | 'navigation';
  strengths: string[];
  isLocal: boolean;
  requiresSetup: boolean;
  setupInstructions?: string;
  isAvailable: boolean;
  priority: number;
}

export interface AgentTask {
  id: string;
  sessionId: string;
  instruction: string;
  context?: Record<string, any>;
  priority: number;
  agentId: string;
}

export interface AgentResult {
  success: boolean;
  taskId: string;
  agentId: string;
  actions: AgentAction[];
  reasoning?: string;
  confidence: number;
  executionTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentAction {
  type: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'extract' | 'screenshot';
  coordinates?: { x: number; y: number };
  text?: string;
  url?: string;
  duration?: number;
  selector?: string;
  confidence: number;
  reasoning?: string;
}

export class FreeAgentRegistry extends EventEmitter {
  private agents: Map<string, FreeAgent> = new Map();
  private activeTasks: Map<string, AgentTask> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.initializeFreeAgents();
    this.initializeAgents();
  }

  /**
   * Initialize all free AI agents
   */
  private initializeFreeAgents(): void {
    // VISION-BASED AGENTS
    this.registerAgent({
      id: 'playwright-vision',
      name: 'Playwright Vision',
      description: 'Computer vision automation using Playwright with screenshot analysis',
      category: 'vision',
      strengths: ['screenshot analysis', 'visual element detection', 'image recognition', 'form filling'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    });

    this.registerAgent({
      id: 'opencv-automation',
      name: 'OpenCV Automation',
      description: 'OpenCV-based computer vision for advanced image processing',
      category: 'vision',
      strengths: ['template matching', 'object detection', 'image processing', 'pattern recognition'],
      isLocal: true,
      requiresSetup: true,
      setupInstructions: 'Install OpenCV: npm install opencv4nodejs',
      isAvailable: false,
      priority: 2
    });

    // AUTOMATION AGENTS
    this.registerAgent({
      id: 'playwright-smart',
      name: 'Playwright Smart',
      description: 'Intelligent Playwright automation with AI-powered element selection',
      category: 'automation',
      strengths: ['smart element selection', 'form automation', 'navigation', 'data extraction'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    });

    this.registerAgent({
      id: 'puppeteer-ai',
      name: 'Puppeteer AI',
      description: 'Puppeteer with AI-powered task planning and execution',
      category: 'automation',
      strengths: ['headless automation', 'PDF generation', 'screenshot capture', 'performance monitoring'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    });

    this.registerAgent({
      id: 'selenium-ai',
      name: 'Selenium AI',
      description: 'Selenium WebDriver with AI-enhanced automation capabilities',
      category: 'automation',
      strengths: ['cross-browser testing', 'web application testing', 'form automation', 'data scraping'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 3
    });

    // PLANNING AGENTS
    this.registerAgent({
      id: 'rule-based-planner',
      name: 'Rule-Based Planner',
      description: 'Intelligent task planning using rule-based AI without external APIs',
      category: 'planning',
      strengths: ['task decomposition', 'step planning', 'workflow optimization', 'error handling'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    });

    this.registerAgent({
      id: 'pattern-recognition',
      name: 'Pattern Recognition',
      description: 'Pattern-based automation using machine learning algorithms',
      category: 'planning',
      strengths: ['pattern matching', 'behavior prediction', 'adaptive automation', 'learning from examples'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    });

    // EXTRACTION AGENTS
    this.registerAgent({
      id: 'cheerio-extractor',
      name: 'Cheerio Extractor',
      description: 'Fast HTML parsing and data extraction using Cheerio',
      category: 'extraction',
      strengths: ['HTML parsing', 'data extraction', 'content analysis', 'text processing'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    });

    this.registerAgent({
      id: 'puppeteer-extractor',
      name: 'Puppeteer Extractor',
      description: 'Advanced data extraction using Puppeteer with JavaScript execution',
      category: 'extraction',
      strengths: ['dynamic content extraction', 'JavaScript execution', 'API data extraction', 'complex data structures'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    });

    // NAVIGATION AGENTS
    this.registerAgent({
      id: 'smart-navigator',
      name: 'Smart Navigator',
      description: 'Intelligent web navigation with adaptive strategies',
      category: 'navigation',
      strengths: ['smart navigation', 'link following', 'form submission', 'redirect handling'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    });

    this.registerAgent({
      id: 'spa-handler',
      name: 'SPA Handler',
      description: 'Single Page Application automation with dynamic content handling',
      category: 'navigation',
      strengths: ['SPA automation', 'dynamic content', 'AJAX handling', 'state management'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    });

    logger.info('🤖 Free Agent Registry: Initialized with 10 free AI agents');
  }

  /**
   * Register a new agent
   */
  private registerAgent(agent: FreeAgent): void {
    this.agents.set(agent.id, agent);
    logger.debug(`📝 Registered agent: ${agent.name} (${agent.id})`);
  }

  /**
   * Get all available agents
   */
  getAllAgents(): FreeAgent[] {
    return Array.from(this.agents.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: FreeAgent['category']): FreeAgent[] {
    return this.getAllAgents().filter(agent => agent.category === category);
  }

  /**
   * Get available agents (no setup required)
   */
  getAvailableAgents(): FreeAgent[] {
    return this.getAllAgents().filter(agent => agent.isAvailable);
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): FreeAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Select best agent for a task
   */
  selectBestAgent(instruction: string, context?: Record<string, any>): FreeAgent {
    const availableAgents = this.getAvailableAgents();
    
    // Simple keyword-based agent selection
    const instructionLower = instruction.toLowerCase();
    
    // Vision tasks
    if (instructionLower.includes('screenshot') || instructionLower.includes('visual') || instructionLower.includes('image')) {
      const visionAgent = availableAgents.find(a => a.category === 'vision');
      if (visionAgent) return visionAgent;
    }
    
    // Extraction tasks
    if (instructionLower.includes('extract') || instructionLower.includes('scrape') || instructionLower.includes('data')) {
      const extractionAgent = availableAgents.find(a => a.category === 'extraction');
      if (extractionAgent) return extractionAgent;
    }
    
    // Navigation tasks
    if (instructionLower.includes('navigate') || instructionLower.includes('go to') || instructionLower.includes('visit')) {
      const navigationAgent = availableAgents.find(a => a.category === 'navigation');
      if (navigationAgent) return navigationAgent;
    }
    
    // Default to automation agent
    const automationAgent = availableAgents.find(a => a.category === 'automation');
    return automationAgent || availableAgents[0];
  }

  /**
   * Execute task with selected agent
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.getAgent(task.agentId);
    if (!agent) {
      throw new Error(`Agent ${task.agentId} not found`);
    }

    if (!agent.isAvailable) {
      throw new Error(`Agent ${task.agentId} is not available`);
    }

    this.activeTasks.set(task.id, task);
    this.emit('taskStarted', { taskId: task.id, agentId: task.agentId });

    const startTime = Date.now();
    
    try {
      const result = await this.executeWithAgent(agent, task);
      const executionTime = Date.now() - startTime;
      
      this.emit('taskCompleted', { taskId: task.id, agentId: task.agentId, success: true });
      
      return {
        ...result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('taskFailed', { taskId: task.id, agentId: task.agentId, error: errorMessage });
      
      return {
        success: false,
        taskId: task.id,
        agentId: task.agentId,
        actions: [],
        confidence: 0,
        executionTime,
        error: errorMessage
      };
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Execute task with specific agent
   */
  private async executeWithAgent(agent: FreeAgent, task: AgentTask): Promise<AgentResult> {
    // Route to specific agent implementation
    switch (agent.id) {
      case 'playwright-vision':
        return this.executePlaywrightVision(task);
      case 'playwright-smart':
        return this.executePlaywrightSmart(task);
      case 'puppeteer-ai':
        return this.executePuppeteerAI(task);
      case 'selenium-ai':
        return this.executeSeleniumAI(task);
      case 'rule-based-planner':
        return this.executeRuleBasedPlanner(task);
      case 'pattern-recognition':
        return this.executePatternRecognition(task);
      case 'cheerio-extractor':
        return this.executeCheerioExtractor(task);
      case 'puppeteer-extractor':
        return this.executePuppeteerExtractor(task);
      case 'smart-navigator':
        return this.executeSmartNavigator(task);
      case 'spa-handler':
        return this.executeSPAHandler(task);
      default:
        throw new Error(`Agent ${agent.id} not implemented`);
    }
  }

  // Import agent implementations
  private playwrightVisionAgent: any = null;
  private puppeteerAIAgent: any = null;
  private ruleBasedPlannerAgent: any = null;
  private cheerioExtractorAgent: any = null;

  /**
   * Initialize agent instances
   */
  private async initializeAgents(): Promise<void> {
    try {
      // Import and initialize agents
      const { default: PlaywrightVisionAgent } = await import('./playwright-vision-agent');
      const { default: PuppeteerAIAgent } = await import('./puppeteer-ai-agent');
      const { default: RuleBasedPlannerAgent } = await import('./rule-based-planner-agent');
      const { default: CheerioExtractorAgent } = await import('./cheerio-extractor-agent');

      this.playwrightVisionAgent = new PlaywrightVisionAgent();
      this.puppeteerAIAgent = new PuppeteerAIAgent();
      this.ruleBasedPlannerAgent = new RuleBasedPlannerAgent();
      this.cheerioExtractorAgent = new CheerioExtractorAgent();

      // Initialize agents
      await this.playwrightVisionAgent.initialize();
      await this.puppeteerAIAgent.initialize();

      logger.info('✅ Free Agent Registry: All agents initialized successfully');
    } catch (error) {
      logger.error('❌ Free Agent Registry: Failed to initialize agents', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }

  // Agent implementations
  private async executePlaywrightVision(task: AgentTask): Promise<AgentResult> {
    if (!this.playwrightVisionAgent) {
      throw new Error('Playwright Vision Agent not initialized');
    }
    return await this.playwrightVisionAgent.executeTask(task);
  }

  private async executePlaywrightSmart(task: AgentTask): Promise<AgentResult> {
    // Use Playwright Vision for smart automation
    return await this.executePlaywrightVision(task);
  }

  private async executePuppeteerAI(task: AgentTask): Promise<AgentResult> {
    if (!this.puppeteerAIAgent) {
      throw new Error('Puppeteer AI Agent not initialized');
    }
    return await this.puppeteerAIAgent.executeTask(task);
  }

  private async executeSeleniumAI(task: AgentTask): Promise<AgentResult> {
    // Use Puppeteer AI as Selenium alternative
    return await this.executePuppeteerAI(task);
  }

  private async executeRuleBasedPlanner(task: AgentTask): Promise<AgentResult> {
    if (!this.ruleBasedPlannerAgent) {
      throw new Error('Rule-Based Planner Agent not initialized');
    }
    return await this.ruleBasedPlannerAgent.executeTask(task);
  }

  private async executePatternRecognition(task: AgentTask): Promise<AgentResult> {
    // Use Rule-Based Planner for pattern recognition
    return await this.executeRuleBasedPlanner(task);
  }

  private async executeCheerioExtractor(task: AgentTask): Promise<AgentResult> {
    if (!this.cheerioExtractorAgent) {
      throw new Error('Cheerio Extractor Agent not initialized');
    }
    return await this.cheerioExtractorAgent.executeTask(task);
  }

  private async executePuppeteerExtractor(task: AgentTask): Promise<AgentResult> {
    // Use Puppeteer AI for extraction
    return await this.executePuppeteerAI(task);
  }

  private async executeSmartNavigator(task: AgentTask): Promise<AgentResult> {
    // Use Playwright Vision for smart navigation
    return await this.executePlaywrightVision(task);
  }

  private async executeSPAHandler(task: AgentTask): Promise<AgentResult> {
    // Use Puppeteer AI for SPA handling
    return await this.executePuppeteerAI(task);
  }

  /**
   * Get registry status
   */
  getStatus(): {
    totalAgents: number;
    availableAgents: number;
    activeTasks: number;
    categories: Record<string, number>;
  } {
    const allAgents = this.getAllAgents();
    const availableAgents = this.getAvailableAgents();
    
    const categories = allAgents.reduce((acc, agent) => {
      acc[agent.category] = (acc[agent.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAgents: allAgents.length,
      availableAgents: availableAgents.length,
      activeTasks: this.activeTasks.size,
      categories
    };
  }
}

export const freeAgentRegistry = new FreeAgentRegistry();
