/**
 * RAILWAY REDIS CONFIGURATION FIX
 * 
 * This module provides flexible Redis configuration that works with Railway's
 * service reference system and handles multiple possible Redis URL formats.
 */

import { Redis } from 'ioredis';
import { logger } from './logger';

interface RedisConfig {
  url: string;
  source: string;
  isRailway: boolean;
  isInternal: boolean;
}

/**
 * RAILWAY FIX: Flexible Redis URL detection
 * Checks for multiple possible Redis URL environment variables
 */
export function getRedisUrl(): RedisConfig {
  const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
  const isReplit = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
  
  console.log('🔍 REDIS: Scanning for Redis URL in environment variables...');
  
  // Debug: Log all Redis-related environment variables
  const redisVars = Object.keys(process.env).filter(key => 
    key.includes('REDIS') || key.includes('DATABASE') || key.includes('CACHE')
  );
  
  console.log('🔍 REDIS: Found Redis-related variables:', redisVars);
  
  // Priority order for Redis URL detection
  const redisUrlCandidates = [
    // Railway service references (highest priority)
    { key: 'REDIS_PRIVATE_URL', source: 'Railway Redis Service (Private)' },
    { key: 'REDIS_URL', source: 'Standard Redis URL' },
    { key: 'REDIS_PUBLIC_URL', source: 'Railway Redis Service (Public)' },
    { key: 'REDIS_EXTERNAL_URL', source: 'Railway Redis Service (External)' },
    
    // Alternative Redis URL formats
    { key: 'REDIS_CONNECTION_STRING', source: 'Redis Connection String' },
    { key: 'CACHE_URL', source: 'Cache URL (Redis)' },
    
    // Database URL fallback (if it's Redis)
    { key: 'DATABASE_URL', source: 'Database URL (Redis fallback)' }
  ];
  
  for (const candidate of redisUrlCandidates) {
    const url = process.env[candidate.key];
    if (url) {
      console.log(`✅ REDIS: Found ${candidate.source}: ${candidate.key}`);
      console.log(`   URL format: ${url.substring(0, 20)}...`);
      
      // Validate Redis URL format
      if (isValidRedisUrl(url)) {
        const isInternal = url.includes('redis.railway.internal') || url.includes('localhost');
        
        console.log(`   Source: ${candidate.source}`);
        console.log(`   Internal: ${isInternal}`);
        console.log(`   Railway: ${isRailway}`);
        
        return {
          url,
          source: candidate.source,
          isRailway,
          isInternal
        };
      } else {
        console.warn(`⚠️  REDIS: Invalid Redis URL format in ${candidate.key}: ${url.substring(0, 20)}...`);
      }
    }
  }
  
  // No valid Redis URL found
  console.error('❌ REDIS: No valid Redis URL found in environment variables');
  console.error('   Checked variables:', redisUrlCandidates.map(c => c.key).join(', '));
  
  if (isRailway) {
    console.error('🔧 RAILWAY FIX: Ensure Redis service is attached to your project');
    console.error('   1. Go to Railway Dashboard > Project > Services');
    console.error('   2. Click "+ New" > Database > Redis');
    console.error('   3. Wait for deployment and verify REDIS_PRIVATE_URL appears in Variables');
  }
  
  throw new Error('No valid Redis URL found in environment variables');
}

/**
 * Validate Redis URL format
 */
function isValidRedisUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Check for Redis URL patterns
  const redisPatterns = [
    /^redis:\/\/.+/,
    /^rediss:\/\/.+/,
    /^redis:\/\/default:.+@.+/,
    /^redis:\/\/default:.+@redis\.railway\.internal:\d+/,
    /^redis:\/\/default:.+@containers-.+\.railway\.app:\d+/
  ];
  
  return redisPatterns.some(pattern => pattern.test(url));
}

/**
 * RAILWAY FIX: Enhanced Redis client configuration
 * Optimized for Railway deployment with proper error handling
 */
