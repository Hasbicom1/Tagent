import { Request, Response } from 'express';
import { pool } from './db';
import { logger } from './logger';
import { wsManager } from './websocket';
import { getQueueStats } from './queue';
import { getRedisMonitoring } from './redis-monitoring';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  responseTime: number;
  checks: {
    database: 'healthy' | 'unhealthy';
    memory: 'healthy' | 'unhealthy';
    redis?: 'healthy' | 'unhealthy';
    websocket: 'healthy' | 'unhealthy';
    queue: 'healthy' | 'unhealthy';
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    wsConnections: number;
    queueStats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      total: number;
    };
  };
  version: string;
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: 0, // Will be calculated at the end
    checks: {
      database: 'unhealthy',
      memory: 'healthy',
      websocket: 'healthy',
      queue: 'healthy'
    },
    metrics: {
      memoryUsage: process.memoryUsage(),
      wsConnections: 0,
      queueStats: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0
      }
    },
    version: process.env.npm_package_version || '1.0.0'
  };

  // Database health check
  try {
    await pool.query('SELECT 1');
    health.checks.database = 'healthy';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    health.checks.database = 'unhealthy';
    health.status = 'unhealthy';
  }

  // PRODUCTION OPTIMIZATION: Enhanced health checks with real metrics
  
  // Memory health check with detailed metrics
  const memUsage = process.memoryUsage();
  health.metrics.memoryUsage = memUsage;
  const memUsageMB = memUsage.heapUsed / 1024 / 1024;
  if (memUsageMB > 500) { // Alert if using more than 500MB
    health.checks.memory = 'unhealthy';
    health.status = 'unhealthy';
  }

  // WebSocket health check
  try {
    if (wsManager && typeof wsManager.getStats === 'function') {
      const wsStats = wsManager.getStats();
      health.metrics.wsConnections = wsStats.totalConnections;
      health.checks.websocket = 'healthy';
      
      // Consider unhealthy if too many connections
      if (wsStats.totalConnections > 1000) {
        health.checks.websocket = 'unhealthy';
        health.status = 'unhealthy';
      }
    } else {
      console.log('wsManager not available or getStats not a function');
      health.checks.websocket = 'unhealthy';
    }
  } catch (error) {
    console.error('WebSocket health check error:', error);
    logger.error({ error }, 'WebSocket health check failed');
    health.checks.websocket = 'unhealthy';
    health.status = 'unhealthy';
  }

  // Queue health check
  try {
    const queueStats = await getQueueStats();
    health.metrics.queueStats = queueStats;
    health.checks.queue = 'healthy';
    
    // Consider unhealthy if too many failed jobs
    if (queueStats.failed > 100) {
      health.checks.queue = 'unhealthy';
      health.status = 'unhealthy';
    }
  } catch (error) {
    console.error('Queue health check error:', error);
    logger.error({ error }, 'Queue health check failed');
    health.checks.queue = 'unhealthy';
    health.status = 'unhealthy';
  }

  // Redis health check with monitoring integration
  try {
    const redisMonitoring = getRedisMonitoring();
    if (redisMonitoring) {
      const redisHealth = redisMonitoring.getHealthStatus();
      health.checks.redis = redisHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
      
      if (redisHealth.status !== 'healthy') {
        health.status = 'unhealthy';
      }
      
      // Add Redis metrics to health response
      (health.metrics as any).redis = {
        connectionStatus: redisHealth.metrics.connectionStatus,
        responseTime: redisHealth.metrics.responseTime,
        memoryUsage: redisHealth.metrics.memoryUsage,
        connectedClients: redisHealth.metrics.connectedClients,
        errorCount: redisHealth.metrics.errorCount,
        uptime: redisHealth.metrics.uptime
      };
    } else {
      health.checks.redis = 'unhealthy';
      health.status = 'unhealthy';
    }
  } catch (error) {
    console.error('Redis health check error:', error);
    logger.error({ error }, 'Redis health check failed');
    health.checks.redis = 'unhealthy';
    health.status = 'unhealthy';
  }

  // PRODUCTION OPTIMIZATION: Calculate and include response time in health data
  const responseTime = Date.now() - startTime;
  health.responseTime = responseTime;
  
  logger.info({
    health,
    responseTime: `${responseTime}ms`
  }, 'Health check completed');

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
}

// Liveness probe (basic check)
export function livenessCheck(req: Request, res: Response): void {
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString() 
  });
}

// Readiness probe (full check)
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  await healthCheck(req, res);
}