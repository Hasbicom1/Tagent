import { Redis } from "ioredis";
import { logger } from "./logger";

// TTL settings for idempotency keys
const DEFAULT_TTL = 48 * 60 * 60; // 48 hours in seconds (covers Stripe retry timeframe)
const PROCESSING_TTL = 60; // 60 seconds for processing claim
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour cleanup interval
const REDIS_PREFIX = "stripe_idempotency:";

// Event processing states
type ProcessingState = 'processing' | 'done';

interface EventRecord {
  timestamp: number;
  ttl: number;
  state: ProcessingState;
}

/**
 * Idempotency service for preventing duplicate Stripe webhook processing
 * Uses atomic claim semantics to prevent race conditions
 * PRODUCTION REQUIREMENT: Redis-only operation for Railway deployment
 */
export class IdempotencyService {
  private redis: Redis;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(redis: Redis) {
    if (!redis) {
      throw new Error('Redis connection is required for idempotency service in production deployment');
    }
    
    this.redis = redis;
    this.cleanupInterval = null;
    
    // Start cleanup process for Redis keys
    this.startCleanup();
    
    logger.info('✅ IDEMPOTENCY: Service initialized (Redis-only)', {
      cleanupInterval: CLEANUP_INTERVAL / 1000 + 's',
      defaultTTL: DEFAULT_TTL / 3600 + 'h'
    });
  }

  /**
   * Atomically claim an event for processing
   * @param eventId - Stripe event ID to claim
   * @param processingTtl - TTL for processing claim in seconds
   * @returns Promise<boolean> - true if successfully claimed, false if already claimed/processed
   */
  async claimEventForProcessing(eventId: string, processingTtl: number = PROCESSING_TTL): Promise<boolean> {
    try {
      const key = `${REDIS_PREFIX}${eventId}`;
      const value = JSON.stringify({ state: 'processing', timestamp: Date.now() });
      
      // SET key value NX EX - atomic claim operation (Redis-only)
      const result = await this.redis.set(key, value, 'NX', 'EX', processingTtl);
      
      if (result === 'OK') {
        logger.info('🔒 IDEMPOTENCY: Event claimed for processing (Redis)', {
          eventId: eventId.substring(0, 20) + '***',
          processingTtl: processingTtl + 's'
        });
        return true;
      } else {
        // Check if it's already completed vs still processing
        const existingValue = await this.redis.get(key);
        if (existingValue) {
          const parsed = JSON.parse(existingValue);
          logger.info('🔄 IDEMPOTENCY: Event already claimed/processed (Redis)', {
            eventId: eventId.substring(0, 20) + '***',
            state: parsed.state,
            age: Math.round((Date.now() - parsed.timestamp) / 1000) + 's'
          });
        }
        return false;
      }
      
    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error claiming event for processing', {
        eventId: eventId.substring(0, 20) + '***',
        error: error.message
      });
      