export function createRedisClient(config: RedisConfig): Redis {
  const { url, source, isRailway, isInternal } = config;
  
  console.log('🔧 REDIS: Creating Redis client with Railway-optimized configuration...');
  console.log(`   Source: ${source}`);
  console.log(`   Railway: ${isRailway}`);
  console.log(`   Internal: ${isInternal}`);
  
  // Base configuration
  const baseConfig = {
    lazyConnect: true,
    enableAutoPipelining: true,
    enableOfflineQueue: true, // CRITICAL: Enable offline queue for Railway
    keepAlive: true,
    family: 4, // Force IPv4
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,
    enableReadyCheck: true,
    maxLoadingTimeout: 10000
  };
  
  // Railway-specific configuration
  const railwayConfig = isRailway ? {
    // Enhanced timeouts for Railway
    connectTimeout: 20000,
    commandTimeout: 15000,
    maxRetriesPerRequest: null, // Unlimited retries for Railway
    retryDelayOnFailover: 200,
    retryDelayOnClusterDown: 500,
    enableOfflineQueue: true, // CRITICAL: Enable offline queue for Railway
    lazyConnect: false, // Connect immediately for Railway
    enableReadyCheck: true,
    maxLoadingTimeout: 15000,
    
    // Railway-specific socket configuration
    socket: {
      reconnectStrategy: (retries: number) => Math.min(retries * 50, 1000)
    }
  } : {
    // Development configuration
    connectTimeout: 5000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 3
  };
  
  // Internal URL configuration (Railway internal networking)
  const internalConfig = isInternal ? {
    connectTimeout: 30000,
    commandTimeout: 20000,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    socket: {
      reconnectStrategy: (retries: number) => Math.min(retries * 100, 2000)
    }
  } : {};
  
  const finalConfig = {
    ...baseConfig,
    ...railwayConfig,
    ...internalConfig
  };
  
  console.log('🔧 REDIS: Final configuration:', {
    connectTimeout: finalConfig.connectTimeout,
    commandTimeout: finalConfig.commandTimeout,
    maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
    enableOfflineQueue: finalConfig.enableOfflineQueue,
    lazyConnect: finalConfig.lazyConnect
  });
  
  const redis = new Redis(url, finalConfig);
  
  // Enhanced error handling
  redis.on('error', (error) => {
    console.warn('⚠️  REDIS error (handled):', error.message.substring(0, 100));
    console.warn('⚠️  REDIS error details:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      source: source,
      isRailway: isRailway,
      isInternal: isInternal
    });
  });
  
  redis.on('close', () => {
    console.warn('⚠️  REDIS connection closed');
  });
  
  redis.on('reconnecting', () => {
    console.log('🔄 REDIS reconnecting...');
  });
  
  redis.on('connect', () => {
    console.log('✅ REDIS: Client connected successfully');
  });
  
  redis.on('ready', () => {
    console.log('✅ REDIS: Client ready for commands');
  });
  
  return redis;
}

/**
 * RAILWAY FIX: Test Redis connection with enhanced retry logic
 */
export async function testRedisConnection(redis: Redis, config: RedisConfig): Promise<boolean> {
  const { source, isRailway, isInternal } = config;
  
  console.log('🔧 REDIS: Testing connection...');
  console.log(`   Source: ${source}`);
  console.log(`   Railway: ${isRailway}`);
  console.log(`   Internal: ${isInternal}`);
  
  const connectionTimeout = isRailway ? 30000 : 5000;
  const maxAttempts = isRailway ? 3 : 1;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔧 REDIS: Connection attempt ${attempt}/${maxAttempts}...`);
      
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), connectionTimeout)
        )
      ]);
      
      console.log('✅ REDIS: Connection test successful');
      return true;
    } catch (error) {
      console.warn(`⚠️  REDIS: Connection attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxAttempts) {
        const retryDelay = isRailway ? 2000 : 1000;
        console.log(`🔄 REDIS: Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('❌ REDIS: All connection attempts failed');
        throw error;
      }
    }
  }
  
  return false;
}

/**
 * RAILWAY FIX: Initialize Redis with comprehensive error handling
 */
export async function initializeRedisWithFallback(): Promise<Redis | null> {
  try {
    console.log('🚀 REDIS: Initializing Redis with Railway-optimized configuration...');
    
    // Get Redis configuration
    const config = getRedisUrl();
    
    // Create Redis client
    const redis = createRedisClient(config);
    
    // Test connection
    await testRedisConnection(redis, config);
    
    console.log('✅ REDIS: Redis initialized successfully');
    return redis;
    
  } catch (error) {
    console.error('❌ REDIS: Redis initialization failed:', error.message);
    
    // Check if we're in development mode
    const isReplitDev = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if ((isDevelopment || isReplitDev) && !process.env.FORCE_REDIS_REQUIRED) {
      console.log('⚠️  DEV MODE: Redis disabled - Redis connection failed but allowing development testing');
      console.log('   This is NOT suitable for production - Redis is required for production deployment');
      console.log('   Session management will use memory store (data will be lost on restart)');
      return null; // Allow development to continue without Redis
    }
    
    // Production mode - Redis is required
    console.error('🚨 CRITICAL ERROR: Redis is mandatory for production deployment');
    console.error('   NO FALLBACKS: Memory store fallbacks are disabled for production security');
    console.error('   REQUIRED: Ensure Redis is configured and accessible');
    throw error;
  }
}
