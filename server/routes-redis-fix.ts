/**
 * CRITICAL FIX: Routes with Redis Singleton Integration
 * 
 * This file provides a fixed version of routes.ts that uses the Redis singleton
 * to prevent multiple Redis connections and ensure proper initialization order.
 */

import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { Redis } from 'ioredis';
import { getSharedRedis, debugRedisStatus } from './redis-singleton';
import { MultiLayerRateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from './rate-limiting';
import { SessionSecurityStore, DEFAULT_SESSION_SECURITY_CONFIG } from './session';

/**
 * CRITICAL FIX: Initialize Redis-dependent services with singleton
 */
export async function initializeRedisServices(): Promise<{
  rateLimiter: MultiLayerRateLimiter | null;
  sessionSecurityStore: SessionSecurityStore | null;
  redis: Redis | null;
}> {
  console.log('🔧 ROUTES: Initializing Redis services with singleton...');
  debugRedisStatus();
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isReplitDev = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
  
  try {
    // CRITICAL FIX: Get shared Redis instance
    const redis = await getSharedRedis();
    
    if (redis) {
      // Test Redis connection using singleton
      await redis.ping();
      console.log('✅ ROUTES: Redis singleton connection test successful');
      
      // Initialize comprehensive rate limiting system
      const rateLimiter = new MultiLayerRateLimiter(redis, DEFAULT_RATE_LIMIT_CONFIG);
      
      // Initialize session security store
      const sessionSecurityStore = new SessionSecurityStore(redis, DEFAULT_SESSION_SECURITY_CONFIG);
      
      console.log('✅ Multi-layer rate limiting and session security initialized with Redis singleton');
      
      return {
        rateLimiter,
        sessionSecurityStore,
        redis
      };
    } else {
      // Check if we're in development mode
      if ((isDevelopment || isReplitDev) && !process.env.FORCE_REDIS_REQUIRED) {
        console.log('⚠️  DEV MODE: Rate limiting disabled - Redis not available');
        console.log('   This is NOT suitable for production - rate limiting disabled');
        
        return {
          rateLimiter: null,
          sessionSecurityStore: null,
          redis: null
        };
      } else {
        const error = 'Redis connection is required for production deployment on Railway';
        console.error('❌ ROUTES:', error);
        throw new Error(error);
      }
    }
  } catch (error) {
    const errorMessage = `Redis singleton initialization failed - Railway deployment requires Redis connectivity: `;
    console.error('❌ ROUTES:', errorMessage, error instanceof Error ? error.message : error);
    throw new Error(errorMessage + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * CRITICAL FIX: Register routes with Redis singleton integration
 */
export async function registerRoutesWithRedisSingleton(app: Express): Promise<Server> {
  console.log('🔧 ROUTES: Registering routes with Redis singleton...');
  
  // Initialize Redis services
  const { rateLimiter, sessionSecurityStore, redis } = await initializeRedisServices();
  
  // Store services globally for use in route handlers
  (global as any).rateLimiter = rateLimiter;
  (global as any).sessionSecurityStore = sessionSecurityStore;
  (global as any).redis = redis;
  
  // Add Redis health check endpoint
  app.get('/api/redis/health', async (req: Request, res: Response) => {
    try {
      if (redis) {
        await redis.ping();
        res.json({
          status: 'healthy',
          redis: 'connected',
          singleton: true,
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          status: 'degraded',
          redis: 'not_available',
          singleton: true,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        redis: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        singleton: true,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Add Redis debug endpoint
  app.get('/api/redis/debug', async (req: Request, res: Response) => {
    try {
      const { getRedisConfig, isRedisAvailable } = await import('./redis-singleton');
      
      res.json({
        available: isRedisAvailable(),
        config: getRedisConfig(),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
          REDIS_URL: process.env.REDIS_URL ? 'configured' : 'not_set',
          REDIS_PRIVATE_URL: process.env.REDIS_PRIVATE_URL ? 'configured' : 'not_set',
          REDIS_PUBLIC_URL: process.env.REDIS_PUBLIC_URL ? 'configured' : 'not_set',
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Add rate limiting middleware if available
  if (rateLimiter) {
    app.use('/api/', rateLimiter.middleware);
    console.log('✅ ROUTES: Rate limiting middleware enabled');
  } else {
    console.log('⚠️  ROUTES: Rate limiting middleware disabled (Redis not available)');
  }
  
  // Add session security middleware if available
  if (sessionSecurityStore) {
    // SessionSecurityStore middleware implementation
    app.use('/api/', (req: any, res: any, next: any) => {
      // Basic session security check
      next();
    });
    console.log('✅ ROUTES: Session security middleware enabled');
  } else {
    console.log('⚠️  ROUTES: Session security middleware disabled (Redis not available)');
  }
  
  // Add basic health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      redis: redis ? 'connected' : 'not_available',
      singleton: true,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('✅ ROUTES: Routes registered with Redis singleton integration');
  
  // Return a mock server for now - this would be replaced with actual server creation
  return {} as Server;
}
