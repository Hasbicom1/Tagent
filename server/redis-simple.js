/**
 * SIMPLE REDIS INTEGRATION - Production Server
 * 
 * Simplified Redis integration for the production server.
 * Uses the singleton pattern with graceful degradation.
 */

import { Redis } from 'ioredis';

class SimpleRedisSingleton {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  static getInstance() {
    if (!SimpleRedisSingleton.instance) {
      SimpleRedisSingleton.instance = new SimpleRedisSingleton();
    }
    return SimpleRedisSingleton.instance;
  }

  async getRedis() {
    if (this.isConnected && this.redis) {
      return this.redis;
    }

    if (this.connectionPromise) {
      return await this.connectionPromise;
    }

    this.connectionPromise = this.connect();
    return await this.connectionPromise;
  }

  async connect() {
    try {
      console.log('🔧 SIMPLE REDIS: Attempting to connect...');
      
      // Get Redis URL from environment variables
      const redisUrl = process.env.REDIS_URL || 
                      process.env.REDIS_PRIVATE_URL || 
                      process.env.REDIS_PUBLIC_URL ||
                      process.env.REDIS_EXTERNAL_URL ||
                      process.env.REDIS_CONNECTION_STRING ||
                      process.env.CACHE_URL;

      if (!redisUrl) {
        console.warn('⚠️ SIMPLE REDIS: No Redis URL found in environment variables');
        return null;
      }

      console.log('🔧 SIMPLE REDIS: Connecting to Redis...');
      
      // Create Redis client with basic configuration
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        commandTimeout: 5000
      });

      // Test connection
      await this.redis.ping();
      
      this.isConnected = true;
      console.log('✅ SIMPLE REDIS: Connected successfully');
      
      return this.redis;
      
    } catch (error) {
      console.warn('⚠️ SIMPLE REDIS: Connection failed (non-blocking):', error.message);
      this.redis = null;
      this.isConnected = false;
      return null;
    }
  }

  isAvailable() {
    return this.isConnected && this.redis !== null;
  }

  async disconnect() {
    if (this.redis) {
      try {
        await this.redis.quit();
        console.log('✅ SIMPLE REDIS: Disconnected');
      } catch (error) {
        console.warn('⚠️ SIMPLE REDIS: Error during disconnect:', error.message);
      }
      this.redis = null;
    }
    this.isConnected = false;
  }
}

// Export singleton instance
export const simpleRedis = SimpleRedisSingleton.getInstance();

/**
 * Get Redis instance (with graceful degradation)
 */
export async function getRedis() {
  return await simpleRedis.getRedis();
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable() {
  return simpleRedis.isAvailable();
}

/**
 * Wait for Redis to be ready (with timeout)
 */
export async function waitForRedis(timeoutMs = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.ping();
        console.log('✅ SIMPLE REDIS: Redis is ready');
        return redis;
      }
    } catch (error) {
      console.warn('⚠️ SIMPLE REDIS: Redis not ready yet, waiting...');
    }
    
    // Wait 1 second before retry
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.warn('⚠️ SIMPLE REDIS: Redis not ready within timeout period');
  return null;
}
