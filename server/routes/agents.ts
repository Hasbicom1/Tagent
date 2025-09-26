/**
 * Agents API Routes
 * Provides endpoints for managing and selecting AI agents
 */

import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import LocalAgentManager from '../agents/local-agent-manager';

const router = Router();
let localAgentManager: LocalAgentManager | null = null;

// Initialize local agent manager
const initializeAgentManager = async () => {
  if (!localAgentManager) {
    try {
      localAgentManager = new LocalAgentManager();
      await localAgentManager.initialize();
      logger.info('✅ Local Agent Manager initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Local Agent Manager:', error);
    }
  }
  return localAgentManager;
};

/**
 * GET /api/agents
 * Get all available agents
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const agentManager = await initializeAgentManager();
    
    if (!agentManager) {
      return res.status(500).json({
        error: 'Agent manager not available',
        agents: []
      });
    }

    const agents = agentManager.getAvailableAgents();
    
    logger.info('📋 Agents requested', {
      count: agents.length,
      agents: agents.map(a => a.name)
    });

    res.json({
      success: true,
      agents: agents,
      total: agents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get agents:', error);
    res.status(500).json({
      error: 'Failed to get agents',
      agents: []
    });
  }
});

/**
 * GET /api/agents/:id
 * Get specific agent details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentManager = await initializeAgentManager();
    
    if (!agentManager) {
      return res.status(500).json({
        error: 'Agent manager not available'
      });
    }

    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get agent:', error);
    res.status(500).json({
      error: 'Failed to get agent'
    });
  }
});

/**
 * POST /api/agents/:id/test
 * Test a specific agent
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { instruction } = req.body;
    
    const agentManager = await initializeAgentManager();
    
    if (!agentManager) {
      return res.status(500).json({
        error: 'Agent manager not available'
      });
    }

    const agent = agentManager.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found'
      });
    }

    // Create test task
    const testTask = {
      id: `test_${Date.now()}`,
      sessionId: 'test_session',
      instruction: instruction || 'Test agent functionality',
      context: { test: true }
    };

    // Execute test
    const result = await agentManager.executeTask(testTask, id);
    
    logger.info('🧪 Agent test completed', {
      agent: agent.name,
      success: result.success,
      executionTime: result.executionTime
    });

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Agent test failed:', error);
    res.status(500).json({
      error: 'Agent test failed',
      details: error instanceof Error ? error.message : 'unknown error'
    });
  }
});

/**
 * GET /api/agents/health
 * Health check for all agents
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const agentManager = await initializeAgentManager();
    
    if (!agentManager) {
      return res.status(500).json({
        error: 'Agent manager not available',
        healthy: false
      });
    }

    const isHealthy = await agentManager.healthCheck();
    const agents = agentManager.getAvailableAgents();
    
    res.json({
      success: true,
      healthy: isHealthy,
      agents: agents.length,
      availableAgents: agents.map(a => a.name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Agent health check failed:', error);
    res.status(500).json({
      error: 'Health check failed',
      healthy: false
    });
  }
});

/**
 * POST /api/agents/select
 * Select best agent for a task
 */
router.post('/select', async (req: Request, res: Response) => {
  try {
    const { instruction, context } = req.body;
    
    if (!instruction) {
      return res.status(400).json({
        error: 'Instruction is required'
      });
    }

    const agentManager = await initializeAgentManager();
    
    if (!agentManager) {
      return res.status(500).json({
        error: 'Agent manager not available'
      });
    }

    // Create task for agent selection
    const task = {
      id: `select_${Date.now()}`,
      sessionId: 'selection_session',
      instruction,
      context: context || {}
    };

    // Let the agent manager select the best agent
    const result = await agentManager.executeTask(task);
    
    logger.info('🎯 Agent selected', {
      selectedAgent: result.agent,
      confidence: result.confidence,
      instruction
    });

    res.json({
      success: true,
      selectedAgent: result.agent,
      confidence: result.confidence,
      reasoning: result.reasoning,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Agent selection failed:', error);
    res.status(500).json({
      error: 'Agent selection failed',
      details: error instanceof Error ? error.message : 'unknown error'
    });
  }
});

export default router;
