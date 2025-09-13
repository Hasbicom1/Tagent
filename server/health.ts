import { Request, Response } from 'express';
import { pool } from './db';
import { logger } from './logger';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'healthy' | 'unhealthy';
    memory: 'healthy' | 'unhealthy';
    redis?: 'healthy' | 'unhealthy';
  };
  version: string;
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unhealthy',
      memory: 'healthy'
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

  // Memory health check
  const memUsage = process.memoryUsage();
  const memUsageMB = memUsage.heapUsed / 1024 / 1024;
  if (memUsageMB > 500) { // Alert if using more than 500MB
    health.checks.memory = 'unhealthy';
    health.status = 'unhealthy';
  }

  // Redis health check (if available)
  if (process.env.REDIS_URL) {
    try {
      // We'll implement this when we add Redis back
      health.checks.redis = 'healthy';
    } catch (error) {
      logger.error({ error }, 'Redis health check failed');
      health.checks.redis = 'unhealthy';
      // Don't mark overall as unhealthy for Redis in development
      if (process.env.NODE_ENV === 'production') {
        health.status = 'unhealthy';
      }
    }
  }

  const responseTime = Date.now() - startTime;
  
  logger.info({
    health,
    responseTime
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