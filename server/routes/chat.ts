/**
 * Chat API Routes
 * Simple chat interface using unified AI agent
 */

import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import UnifiedAIAgent from '../agents/unified-ai-agent';

const router = Router();
let unifiedAgent: UnifiedAIAgent | null = null;

// Initialize unified AI agent
const initializeUnifiedAgent = async () => {
  if (!unifiedAgent) {
    try {
      unifiedAgent = new UnifiedAIAgent({
        maxConcurrentTasks: 3,
        taskTimeout: 60000,
        retries: 3,
        coordinationStrategy: 'intelligent'
      });
      await unifiedAgent.initialize();
      logger.info('✅ Chat routes initialized with unified AI agent');
    } catch (error) {
      logger.error('❌ Failed to initialize unified AI agent:', error);
      throw error;
    }
  }
  return unifiedAgent;
};

/**
 * POST /api/chat
 * Send message to unified AI agent
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const agent = await initializeUnifiedAgent();
    
    if (!agent) {
      return res.status(500).json({
        success: false,
        error: 'AI agent not available'
      });
    }

    // Create task for unified agent
    const task = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: sessionId || 'default_session',
      message: message,
      timestamp: new Date().toISOString()
    };

    // Process message with unified agent
    const result = await agent.processMessage(task);
    
    logger.info('💬 Chat message processed', {
      sessionId: task.sessionId,
      success: result.success,
      executionTime: result.executionTime
    });

    res.json({
      success: result.success,
      message: result.message,
      actions: result.actions,
      screenshot: result.screenshot,
      confidence: result.confidence,
      reasoning: result.reasoning,
      error: result.error
    });

  } catch (error) {
    logger.error('❌ Chat message processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Get conversation history for a session
 */
router.get('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const agent = await initializeUnifiedAgent();
    
    if (!agent) {
      return res.status(500).json({
        success: false,
        error: 'AI agent not available'
      });
    }

    const history = await agent.getConversationHistory(sessionId);
    
    res.json({
      success: true,
      history: history,
      count: history.length
    });

  } catch (error) {
    logger.error('❌ Failed to get chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
});

/**
 * DELETE /api/chat/history/:sessionId
 * Clear conversation history for a session
 */
router.delete('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const agent = await initializeUnifiedAgent();
    
    if (!agent) {
      return res.status(500).json({
        success: false,
        error: 'AI agent not available'
      });
    }

    await agent.clearConversationHistory(sessionId);
    
    res.json({
      success: true,
      message: 'Conversation history cleared'
    });

  } catch (error) {
    logger.error('❌ Failed to clear chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat history'
    });
  }
});

/**
 * GET /api/chat/status
 * Get unified AI agent status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const agent = await initializeUnifiedAgent();
    
    if (!agent) {
      return res.status(500).json({
        success: false,
        error: 'AI agent not available'
      });
    }

    const status = agent.getStatus();
    const isHealthy = await agent.healthCheck();
    
    res.json({
      success: true,
      healthy: isHealthy,
      status: status,
      capabilities: agent.getCapabilities()
    });

  } catch (error) {
    logger.error('❌ Failed to get agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status'
    });
  }
});

export default router;
