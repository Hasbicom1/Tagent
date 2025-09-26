/**
 * RAILWAY REDIS CONFIGURATION - 2025 STANDARDS
 * 
 * Modern Railway deployment configuration following September 2025 best practices:
 * - Railway service discovery patterns
 * - Modern Redis client configuration
 * - Railway-specific networking
 * - Production security standards
 */

import { Redis } from 'ioredis';
import { logger } from './logger';

interface RailwayRedisConfig {
  url: string;
  source: string;
  isRailway: boolean;
  isInternal: boolean;
  isProduction: boolean;
  serviceType: 'private' | 'public' | 'external' | 'standard';
}

interface RailwayServiceInfo {
  environment: string;
  projectId: string;
  serviceId: string;
  region: string;
  isRailway: boolean;
}

/**
 * RAILWAY 2025: Modern service discovery and environment detection
 */
export function detectRailwayEnvironment(): RailwayServiceInfo {
  const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || 
                   process.env.RAILWAY_PROJECT_ID !== undefined ||
                   process.env.RAILWAY_SERVICE_ID !== undefined;
  
  return {
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    projectId: process.env.RAILWAY_PROJECT_ID || 'unknown',
    serviceId: process.env.RAILWAY_SERVICE_ID || 'unknown',
    region: process.env.RAILWAY_REGION || 'unknown',
    isRailway
  };
}

/**
 * RAILWAY 2025: Modern Redis URL detection with latest patterns
 */
export function getRailwayRedisUrl(): RailwayRedisConfig {
  const railwayInfo = detectRailwayEnvironment();
  const isProduction = railwayInfo.environment === 'production';
  
  console.log('🔍 RAILWAY 2025: Scanning for Redis URL with modern patterns...');
  console.log(`   Environment: ${railwayInfo.environment}`);
  console.log(`   Railway: ${railwayInfo.isRailway}`);
  console.log(`   Project ID: ${railwayInfo.projectId}`);
  console.log(`   Service ID: ${railwayInfo.serviceId}`);
  console.log(`   Region: ${railwayInfo.region}`);
  
  // RAILWAY 2025: Priority order for Redis URL detection
  const redisUrlCandidates = [
    // Railway 2025 service references (highest priority)
    { 
      key: 'REDIS_PRIVATE_URL', 
      source: 'Railway Redis Service (Private)',
      serviceType: 'private' as const
    },
    { 
      key: 'REDIS_URL', 
      source: 'Standard Redis URL',
      serviceType: 'standard' as const
    },
    { 
      key: 'REDIS_PUBLIC_URL', 
      source: 'Railway Redis Service (Public)',
      serviceType: 'public' as const
    },
    { 
      key: 'REDIS_EXTERNAL_URL', 
      source: 'Railway Redis Service (External)',
      serviceType: 'external' as const
    },
    
    // Railway 2025 alternative patterns
    { 
      key: 'REDIS_CONNECTION_STRING', 
      source: 'Redis Connection String',
      serviceType: 'standard' as const
    },
    { 
      key: 'CACHE_URL', 
      source: 'Cache URL (Redis)',
      serviceType: 'standard' as const
    },
    { 
      key: 'DATABASE_URL', 
      source: 'Database URL (Redis fallback)',
      serviceType: 'standard' as const
    },
    
    // Railway 2025 service discovery patterns
    { 
      key: 'REDIS_SERVICE_URL', 
      source: 'Railway Service Discovery',
      serviceType: 'private' as const
    },
    { 
      key: 'REDIS_INTERNAL_URL', 
      source: 'Railway Internal Service',
      serviceType: 'private' as const
    }
  ];
  
  // Debug: Log all Redis-related environment variables
  const redisVars = Object.keys(process.env).filter(key => 
    key.includes('REDIS') || key.includes('DATABASE') || key.includes('CACHE')
  );
  
  console.log('🔍 RAILWAY 2025: Found Redis-related variables:', redisVars);
  
  for (const candidate of redisUrlCandidates) {
    const url = process.env[candidate.key];
    if (url) {
      console.log(`✅ RAILWAY 2025: Found ${candidate.source}: ${candidate.key}`);
      console.log(`   URL format: ${url.substring(0, 30)}...`);
      
      // Validate Redis URL format with 2025 patterns
      if (isValidRailwayRedisUrl(url)) {
        const isInternal = url.includes('redis.railway.internal') || 
                          url.includes('localhost') ||
                          url.includes('127.0.0.1');
        
        console.log(`   Source: ${candidate.source}`);
        console.log(`   Service Type: ${candidate.serviceType}`);
        console.log(`   Internal: ${isInternal}`);
        console.log(`   Railway: ${railwayInfo.isRailway}`);
        
        return {
          url,
          source: candidate.source,
          isRailway: railwayInfo.isRailway,
          isInternal,
          isProduction,
          serviceType: candidate.serviceType
        };
      } else {
        console.warn(`⚠️  RAILWAY 2025: Invalid Redis URL format in ${candidate.key}: ${url.substring(0, 30)}...`);
      }
    }
  }
  
  // No valid Redis URL found
  console.error('❌ RAILWAY 2025: No valid Redis URL found in environment variables');
  console.error('   Checked variables:', redisUrlCandidates.map(c => c.key).join(', '));
  
  if (railwayInfo.isRailway) {
    console.error('🔧 RAILWAY 2025 FIX: Ensure Redis service is attached to your project');
    console.error('   1. Go to Railway Dashboard > Project > Services');
    console.error('   2. Click "+ New" > Database > Redis');
    console.error('   3. Wait for deployment and verify REDIS_PRIVATE_URL appears in Variables');
    console.error('   4. Redeploy the application');
  }
  
  throw new Error('No valid Redis URL found in environment variables');
}

