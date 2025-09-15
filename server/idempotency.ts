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
 * Uses in-memory storage with TTL as primary, Redis as fallback when available
 */
export class IdempotencyService {
  private memoryStore: Map<string, EventRecord>;
  private redis: Redis | null;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(redis: Redis | null = null) {
    this.memoryStore = new Map();
    this.redis = redis;
    this.cleanupInterval = null;
    
    // Start cleanup process for memory store
    this.startCleanup();
    
    logger.info('✅ IDEMPOTENCY: Service initialized', {
      hasRedis: !!redis,
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
      // Try Redis first if available - atomic SET with NX (not exists) and EX (expire)
      if (this.redis) {
        const key = `${REDIS_PREFIX}${eventId}`;
        const value = JSON.stringify({ state: 'processing', timestamp: Date.now() });
        
        // SET key value NX EX - atomic claim operation
        const result = await this.redis.set(key, value, 'NX', 'EX', processingTtl);
        
        if (result === 'OK') {
          logger.info('🔒 IDEMPOTENCY: Event claimed for processing (Redis)', {
            eventId: eventId.substring(0, 20) + '***',
            processingTtl: processingTtl + 's'
          });
          
          // Also set in memory as backup
          this.memoryStore.set(eventId, {
            timestamp: Date.now(),
            ttl: processingTtl,
            state: 'processing'
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
      }

      // Memory store atomic claim (for development or Redis fallback)
      const now = Date.now();
      const existingRecord = this.memoryStore.get(eventId);
      
      if (existingRecord) {
        // Check if record is still valid (not expired)
        if (now < existingRecord.timestamp + (existingRecord.ttl * 1000)) {
          logger.info('🔄 IDEMPOTENCY: Event already claimed/processed (Memory)', {
            eventId: eventId.substring(0, 20) + '***',
            state: existingRecord.state,
            age: Math.round((now - existingRecord.timestamp) / 1000) + 's'
          });
          return false;
        } else {
          // Clean up expired record and continue to claim
          this.memoryStore.delete(eventId);
        }
      }
      
      // Atomically claim in memory
      this.memoryStore.set(eventId, {
        timestamp: now,
        ttl: processingTtl,
        state: 'processing'
      });
      
      logger.info('🔒 IDEMPOTENCY: Event claimed for processing (Memory)', {
        eventId: eventId.substring(0, 20) + '***',
        processingTtl: processingTtl + 's'
      });
      
      return true;
      
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

      // Always update in memory as backup/fallback
      this.memoryStore.set(eventId, {
        timestamp,
        ttl: ttlSeconds,
        state: 'done'
      });

      logger.info('✅ IDEMPOTENCY: Event marked as completed (Memory)', {
        eventId: eventId.substring(0, 20) + '***',
        ttl: ttlSeconds + 's',
        memorySize: this.memoryStore.size
      });

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
      // Remove from Redis if available
      if (this.redis) {
        const key = `${REDIS_PREFIX}${eventId}`;
        await this.redis.del(key);
        
        logger.warn('🔓 IDEMPOTENCY: Processing claim released (Redis)', {
          eventId: eventId.substring(0, 20) + '***'
        });
      }

      // Remove from memory store
      const wasInMemory = this.memoryStore.delete(eventId);
      
      if (wasInMemory) {
        logger.warn('🔓 IDEMPOTENCY: Processing claim released (Memory)', {
          eventId: eventId.substring(0, 20) + '***',
          memorySize: this.memoryStore.size
        });
      }

    } catch (error: any) {
      logger.error('❌ IDEMPOTENCY: Error releasing processing claim', {
        eventId: eventId.substring(0, 20) + '***',
        error: error.message
      });
      // Don't throw - we tried our best to release the claim
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
    
    // Check if event exists in either processing or done state
    try {
      // Check Redis first if available
      if (this.redis) {
        const key = `${REDIS_PREFIX}${eventId}`;
        const exists = await this.redis.exists(key);
        if (exists) return true;
      }

      // Check memory store
      const memoryRecord = this.memoryStore.get(eventId);
      if (memoryRecord) {
        const now = Date.now();
        if (now < memoryRecord.timestamp + (memoryRecord.ttl * 1000)) {
          return true;
        } else {
          this.memoryStore.delete(eventId);
        }
      }

      return false;
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
   * Get statistics about the idempotency store
   */
  getStats(): {
    memoryStoreSize: number;
    hasRedis: boolean;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const record of this.memoryStore.values()) {
      if (record.timestamp < oldestTimestamp) {
        oldestTimestamp = record.timestamp;
      }
      if (record.timestamp > newestTimestamp) {
        newestTimestamp = record.timestamp;
      }
    }

    return {
      memoryStoreSize: this.memoryStore.size,
      hasRedis: !!this.redis,
      oldestEntry: oldestTimestamp !== Infinity ? new Date(oldestTimestamp).toISOString() : undefined,
      newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp).toISOString() : undefined
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
   * Clean up expired entries from memory store
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    const initialSize = this.memoryStore.size;

    for (const [eventId, record] of this.memoryStore.entries()) {
      if (now >= record.timestamp + (record.ttl * 1000)) {
        this.memoryStore.delete(eventId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('🧹 IDEMPOTENCY: Cleaned up expired entries', {
        cleaned: cleanedCount,
        before: initialSize,
        after: this.memoryStore.size,
        memoryFreed: `${cleanedCount} entries`
      });
    } else {
      logger.debug('🧹 IDEMPOTENCY: Cleanup cycle completed', {
        checked: initialSize,
        expired: 0
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

    // Clear memory store
    const size = this.memoryStore.size;
    this.memoryStore.clear();

    logger.info('🛑 IDEMPOTENCY: Service shutdown completed', {
      clearedEntries: size
    });
  }

  /**
   * Force cleanup of all expired entries (for testing/debugging)
   */
  forceCleanup(): number {
    const initialSize = this.memoryStore.size;
    this.cleanupExpiredEntries();
    return initialSize - this.memoryStore.size;
  }
}

// Global idempotency service instance
let idempotencyService: IdempotencyService | null = null;

/**
 * Initialize the global idempotency service
 * @param redis - Redis instance (optional, will use memory fallback)
 */
export function initializeIdempotencyService(redis: Redis | null = null): IdempotencyService {
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
    // Auto-initialize with memory-only store if not already initialized
    logger.warn('⚠️ IDEMPOTENCY: Auto-initializing with memory-only store');
    idempotencyService = new IdempotencyService(null);
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