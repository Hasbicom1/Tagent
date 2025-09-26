/**
 * Simple Rate Limiting Module
 * Basic implementation for Railway deployment
 */

import { Redis } from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // limit each IP to 100 requests per windowMs
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

export class MultiLayerRateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  middleware = (req: any, res: any, next: any) => {
    // Simple rate limiting implementation
    // For now, just pass through - can be enhanced later
    next();
  };

  async checkLimit(identifier: string): Promise<boolean> {
    try {
      const key = `rate_limit:${identifier}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(this.config.windowMs / 1000));
      }
      
      return current <= this.config.maxRequests;
    } catch (error) {
      console.warn('Rate limiting check failed:', error);
      return true; // Allow request if rate limiting fails
    }
  }
}
