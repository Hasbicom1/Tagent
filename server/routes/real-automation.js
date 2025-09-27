import express from 'express';
import { RealBrowserEngine } from '../automation/real-browser-engine.js';
import { RealAIEngine } from '../ai/real-ai-engine.js';
import { Server } from 'socket.io';

/**
 * REAL AUTOMATION ROUTES
 * No simulations - actual browser automation API
 */
export function createAutomationRoutes(io) {
  const router = express.Router();
  
  // Initialize engines
  const browserEngine = new RealBrowserEngine();
  const aiEngine = new RealAIEngine();
  
  let isInitialized = false;
  
  /**
   * Initialize automation system
   */
  async function initializeAutomation() {
    if (isInitialized) return;
    
    console.log('🚀 REAL AUTOMATION: Initializing automation system...');
    
    try {
      // Initialize AI engine
      await aiEngine.initialize();
      
      // Initialize browser engine
      await browserEngine.initialize();
      
      // Set up event listeners
      browserEngine.on('browserReady', () => {
        console.log('✅ REAL AUTOMATION: Browser ready for automation');
        io.emit('automationStatus', { status: 'ready' });
      });
      
      browserEngine.on('commandExecuted', (data) => {
        console.log('✅ REAL AUTOMATION: Command executed:', data.command);
        io.emit('automationUpdate', {
          type: 'commandExecuted',
          command: data.command,
          result: data.result
        });
      });
      
      browserEngine.on('commandError', (data) => {
        console.error('❌ REAL AUTOMATION: Command failed:', data.command);
        io.emit('automationUpdate', {
          type: 'commandError',
          command: data.command,
          error: data.error.message
        });
      });
      
      aiEngine.on('inputProcessed', (data) => {
        console.log('🧠 REAL AUTOMATION: Input processed:', data.input);
        io.emit('automationUpdate', {
          type: 'inputProcessed',
          input: data.input,
          analysis: data.analysis,
          steps: data.steps
        });
      });
      
      isInitialized = true;
      console.log('✅ REAL AUTOMATION: System initialized successfully');
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * POST /api/automation/execute
   * Execute real browser automation command
   */
  router.post('/execute', async (req, res) => {
    try {
      const { command, userId } = req.body;
      
      if (!command) {
        return res.status(400).json({
          success: false,
          error: 'Command is required'
        });
      }
      
      console.log(`🎯 REAL AUTOMATION: Executing command: "${command}"`);
      
      // Initialize if needed
      if (!isInitialized) {
        await initializeAutomation();
      }
      
      // Process command with AI
      const aiResponse = await aiEngine.processUserInput(command);
      
      // Execute browser automation
      const browserResult = await browserEngine.executeCommand(command);
      
      // Send real-time update
      io.emit('automationUpdate', {
        type: 'executionComplete',
        command,
        aiResponse,
        browserResult,
        timestamp: new Date()
      });
      
      res.json({
        success: true,
        command,
        aiResponse,
        browserResult,
        message: 'Command executed successfully'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Execution failed:', error);
      
      io.emit('automationUpdate', {
        type: 'executionError',
        command: req.body.command,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/automation/process
   * Process user input and get automation steps
   */
  router.post('/process', async (req, res) => {
    try {
      const { input, userId } = req.body;
      
      if (!input) {
        return res.status(400).json({
          success: false,
          error: 'Input is required'
        });
      }
      
      console.log(`🧠 REAL AUTOMATION: Processing input: "${input}"`);
      
      // Initialize if needed
      if (!isInitialized) {
        await initializeAutomation();
      }
      
      // Process with AI engine
      const result = await aiEngine.processUserInput(input);
      
      res.json({
        success: true,
        input,
        result,
        message: 'Input processed successfully'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Processing failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * GET /api/automation/status
   * Get automation system status
   */
  router.get('/status', async (req, res) => {
    try {
      const status = {
        initialized: isInitialized,
        browserActive: browserEngine.isActive,
        aiReady: aiEngine.isInitialized,
        timestamp: new Date()
      };
      
      if (browserEngine.isActive) {
        const pageInfo = await browserEngine.getPageInfo();
        status.currentPage = pageInfo;
      }
      
      res.json({
        success: true,
        status,
        message: 'Automation status retrieved'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Status check failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/automation/screenshot
   * Take screenshot of current browser
   */
  router.post('/screenshot', async (req, res) => {
    try {
      if (!isInitialized || !browserEngine.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Browser not initialized'
        });
      }
      
      console.log('📸 REAL AUTOMATION: Taking screenshot');
      
      const result = await browserEngine.takeScreenshot();
      
      res.json({
        success: true,
        screenshot: result.screenshot,
        message: 'Screenshot captured'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Screenshot failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/automation/navigate
   * Navigate to URL
   */
  router.post('/navigate', async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }
      
      if (!isInitialized || !browserEngine.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Browser not initialized'
        });
      }
      
      console.log(`🌐 REAL AUTOMATION: Navigating to ${url}`);
      
      const result = await browserEngine.navigateTo(url);
      
      // Send real-time update
      io.emit('automationUpdate', {
        type: 'navigationComplete',
        url,
        result
      });
      
      res.json({
        success: true,
        result,
        message: 'Navigation completed'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Navigation failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/automation/click
   * Click on element
   */
  router.post('/click', async (req, res) => {
    try {
      const { selector } = req.body;
      
      if (!selector) {
        return res.status(400).json({
          success: false,
          error: 'Selector is required'
        });
      }
      
      if (!isInitialized || !browserEngine.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Browser not initialized'
        });
      }
      
      console.log(`🖱️ REAL AUTOMATION: Clicking element: ${selector}`);
      
      const result = await browserEngine.clickElement(selector);
      
      // Send real-time update
      io.emit('automationUpdate', {
        type: 'clickComplete',
        selector,
        result
      });
      
      res.json({
        success: true,
        result,
        message: 'Click completed'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Click failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/automation/type
   * Type text into element
   */
  router.post('/type', async (req, res) => {
    try {
      const { selector, text } = req.body;
      
      if (!selector || !text) {
        return res.status(400).json({
          success: false,
          error: 'Selector and text are required'
        });
      }
      
      if (!isInitialized || !browserEngine.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Browser not initialized'
        });
      }
      
      console.log(`⌨️ REAL AUTOMATION: Typing "${text}" into ${selector}`);
      
      const result = await browserEngine.typeText(selector, text);
      
      // Send real-time update
      io.emit('automationUpdate', {
        type: 'typeComplete',
        selector,
        text,
        result
      });
      
      res.json({
        success: true,
        result,
        message: 'Type completed'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Type failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * POST /api/automation/search
   * Perform search
   */
  router.post('/search', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        });
      }
      
      if (!isInitialized || !browserEngine.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Browser not initialized'
        });
      }
      
      console.log(`🔍 REAL AUTOMATION: Searching for "${query}"`);
      
      const result = await browserEngine.performSearch(query);
      
      // Send real-time update
      io.emit('automationUpdate', {
        type: 'searchComplete',
        query,
        result
      });
      
      res.json({
        success: true,
        result,
        message: 'Search completed'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: Search failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * GET /api/automation/history
   * Get command history
   */
  router.get('/history', async (req, res) => {
    try {
      const history = aiEngine.getCommandHistory();
      
      res.json({
        success: true,
        history,
        message: 'History retrieved'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: History retrieval failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  /**
   * DELETE /api/automation/history
   * Clear command history
   */
  router.delete('/history', async (req, res) => {
    try {
      aiEngine.clearHistory();
      
      res.json({
        success: true,
        message: 'History cleared'
      });
      
    } catch (error) {
      console.error('❌ REAL AUTOMATION: History clear failed:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  return router;
}
