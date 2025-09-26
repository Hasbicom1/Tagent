/**
 * RAILWAY CRITICAL FIX: Redis Singleton Manager
 * 
 * This module provides a single, shared Redis instance across all services
 * to prevent multiple Redis connections and ensure proper initialization order.
 */

import { Redis } from 'ioredis';
import { logger } from './logger';

interface RedisSingletonConfig {
  url: string;
  source: string;
  isRailway: boolean;
  isInternal: boolean;
  isProduction: boolean;
  serviceType: 'private' | 'public' | 'external' | 'standard';
}

class RedisSingleton {
  private static instance: RedisSingleton;
  private redis: Redis | null = null;
  private config: RedisSingletonConfig | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<Redis | null> | null = null;

  private constructor() {}

  static getInstance(): RedisSingleton {
    if (!RedisSingleton.instance) {
      RedisSingleton.instance = new RedisSingleton();
    }
    return RedisSingleton.instance;
  }

  /**
   * CRITICAL FIX: Get Redis instance with comprehensive error handling
   */
  async getRedis(): Promise<Redis | null> {
    if (this.isInitialized && this.redis) {
      return this.redis;
    }

    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    this.initializationPromise = this.initializeRedis();
    return await this.initializationPromise;
  }

  /**
   * CRITICAL FIX: Initialize Redis with Railway 2025 patterns
   */
  private async initializeRedis(): Promise<Redis | null> {
    try {
      console.log('🔧 REDIS SINGLETON: Initializing shared Redis instance...');
      
      // Get Railway Redis configuration
      const { getRailwayRedisUrl, createRailwayRedisClient, testRailwayRedisConnection } = await import('./railway-redis-2025');
      this.config = getRailwayRedisUrl();
      
      console.log(`🔧 REDIS SINGLETON: Using ${this.config.source}`);
      console.log(`   Service Type: ${this.config.serviceType}`);
      console.log(`   Railway: ${this.config.isRailway}`);
      console.log(`   Internal: ${this.config.isInternal}`);
      
      // Create Railway Redis client
      this.redis = createRailwayRedisClient(this.config);
      
      // Test connection with comprehensive retry logic
      await testRailwayRedisConnection(this.redis, this.config);
      
      this.isInitialized = true;
      console.log('✅ REDIS SINGLETON: Shared Redis instance initialized successfully');
      
      return this.redis;
      
    } catch (error) {
      console.error('❌ REDIS SINGLETON: Redis initialization failed:', error instanceof Error ? error.message : String(error));
      
      // Check if we're in development mode
      const isReplitDev = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if ((isDevelopment || isReplitDev) && !process.env.FORCE_REDIS_REQUIRED) {
        console.log('⚠️  REDIS SINGLETON DEV MODE: Redis disabled - allowing development testing');
        console.log('   This is NOT suitable for production - Redis is required for production deployment');
        this.isInitialized = true;
        return null;
      }
      
      // Production mode - Redis is required
      console.error('🚨 REDIS SINGLETON CRITICAL ERROR: Redis is mandatory for production deployment');
      console.error('   NO FALLBACKS: Memory store fallbacks are disabled for production security');
      console.error('   REQUIRED: Ensure Redis is configured and accessible');
      throw error;
    }
  }

  /**
   * CRITICAL FIX: Get Redis configuration for debugging
   */
  getConfig(): RedisSingletonConfig | null {
    return this.config;
  }

  /**
   * CRITICAL FIX: Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.isInitialized && this.redis !== null;
  }

  /**
   * CRITICAL FIX: Force reinitialize Redis (for recovery)
   */
  async reinitialize(): Promise<Redis | null> {
    console.log('🔄 REDIS SINGLETON: Force reinitializing Redis...');
    this.isInitialized = false;
    this.redis = null;
    this.initializationPromise = null;
    return await this.getRedis();
  }

  /**
   * CRITICAL FIX: Shutdown Redis connection
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      console.log('🔄 REDIS SINGLETON: Shutting down Redis connection...');
      await this.redis.quit();
      this.redis = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// Export singleton instance
export const redisSingleton = RedisSingleton.getInstance();

/**
 * CRITICAL FIX: Get shared Redis instance
 * This ensures all services use the same Redis connection
 */
export async function getSharedRedis(): Promise<Redis | null> {
  return await redisSingleton.getRedis();
}

/**
 * CRITICAL FIX: Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisSingleton.isRedisAvailable();
}

/**
 * CRITICAL FIX: Get Redis configuration for debugging
 */
export function getRedisConfig(): RedisSingletonConfig | null {
  return redisSingleton.getConfig();
}

/**
 * CRITICAL FIX: Force reinitialize Redis
 */
export async function reinitializeRedis(): Promise<Redis | null> {
  return await redisSingleton.reinitialize();
}

/**
 * CRITICAL FIX: Shutdown Redis
 */
export async function shutdownRedis(): Promise<void> {
  return await redisSingleton.shutdown();
}

/**
 * CRITICAL FIX: Wait for Redis to be ready
 * This ensures Redis is available before other services start
 */
export async function waitForRedis(timeoutMs: number = 30000): Promise<Redis | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const redis = await getSharedRedis();
      if (redis) {
        // Test connection
        await redis.ping();
        console.log('✅ REDIS SINGLETON: Redis is ready');
        return redis;
      }
    } catch (error) {
      console.warn('⚠️  REDIS SINGLETON: Redis not ready yet, waiting...');
    }
    
    // Wait 1 second before retry
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Redis not ready within timeout period');
}

/**
 * CRITICAL FIX: Debug Redis connection status
 */
export function debugRedisStatus(): void {
  const config = getRedisConfig();
  const isAvailable = isRedisAvailable();
  
  console.log('🔍 REDIS SINGLETON DEBUG:');
  console.log(`   Available: ${isAvailable}`);
  console.log(`   Initialized: ${redisSingleton['isInitialized']}`);
  console.log(`   Config: ${config ? JSON.stringify(config, null, 2) : 'null'}`);
  
  // Log all Redis-related environment variables
  const redisVars = Object.keys(process.env).filter(key => 
    key.includes('REDIS') || key.includes('DATABASE') || key.includes('CACHE')
  );
  
  console.log('🔍 REDIS ENVIRONMENT VARIABLES:');
  redisVars.forEach(key => {
    const value = process.env[key];
    console.log(`   ${key}: ${value ? value.substring(0, 30) + '...' : 'undefined'}`);
  });
}