/**
 * RAILWAY 2025: Validate Redis URL format with latest patterns
 */
function isValidRailwayRedisUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Railway 2025 Redis URL patterns
  const railwayRedisPatterns = [
    // Standard Redis patterns
    /^redis:\/\/.+/,
    /^rediss:\/\/.+/,
    
    // Railway internal patterns
    /^redis:\/\/default:.+@redis\.railway\.internal:\d+/,
    /^rediss:\/\/default:.+@redis\.railway\.internal:\d+/,
    
    // Railway external patterns
    /^redis:\/\/default:.+@containers-.+\.railway\.app:\d+/,
    /^rediss:\/\/default:.+@containers-.+\.railway\.app:\d+/,
    
    // Railway 2025 service discovery patterns
    /^redis:\/\/default:.+@redis-service-\d+\.railway\.internal:\d+/,
    /^rediss:\/\/default:.+@redis-service-\d+\.railway\.internal:\d+/,
    
    // Railway 2025 regional patterns
    /^redis:\/\/default:.+@redis-\w+-\d+\.railway\.app:\d+/,
    /^rediss:\/\/default:.+@redis-\w+-\d+\.railway\.app:\d+/,
    
    // Railway 2025 internal networking
    /^redis:\/\/default:.+@redis\.railway\.internal:\d+/,
    /^rediss:\/\/default:.+@redis\.railway\.internal:\d+/
  ];
  
  return railwayRedisPatterns.some(pattern => pattern.test(url));
}

/**
 * RAILWAY 2025: Modern Redis client configuration
 */
export function createRailwayRedisClient(config: RailwayRedisConfig): Redis {
  const { url, source, isRailway, isInternal, isProduction, serviceType } = config;
  
  console.log('🔧 RAILWAY 2025: Creating Redis client with modern configuration...');
  console.log(`   Source: ${source}`);
  console.log(`   Service Type: ${serviceType}`);
  console.log(`   Railway: ${isRailway}`);
  console.log(`   Internal: ${isInternal}`);
  console.log(`   Production: ${isProduction}`);
  
  // RAILWAY 2025: Base configuration with modern patterns
  const baseConfig = {
    lazyConnect: true,
    enableAutoPipelining: true,
    enableOfflineQueue: true, // CRITICAL: Enable offline queue for Railway
    keepAlive: true,
    family: 4, // Force IPv4
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,
    enableReadyCheck: true,
    maxLoadingTimeout: 10000,
    
    // Railway 2025: Modern connection pooling
    maxRetriesPerRequest: null, // Unlimited retries for Railway
    retryDelayOnFailover: 200,
    retryDelayOnClusterDown: 500,
    
    // Railway 2025: Enhanced socket configuration
    socket: {
      reconnectStrategy: (retries: number) => {
        // Railway 2025: Exponential backoff with jitter
        const baseDelay = Math.min(retries * 100, 2000);
        const jitter = Math.random() * 100;
        return baseDelay + jitter;
      }
    }
  };
  
  // RAILWAY 2025: Service-specific configuration
  const serviceConfig = getServiceSpecificConfig(serviceType, isRailway, isInternal, isProduction);
  
  // RAILWAY 2025: Internal networking configuration
  const internalConfig = isInternal ? {
    connectTimeout: 30000,
    commandTimeout: 20000,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    socket: {
      reconnectStrategy: (retries: number) => {
        // Railway 2025: Aggressive reconnection for internal services
        return Math.min(retries * 200, 3000);
      }
    }
  } : {};
  
  const finalConfig = {
    ...baseConfig,
    ...serviceConfig,
    ...internalConfig
  };
  
  console.log('🔧 RAILWAY 2025: Final configuration:', {
    connectTimeout: finalConfig.connectTimeout,
    commandTimeout: finalConfig.commandTimeout,
    maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
    enableOfflineQueue: finalConfig.enableOfflineQueue,
    lazyConnect: finalConfig.lazyConnect,
    serviceType: serviceType
  });
  
  const redis = new Redis(url, finalConfig);
  
  // RAILWAY 2025: Enhanced error handling with Railway context
  redis.on('error', (error) => {
    console.warn('⚠️  RAILWAY 2025 Redis error (handled):', error.message.substring(0, 100));
    console.warn('⚠️  RAILWAY 2025 Redis error details:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      source: source,
      serviceType: serviceType,
      isRailway: isRailway,
      isInternal: isInternal,
      isProduction: isProduction
    });
  });
  
  redis.on('close', () => {
    console.warn('⚠️  RAILWAY 2025 Redis connection closed');
  });
  
  redis.on('reconnecting', () => {
    console.log('🔄 RAILWAY 2025 Redis reconnecting...');
  });
  
  redis.on('connect', () => {
    console.log('✅ RAILWAY 2025 Redis client connected successfully');
  });
  
  redis.on('ready', () => {
    console.log('✅ RAILWAY 2025 Redis client ready for commands');
  });
  
  return redis;
}

