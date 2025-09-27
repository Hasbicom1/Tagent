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
      // CRITICAL FIX: Handle Railway Redis URL format issues
      let redisUrl = process.env.REDIS_URL || 
                     process.env.REDIS_PRIVATE_URL || 
                     process.env.REDIS_PUBLIC_URL ||
                     process.env.REDIS_EXTERNAL_URL ||
                     process.env.REDIS_CONNECTION_STRING ||
                     process.env.CACHE_URL;

      // RAILWAY FIX: Replace problematic internal hostname with external URL
      if (redisUrl && redisUrl.includes('redis.railway.internal')) {
        console.log('🔧 SIMPLE REDIS: Detected internal Railway Redis URL, attempting to use external URL...');
        
        // Try to find an external Redis URL
        const externalUrl = process.env.REDIS_PUBLIC_URL || 
                           process.env.REDIS_EXTERNAL_URL ||
                           process.env.REDIS_URL;
        
        if (externalUrl && !externalUrl.includes('redis.railway.internal')) {
          console.log('✅ SIMPLE REDIS: Using external Redis URL instead of internal');
          redisUrl = externalUrl;
        } else {
          console.warn('⚠️ SIMPLE REDIS: No external Redis URL found, will try internal URL');
        }
      }

      if (!redisUrl) {
        console.warn('⚠️ SIMPLE REDIS: No Redis URL found in environment variables');
        return null;
      }

      console.log('🔧 SIMPLE REDIS: Connecting to Redis...');
      console.log(`   URL: ${redisUrl.substring(0, 30)}...`);
      
      // Create Redis client with Railway-optimized configuration
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: true,
        connectTimeout: 15000, // Increased for Railway
        commandTimeout: 10000,  // Increased for Railway
        // Railway-specific configuration
        family: 4, // Force IPv4
        keepAlive: true,
        enableReadyCheck: true
      });

      // Test connection
      await this.redis.ping();
      
      this.isConnected = true;
      console.log('✅ SIMPLE REDIS: Connected successfully');
      
      return this.redis;
      
    } catch (error) {
      console.warn('⚠️ SIMPLE REDIS: Connection failed (non-blocking):', error.message);
      
      // Check if it's a Railway internal hostname issue
      if (error.message.includes('redis.railway.internal')) {
        console.warn('🔧 SIMPLE REDIS: Railway internal hostname not resolvable - this is expected in some Railway configurations');
        console.warn('   The application will continue without Redis (sessions will use memory store)');
        console.warn('   For production, ensure Railway Redis service is properly configured with external URLs');
      }
      
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