      // In case of error, return false to prevent processing
      // This is safer than allowing potential duplicate processing
      return false;
    }
  }

  /**
   * Mark an event as completed (successful processing)
   * Converts from 'processing' state to 'done' state with full TTL
   * @param eventId - Stripe event ID to mark as completed
   * @param ttlSeconds - TTL in seconds (defaults to 48 hours)
   */
  async markEventCompleted(eventId: string, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      const timestamp = Date.now();
      const value = JSON.stringify({ state: 'done', timestamp });

      // Update in Redis if available
      if (this.redis) {
        const key = `${REDIS_PREFIX}${eventId}`;
        await this.redis.setex(key, ttlSeconds, value);
        
        logger.info('✅ IDEMPOTENCY: Event marked as completed (Redis)', {
          eventId: eventId.substring(0, 20) + '***',
          ttl: ttlSeconds + 's'
        });
      }


    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error marking event as completed', {
        eventId: eventId.substring(0, 20) + '***',
        error: error.message
      });
      // Don't throw - failing to mark as completed is better than failing the webhook
    }
  }

  /**
   * Release a processing claim (for error scenarios)
   * Allows the event to be retried by another request
   * @param eventId - Stripe event ID to release
   */
  async releaseEventClaim(eventId: string): Promise<void> {
    try {
      const key = `${REDIS_PREFIX}${eventId}`;
      await this.redis.del(key);
      
      logger.warn('🔓 IDEMPOTENCY: Processing claim released (Redis)', {
        eventId: eventId.substring(0, 20) + '***'
      });

    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error releasing processing claim', {
        eventId: eventId.substring(0, 20) + '***',
        error: error.message
      });
      // Don't throw - cleanup errors shouldn't affect webhook processing
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use claimEventForProcessing instead
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    logger.warn('⚠️ IDEMPOTENCY: Using deprecated isEventProcessed method', {
      eventId: eventId.substring(0, 20) + '***'
    });
    
    // Check if event exists in either processing or done state (Redis-only)
    try {
      const key = `${REDIS_PREFIX}${eventId}`;
      const exists = await this.redis.exists(key);
      return exists > 0;
    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error in legacy isEventProcessed', {
        eventId: eventId.substring(0, 20) + '***',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use markEventCompleted instead
   */
  async markEventProcessed(eventId: string, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    logger.warn('⚠️ IDEMPOTENCY: Using deprecated markEventProcessed method', {
      eventId: eventId.substring(0, 20) + '***'
    });
    
    await this.markEventCompleted(eventId, ttlSeconds);
  }

  /**
   * Get statistics about the idempotency store (Redis-only)
   */
  getStats(): {
    hasRedis: boolean;
    redisConnected: boolean;
  } {
    return {
      hasRedis: true,
      redisConnected: this.redis.status === 'ready'
    };
  }

  /**
   * Start the cleanup process for expired memory entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, CLEANUP_INTERVAL);

    logger.debug('🧹 IDEMPOTENCY: Cleanup process started', {
      interval: CLEANUP_INTERVAL / 1000 + 's'
    });
  }

  /**
   * Clean up expired entries from Redis store
   */
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      // Redis automatically handles TTL expiration, so this is mainly for logging
      const keys = await this.redis.keys(`${REDIS_PREFIX}*`);
      
      logger.debug('🧹 IDEMPOTENCY: Cleanup cycle completed (Redis auto-expiry)', {
        trackedKeys: keys.length
      });
    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error during cleanup cycle', {
        error: error.message
      });
    }
  }

  /**
   * Shutdown the idempotency service and cleanup resources
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('🛑 IDEMPOTENCY: Service shutdown completed (Redis-backed)');
  }

  /**
   * Force cleanup of all expired entries (for testing/debugging)
   */
  async forceCleanup(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${REDIS_PREFIX}*`);
      await this.cleanupExpiredEntries();
      return keys.length; // Return number of tracked keys
    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error in force cleanup', {
        error: error.message
      });
      return 0;
    }
  }
}

// Global idempotency service instance
let idempotencyService: IdempotencyService | null = null;

/**
 * Initialize the global idempotency service (Redis required)
 * @param redis - Redis instance (required for production deployment)
 */
export function initializeIdempotencyService(redis: Redis): IdempotencyService {
  if (!redis) {
    throw new Error('Redis connection is required for idempotency service in production deployment');
  }
  
  if (idempotencyService) {
    // Shutdown existing service
    idempotencyService.shutdown();
  }

  idempotencyService = new IdempotencyService(redis);
  return idempotencyService;
}

/**
 * Get the global idempotency service instance
 * @returns IdempotencyService instance or throws if not initialized
 */
export function getIdempotencyService(): IdempotencyService {
  if (!idempotencyService) {
    throw new Error('Idempotency service not initialized - Redis connection required');
  }
  return idempotencyService;
}

/**
 * Shutdown the global idempotency service
 */
export function shutdownIdempotencyService(): void {
  if (idempotencyService) {
    idempotencyService.shutdown();
    idempotencyService = null;
  }
}