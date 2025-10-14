/**
 * REDIS METRICS API ROUTES
 * 
 * Provides detailed Redis monitoring and metrics endpoints
 * for production monitoring and debugging.
 */

import { Router, Request, Response } from 'express';
import { getRedisMonitoring } from '../redis-monitoring';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/redis/metrics
 * Returns comprehensive Redis metrics and health status
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const redisMonitoring = getRedisMonitoring();
    
    if (!redisMonitoring) {
      return res.status(503).json({
        error: 'Redis monitoring service not available',
        status: 'unavailable',
        timestamp: new Date().toISOString()
      });
    }

    const healthStatus = redisMonitoring.getHealthStatus();
    const metrics = redisMonitoring.getMetrics();

    const response = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      metrics: {
        connection: {
          status: metrics.connectionStatus,
          lastPing: new Date(metrics.lastPing).toISOString(),
          responseTime: metrics.responseTime,
          uptime: metrics.uptime
        },
        performance: {
          memoryUsage: metrics.memoryUsage,
          connectedClients: metrics.connectedClients,
          commandsProcessed: metrics.commandsProcessed,
          keyspaceHits: metrics.keyspaceHits,
          keyspaceMisses: metrics.keyspaceMisses,
          hitRate: metrics.keyspaceHits + metrics.keyspaceMisses > 0 
            ? (metrics.keyspaceHits / (metrics.keyspaceHits + metrics.keyspaceMisses) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        errors: {
          errorCount: metrics.errorCount,
          lastError: metrics.lastError || null
        }
      },
      alerts: {
        highResponseTime: metrics.responseTime > 1000,
        highErrorCount: metrics.errorCount > 10,
        connectionIssues: metrics.connectionStatus !== 'connected'
      }
    };

    res.json(response);
    
  } catch (error) {
    logger.error('Failed to get Redis metrics', { error: error instanceof Error ? error.message : error });
    res.status(500).json({
      error: 'Failed to retrieve Redis metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/redis/health
 * Returns simplified Redis health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const redisMonitoring = getRedisMonitoring();
    
    if (!redisMonitoring) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Redis monitoring service not available',
        timestamp: new Date().toISOString()
      });
    }

    const healthStatus = redisMonitoring.getHealthStatus();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      responseTime: healthStatus.metrics.responseTime,
      connectionStatus: healthStatus.metrics.connectionStatus,
      uptime: healthStatus.metrics.uptime
    });
    
  } catch (error) {
    logger.error('Failed to get Redis health', { error: error instanceof Error ? error.message : error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve Redis health status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/redis/test
 * Tests Redis connection and returns result
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const redisMonitoring = getRedisMonitoring();
    
    if (!redisMonitoring) {
      return res.status(503).json({
        success: false,
        message: 'Redis monitoring service not available',
        timestamp: new Date().toISOString()
      });
    }

    const startTime = Date.now();
    const isConnected = await redisMonitoring.testConnection();
    const responseTime = Date.now() - startTime;

    res.json({
      success: isConnected,
      responseTime,
      message: isConnected ? 'Redis connection successful' : 'Redis connection failed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to test Redis connection', { error: error instanceof Error ? error.message : error });
    res.status(500).json({
      success: false,
      message: 'Failed to test Redis connection',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/redis/dashboard
 * Returns formatted data for monitoring dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const redisMonitoring = getRedisMonitoring();
    
    if (!redisMonitoring) {
      return res.status(503).json({
        error: 'Redis monitoring service not available'
      });
    }

    const healthStatus = redisMonitoring.getHealthStatus();
    const metrics = redisMonitoring.getMetrics();

    // Format data for dashboard consumption
    const dashboardData = {
      overview: {
        status: healthStatus.status,
        uptime: `${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m`,
        responseTime: `${metrics.responseTime}ms`,
        memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`
      },
      metrics: {
        connections: metrics.connectedClients,
        commands: metrics.commandsProcessed,
        hitRate: metrics.keyspaceHits + metrics.keyspaceMisses > 0 
          ? ((metrics.keyspaceHits / (metrics.keyspaceHits + metrics.keyspaceMisses)) * 100).toFixed(1)
          : '0',
        errors: metrics.errorCount
      },
      alerts: [
        ...(metrics.responseTime > 1000 ? [{ type: 'warning', message: 'High response time detected' }] : []),
        ...(metrics.errorCount > 10 ? [{ type: 'error', message: 'High error count detected' }] : []),
        ...(metrics.connectionStatus !== 'connected' ? [{ type: 'critical', message: 'Redis connection issues' }] : [])
      ],
      timestamp: new Date().toISOString()
    };

    res.json(dashboardData);
    
  } catch (error) {
    logger.error('Failed to get Redis dashboard data', { error: error instanceof Error ? error.message : error });
    res.status(500).json({
      error: 'Failed to retrieve dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;