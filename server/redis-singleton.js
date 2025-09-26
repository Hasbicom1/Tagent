/**
 * RAILWAY CRITICAL FIX: Redis Singleton Manager (JavaScript)
 * 
 * This module provides a single, shared Redis instance across all services
 * to prevent multiple Redis connections and ensure proper initialization order.
 */

import { Redis } from 'ioredis';

class RedisSingleton {
  constructor() {
    this.redis = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  static getInstance() {
    if (!RedisSingleton.instance) {
      RedisSingleton.instance = new RedisSingleton();
    }
    return RedisSingleton.instance;
  }

  /**
   * CRITICAL FIX: Get Redis instance with comprehensive error handling
   */
  async getRedis() {
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
  async initializeRedis() {
    try {
      console.log('🔧 REDIS SINGLETON: Initializing shared Redis instance...');
      
      // Get Railway Redis configuration
      const { getRailwayRedisUrl, createRailwayRedisClient, testRailwayRedisConnection } = await import('./railway-redis-2025.js');
      const config = getRailwayRedisUrl();
      
      console.log(`🔧 REDIS SINGLETON: Using ${config.source}`);
      console.log(`   Service Type: ${config.serviceType}`);
      console.log(`   Railway: ${config.isRailway}`);
      console.log(`   Internal: ${config.isInternal}`);
      
      // Create Railway Redis client
      this.redis = createRailwayRedisClient(config);
      
      // Test connection with comprehensive retry logic
      await testRailwayRedisConnection(this.redis, config);
      
      this.isInitialized = true;
      console.log('✅ REDIS SINGLETON: Shared Redis instance initialized successfully');
      
      return this.redis;
      
    } catch (error) {
      console.error('❌ REDIS SINGLETON: Redis initialization failed:', error instanceof Error ? error.message : String(error));
      
      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment && !process.env.FORCE_REDIS_REQUIRED) {
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
   * CRITICAL FIX: Check if Redis is available
   */
  isRedisAvailable() {
    return this.isInitialized && this.redis !== null;
  }

  /**
   * CRITICAL FIX: Force reinitialize Redis (for recovery)
   */
  async reinitialize() {
    console.log('🔄 REDIS SINGLETON: Force reinitializing Redis...');
    this.isInitialized = false;
    this.redis = null;
    this.initializationPromise = null;
    return await this.getRedis();
  }

  /**
   * CRITICAL FIX: Shutdown Redis connection
   */
  async shutdown() {
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
export async function getSharedRedis() {
  return await redisSingleton.getRedis();
}

/**
 * CRITICAL FIX: Check if Redis is available
 */
export function isRedisAvailable() {
  return redisSingleton.isRedisAvailable();
}

/**
 * CRITICAL FIX: Wait for Redis to be ready
 * This ensures Redis is available before other services start
 */
export async function waitForRedis(timeoutMs = 30000) {
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
export function debugRedisStatus() {
  const isAvailable = isRedisAvailable();
  
  console.log('🔍 REDIS SINGLETON DEBUG:');
  console.log(`   Available: ${isAvailable}`);
  console.log(`   Initialized: ${redisSingleton.isInitialized}`);
  
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