/**
 * RAILWAY 2025: Service-specific configuration
 */
function getServiceSpecificConfig(
  serviceType: string, 
  isRailway: boolean, 
  isInternal: boolean, 
  isProduction: boolean
): any {
  const baseConfig = {
    connectTimeout: 10000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 3
  };
  
  if (!isRailway) {
    return baseConfig;
  }
  
  // Railway 2025: Service-specific configurations
  switch (serviceType) {
    case 'private':
      return {
        connectTimeout: 25000,
        commandTimeout: 20000,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 150, 2500)
        }
      };
    
    case 'public':
      return {
        connectTimeout: 20000,
        commandTimeout: 15000,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 100, 2000)
        }
      };
    
    case 'external':
      return {
        connectTimeout: 30000,
        commandTimeout: 25000,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 200, 3000)
        }
      };
    
    default:
      return {
        connectTimeout: 15000,
        commandTimeout: 10000,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true
      };
  }
}

/**
 * RAILWAY 2025: Test Redis connection with modern retry logic
 */
export async function testRailwayRedisConnection(redis: Redis, config: RailwayRedisConfig): Promise<boolean> {
  const { source, serviceType, isRailway, isInternal, isProduction } = config;
  
  console.log('🔧 RAILWAY 2025: Testing Redis connection...');
  console.log(`   Source: ${source}`);
  console.log(`   Service Type: ${serviceType}`);
  console.log(`   Railway: ${isRailway}`);
  console.log(`   Internal: ${isInternal}`);
  console.log(`   Production: ${isProduction}`);
  
  const connectionTimeout = isRailway ? 30000 : 5000;
  const maxAttempts = isRailway ? 5 : 1;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔧 RAILWAY 2025: Connection attempt ${attempt}/${maxAttempts}...`);
      
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), connectionTimeout)
        )
      ]);
      
      console.log('✅ RAILWAY 2025: Connection test successful');
      return true;
    } catch (error) {
      console.warn(`⚠️  RAILWAY 2025: Connection attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxAttempts) {
        const retryDelay = isRailway ? 3000 : 1000;
        console.log(`🔄 RAILWAY 2025: Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('❌ RAILWAY 2025: All connection attempts failed');
        throw error;
      }
    }
  }
  
  return false;
}

/**
 * RAILWAY 2025: Initialize Redis with comprehensive error handling
 */
export async function initializeRailwayRedis2025(): Promise<Redis | null> {
  try {
    console.log('🚀 RAILWAY 2025: Initializing Redis with modern configuration...');
    
    // Get Railway Redis configuration
    const config = getRailwayRedisUrl();
    
    // Create Railway Redis client
    const redis = createRailwayRedisClient(config);
    
    // Test connection with Railway 2025 patterns
    await testRailwayRedisConnection(redis, config);
    
    console.log('✅ RAILWAY 2025: Redis initialized successfully');
    return redis;
    
  } catch (error) {
    console.error('❌ RAILWAY 2025: Redis initialization failed:', error.message);
    
    // Check if we're in development mode
    const isReplitDev = process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if ((isDevelopment || isReplitDev) && !process.env.FORCE_REDIS_REQUIRED) {
      console.log('⚠️  RAILWAY 2025 DEV MODE: Redis disabled - Redis connection failed but allowing development testing');
      console.log('   This is NOT suitable for production - Redis is required for production deployment');
      console.log('   Session management will use memory store (data will be lost on restart)');
      return null; // Allow development to continue without Redis
    }
    
    // Production mode - Redis is required
    console.error('🚨 RAILWAY 2025 CRITICAL ERROR: Redis is mandatory for production deployment');
    console.error('   NO FALLBACKS: Memory store fallbacks are disabled for production security');
    console.error('   REQUIRED: Ensure Redis is configured and accessible');
    throw error;
  }
}
