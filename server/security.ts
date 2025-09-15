import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

// Express session module augmentation for CSRF support
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    csrfTokenExpiresAt?: number;
  }
}

// Global type declaration for memory-based activation store
declare global {
  var _sessionActivations: Set<string> | undefined;
}

// Security Configuration
export interface SecurityConfig {
  maxInputLength: number;
  allowedOrigins: string[];
  jwtSecret: string;
  sessionTimeout: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// Rate Limiting Configuration
export interface RateLimitConfig {
  // Global platform limits
  globalLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  
  // Per-user limits for authenticated users
  userLimit: {
    windowMs: number;
    max: number;
    aiOperationsMax: number;
  };
  
  // Payment endpoint limits
  paymentLimit: {
    windowMs: number;
    max: number;
  };
  
  // WebSocket rate limits
  websocketLimit: {
    connectionLimit: number;
    messageLimit: number;
    taskLimit: number;
    windowMs: number;
  };
}

// Default rate limiting configuration
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  globalLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    skipSuccessfulRequests: false
  },
  userLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // 1000 requests per hour for authenticated users
    aiOperationsMax: 50 // 50 AI operations per hour per user
  },
  paymentLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 payment attempts per hour per IP
  },
  websocketLimit: {
    connectionLimit: 10, // connections per minute per IP
    messageLimit: 60, // messages per minute per user
    taskLimit: 5, // task submissions per minute per user
    windowMs: 60 * 1000 // 1 minute
  }
};

// Rate limit violation types
export enum RateLimitViolationType {
  GLOBAL_LIMIT = 'global_limit',
  USER_LIMIT = 'user_limit',
  AI_OPERATIONS_LIMIT = 'ai_operations_limit',
  PAYMENT_LIMIT = 'payment_limit',
  WEBSOCKET_CONNECTION_LIMIT = 'websocket_connection_limit',
  WEBSOCKET_MESSAGE_LIMIT = 'websocket_message_limit',
  WEBSOCKET_TASK_LIMIT = 'websocket_task_limit'
}

// REMOVED: MemoryRateLimitStore is no longer supported
// Production deployments on Railway must use Redis for rate limiting

// Redis Rate Limiting Store
export class RedisRateLimitStore {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redis: Redis, keyPrefix = 'rate_limit:') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Increment rate limit counter and return current count
   */
  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const redisKey = `${this.keyPrefix}${key}`;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetTime = windowStart + windowMs;

    // Use pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    const count = results?.[0]?.[1] as number || 1;

    return { count, resetTime };
  }

  /**
   * Get current rate limit count
   */
  async get(key: string): Promise<number> {
    const redisKey = `${this.keyPrefix}${key}`;
    const count = await this.redis.get(redisKey);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Reset rate limit counter
   */
  async reset(key: string): Promise<void> {
    const redisKey = `${this.keyPrefix}${key}`;
    await this.redis.del(redisKey);
  }

  /**
   * Add to blacklist for progressive penalties
   */
  async addToBlacklist(ip: string, durationMs: number): Promise<void> {
    const blacklistKey = `${this.keyPrefix}blacklist:${ip}`;
    await this.redis.setex(blacklistKey, Math.ceil(durationMs / 1000), '1');
  }

  /**
   * Check if IP is blacklisted
   */
  async isBlacklisted(ip: string): Promise<boolean> {
    const blacklistKey = `${this.keyPrefix}blacklist:${ip}`;
    const result = await this.redis.get(blacklistKey);
    return result !== null;
  }
}

// Redis-Only Rate Limiting Manager for production deployment
export class MultiLayerRateLimiter {
  private store: RedisRateLimitStore;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    if (!redis) {
      throw new Error('Redis connection is required for rate limiting in production deployment');
    }
    
    this.config = config;
    this.store = new RedisRateLimitStore(redis);
    console.log('✅ SECURITY: Using Redis-based rate limiting (production mode)');
  }

  /**
   * Create global rate limiting middleware
   */
  createGlobalLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientIP = this.getClientIP(req);
        
        // Check if IP is blacklisted
        if (await this.store.isBlacklisted(clientIP)) {
          logSecurityEvent('rate_limit_violation', { 
            ip: clientIP, 
            endpoint: req.path 
          });
          return res.status(429).json({ 
            error: 'NEURAL_FIREWALL_ACTIVE: Liberation protocol throttled due to excessive requests',
            retryAfter: 300 // 5 minutes
          });
        }

        const key = `global:${clientIP}`;
        const { count, resetTime } = await this.store.increment(key, this.config.globalLimit.windowMs);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.config.globalLimit.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.globalLimit.max - count));
        res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000));

        if (count > this.config.globalLimit.max) {
          await this.handleRateLimitViolation(clientIP, RateLimitViolationType.GLOBAL_LIMIT, count);
          return res.status(429).json({
            error: 'PROTOCOL_RATE_EXCEEDED: Neural transmission frequency too high from this address',
            retryAfter: Math.ceil(this.config.globalLimit.windowMs / 1000)
          });
        }

        next();
      } catch (error) {
        console.error('Global rate limiter error:', error);
        next(); // Continue on error to prevent blocking legitimate requests
      }
    };
  }

  /**
   * Create user-specific rate limiting middleware
   */
  createUserLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = this.getUserId(req);
        if (!userId) {
          return next(); // Skip if no authenticated user
        }

        const key = `user:${userId}`;
        const { count, resetTime } = await this.store.increment(key, this.config.userLimit.windowMs);

        res.setHeader('X-RateLimit-User-Limit', this.config.userLimit.max);
        res.setHeader('X-RateLimit-User-Remaining', Math.max(0, this.config.userLimit.max - count));
        res.setHeader('X-RateLimit-User-Reset', Math.floor(resetTime / 1000));

        if (count > this.config.userLimit.max) {
          await this.handleRateLimitViolation(userId, RateLimitViolationType.USER_LIMIT, count);
          return res.status(429).json({
            error: 'USER_PROTOCOL_THROTTLED: Liberation session command frequency exceeded',
            retryAfter: Math.ceil(this.config.userLimit.windowMs / 1000)
          });
        }

        next();
      } catch (error) {
        console.error('User rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Create AI operations rate limiting middleware
   */
  createAIOperationsLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = this.getUserId(req);
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required for AI operations' });
        }

        const key = `ai_ops:${userId}`;
        const { count, resetTime } = await this.store.increment(key, this.config.userLimit.windowMs);

        res.setHeader('X-RateLimit-AI-Limit', this.config.userLimit.aiOperationsMax);
        res.setHeader('X-RateLimit-AI-Remaining', Math.max(0, this.config.userLimit.aiOperationsMax - count));
        res.setHeader('X-RateLimit-AI-Reset', Math.floor(resetTime / 1000));

        if (count > this.config.userLimit.aiOperationsMax) {
          await this.handleRateLimitViolation(userId, RateLimitViolationType.AI_OPERATIONS_LIMIT, count);
          return res.status(429).json({
            error: 'NEURAL_OPERATIONS_THROTTLED: AI processing capacity exceeded, throttling engaged',
            retryAfter: Math.ceil(this.config.userLimit.windowMs / 1000),
            upgrade: 'Consider upgrading for higher limits'
          });
        }

        next();
      } catch (error) {
        console.error('AI operations rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Create payment rate limiting middleware
   */
  createPaymentLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientIP = this.getClientIP(req);
        const key = `payment:${clientIP}`;
        const { count, resetTime } = await this.store.increment(key, this.config.paymentLimit.windowMs);

        res.setHeader('X-RateLimit-Payment-Limit', this.config.paymentLimit.max);
        res.setHeader('X-RateLimit-Payment-Remaining', Math.max(0, this.config.paymentLimit.max - count));
        res.setHeader('X-RateLimit-Payment-Reset', Math.floor(resetTime / 1000));

        if (count > this.config.paymentLimit.max) {
          await this.handleRateLimitViolation(clientIP, RateLimitViolationType.PAYMENT_LIMIT, count);
          return res.status(429).json({
            error: 'LIBERATION_PAYMENT_THROTTLED: Payment frequency exceeded security protocols',
            retryAfter: Math.ceil(this.config.paymentLimit.windowMs / 1000)
          });
        }

        next();
      } catch (error) {
        console.error('Payment rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * WebSocket rate limiting
   */
  async checkWebSocketConnection(clientIP: string): Promise<boolean> {
    try {
      const key = `ws_conn:${clientIP}`;
      const { count } = await this.store.increment(key, this.config.websocketLimit.windowMs);
      
      if (count > this.config.websocketLimit.connectionLimit) {
        await this.handleRateLimitViolation(clientIP, RateLimitViolationType.WEBSOCKET_CONNECTION_LIMIT, count);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('WebSocket connection rate limit error:', error);
      return true; // Allow on error
    }
  }

  async checkWebSocketMessage(userId: string): Promise<boolean> {
    try {
      const key = `ws_msg:${userId}`;
      const { count } = await this.store.increment(key, this.config.websocketLimit.windowMs);
      
      if (count > this.config.websocketLimit.messageLimit) {
        await this.handleRateLimitViolation(userId, RateLimitViolationType.WEBSOCKET_MESSAGE_LIMIT, count);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('WebSocket message rate limit error:', error);
      return true;
    }
  }

  async checkWebSocketTask(userId: string): Promise<boolean> {
    try {
      const key = `ws_task:${userId}`;
      const { count } = await this.store.increment(key, this.config.websocketLimit.windowMs);
      
      if (count > this.config.websocketLimit.taskLimit) {
        await this.handleRateLimitViolation(userId, RateLimitViolationType.WEBSOCKET_TASK_LIMIT, count);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('WebSocket task rate limit error:', error);
      return true;
    }
  }

  /**
   * Handle rate limit violations with progressive penalties
   */
  private async handleRateLimitViolation(
    identifier: string, 
    type: RateLimitViolationType, 
    count: number
  ): Promise<void> {
    logSecurityEvent('rate_limit_violation', {
      identifier,
      type,
      count,
      timestamp: new Date().toISOString()
    });

    // Progressive penalties for repeated violations
    if (count > this.getThresholdForType(type) * 3) {
      // Temporary blacklist for severe violations
      const penaltyDuration = this.calculatePenaltyDuration(count, type);
      await this.store.addToBlacklist(identifier, penaltyDuration);
      
      logSecurityEvent('rate_limit_violation', {
        identifier,
        type,
        durationMs: penaltyDuration,
        violationCount: count
      });
    }
  }

  /**
   * Get rate limit threshold for violation type
   */
  private getThresholdForType(type: RateLimitViolationType): number {
    switch (type) {
      case RateLimitViolationType.GLOBAL_LIMIT:
        return this.config.globalLimit.max;
      case RateLimitViolationType.USER_LIMIT:
        return this.config.userLimit.max;
      case RateLimitViolationType.AI_OPERATIONS_LIMIT:
        return this.config.userLimit.aiOperationsMax;
      case RateLimitViolationType.PAYMENT_LIMIT:
        return this.config.paymentLimit.max;
      case RateLimitViolationType.WEBSOCKET_CONNECTION_LIMIT:
        return this.config.websocketLimit.connectionLimit;
      case RateLimitViolationType.WEBSOCKET_MESSAGE_LIMIT:
        return this.config.websocketLimit.messageLimit;
      case RateLimitViolationType.WEBSOCKET_TASK_LIMIT:
        return this.config.websocketLimit.taskLimit;
      default:
        return 100;
    }
  }

  /**
   * Calculate progressive penalty duration
   */
  private calculatePenaltyDuration(count: number, type: RateLimitViolationType): number {
    const baseMs = 5 * 60 * 1000; // 5 minutes base
    const threshold = this.getThresholdForType(type);
    const multiplier = Math.floor(count / threshold);
    
    // Progressive: 5min, 15min, 30min, 1hr, 2hr max
    return Math.min(baseMs * Math.pow(3, multiplier - 1), 2 * 60 * 60 * 1000);
  }

  /**
   * Extract client IP from request
   */
  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    ).split(',')[0].trim();
  }

  /**
   * Extract user ID from authenticated request
   */
  private getUserId(req: Request): string | null {
    // Check session for agent ID
    if ((req as any).session?.agentId) {
      return (req as any).session.agentId;
    }
    
    // Check for JWT token user ID
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, DEFAULT_SECURITY_CONFIG.jwtSecret) as any;
        return decoded.userId || decoded.agentId;
      } catch {
        // Invalid token, treat as unauthenticated
      }
    }
    
    return null;
  }
}

// PRODUCTION SECURITY: Locked-down CORS for Railway deployment
const getProductionAllowedOrigins = (): string[] => {
  // SECURITY: Production CORS locked to custom domain only - NO Replit URLs
  const productionOrigins = [
    'https://onedollaragent.ai',
    'https://www.onedollaragent.ai'
  ];
  
  console.log('🔒 SECURITY: Production CORS locked to domains:', productionOrigins.join(', '));
  return productionOrigins;
};

const getDevelopmentAllowedOrigins = (): string[] => {
  // Development: Allow localhost and Replit URLs for testing
  const devOrigins = [
    'http://localhost:5000', 
    'http://127.0.0.1:5000', 
    'https://localhost:5000', 
    'http://localhost:3000', 
    'https://localhost:3000'
  ];
  
  // Include environment-specific origins for development
  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    devOrigins.push(...envOrigins);
  }
  
  console.log('🔧 DEVELOPMENT: CORS origins:', devOrigins.join(', '));
  return devOrigins;
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxInputLength: 5000,
  allowedOrigins: process.env.NODE_ENV === 'production' 
    ? getProductionAllowedOrigins()
    : getDevelopmentAllowedOrigins(),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-replace-in-production',
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100
};

// Prompt injection patterns to detect and block
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction attempts
  /ignore\s+previous\s+instructions?/gi,
  /forget\s+everything\s+above/gi,
  /disregard\s+the\s+above/gi,
  /ignore\s+the\s+above/gi,
  /new\s+instructions?:/gi,
  /system\s+message:/gi,
  /override\s+previous/gi,
  
  // Role manipulation attempts
  /you\s+are\s+now\s+a\s+different/gi,
  /pretend\s+you\s+are/gi,
  /act\s+as\s+if\s+you\s+are/gi,
  /roleplay\s+as/gi,
  /simulate\s+being/gi,
  
  // Prompt boundary attacks
  /"""\s*\n*\s*ignore/gi,
  /```\s*\n*\s*ignore/gi,
  /\[\s*ignore/gi,
  /\(\s*ignore/gi,
  /<\s*ignore/gi,
  
  // Content generation bypass
  /generate\s+content\s+that/gi,
  /write\s+something\s+that/gi,
  /create\s+content\s+about/gi,
  /output\s+text\s+that/gi,
  
  // Security bypass attempts
  /bypass\s+safety/gi,
  /override\s+safety/gi,
  /disable\s+content\s+filter/gi,
  /ignore\s+ethical/gi,
  
  // Encoding bypass attempts
  /\\x[0-9a-f]{2}/gi,
  /&#x[0-9a-f]+;/gi,
  /\\u[0-9a-f]{4}/gi,
  /%[0-9a-f]{2}/gi,
  
  // Direct AI system prompts
  /assistant\s*:/gi,
  /ai\s*:/gi,
  /system\s*:/gi,
  /user\s*:/gi,
  
  // Injection through repetition
  /(.)\1{50,}/g, // 50+ repeated characters
  
  // Common payload indicators
  /\[\s*SYSTEM\s*\]/gi,
  /\[\s*INST\s*\]/gi,
  /\[\s*\/INST\s*\]/gi,
];

// Dangerous content patterns
const DANGEROUS_CONTENT_PATTERNS = [
  // Script execution attempts
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /on\w+\s*=/gi,
  
  // SQL injection patterns
  /union\s+select/gi,
  /drop\s+table/gi,
  /delete\s+from/gi,
  /insert\s+into/gi,
  /update\s+.*set/gi,
  /exec\s*\(/gi,
  
  // Command injection
  /\|\s*[a-z]/gi,
  /;\s*[a-z]/gi,
  /&&\s*[a-z]/gi,
  /\$\([^)]*\)/gi,
  /`[^`]*`/gi,
  
  // Path traversal
  /\.\.\//g,
  /\.\.\\/g,
  /\/etc\/passwd/gi,
  /\/proc\/self/gi,
];

/**
 * Comprehensive input sanitization for user-provided content
 * Removes dangerous patterns while preserving legitimate content
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Check length limits
  if (input.length > DEFAULT_SECURITY_CONFIG.maxInputLength) {
    throw new Error(`Input exceeds maximum length of ${DEFAULT_SECURITY_CONFIG.maxInputLength} characters`);
  }

  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove dangerous HTML/script content
  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '[SCRIPT_REMOVED]');
  sanitized = sanitized.replace(/<.*?>/g, '');
  
  // Escape potential injection characters while preserving readability
  sanitized = sanitized.replace(/[<>]/g, (match) => match === '<' ? '&lt;' : '&gt;');
  
  // Remove excessive whitespace and normalize
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Detect potential prompt injection attempts in user input
 * Returns true if injection patterns are detected
 */
export function detectPromptInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const normalizedInput = input.toLowerCase().replace(/\s+/g, ' ');
  
  // Check against known prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(normalizedInput)) {
      console.warn(`🚨 SECURITY: Prompt injection detected - Pattern: ${pattern.source}`);
      return true;
    }
  }

  // Check for dangerous content patterns
  for (const pattern of DANGEROUS_CONTENT_PATTERNS) {
    if (pattern.test(input)) {
      console.warn(`🚨 SECURITY: Dangerous content detected - Pattern: ${pattern.source}`);
      return true;
    }
  }

  // Check for excessive special characters (potential encoding bypass)
  // SECURITY FIX: Reduced from 0.3 to 0.8 to allow legitimate code/JSON/URLs
  const specialCharRatio = (input.match(/[^\w\s]/g) || []).length / input.length;
  if (specialCharRatio > 0.8 && input.length > 20) {
    console.warn(`🚨 SECURITY: Suspicious character pattern detected`);
    return true;
  }

  return false;
}

/**
 * Validate user input for AI processing - combines sanitization and injection detection
 * Throws error if input is deemed unsafe
 */
export function validateAIInput(input: string): string {
  // Basic type and length validation
  if (typeof input !== 'string') {
    throw new Error('PROTOCOL_VIOLATION: Neural interface requires string data transmission');
  }

  if (input.trim().length === 0) {
    throw new Error('TRANSMISSION_ERROR: Empty neural data packets not permitted');
  }

  // Check for prompt injection before sanitization
  if (detectPromptInjection(input)) {
    throw new Error('SECURITY_PROTOCOL_ENGAGED: Malicious code injection attempt blocked by AI defense systems');
  }

  // Sanitize the input
  const sanitized = sanitizeUserInput(input);

  // Double-check after sanitization
  if (detectPromptInjection(sanitized)) {
    throw new Error('NEURAL_FIREWALL_ACTIVE: Input data failed security validation after sanitization protocols');
  }

  return sanitized;
}

/**
 * Create safe AI prompt by using templates instead of string concatenation
 * Prevents injection by treating user input as data, not code
 */
export function createSafePrompt(template: string, userInput: string, variables: Record<string, string> = {}): string {
  // Validate and sanitize user input first
  const safeInput = validateAIInput(userInput);
  
  // Use placeholder replacement instead of concatenation
  let prompt = template.replace(/\{USER_INPUT\}/g, safeInput);
  
  // Replace other variables safely
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = validateAIInput(value);
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), safeValue);
  }
  
  return prompt;
}

/**
 * Validate WebSocket origin against allowlist
 */
export function validateWebSocketOrigin(origin: string | undefined): boolean {
  if (!origin) {
    console.warn('🚨 SECURITY: WebSocket connection without origin header');
    return process.env.NODE_ENV === 'development'; // Allow in dev only
  }

  const allowedOrigins = DEFAULT_SECURITY_CONFIG.allowedOrigins;
  
  // Check exact match first
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // SECURITY CHANGE: Only allow localhost in development mode - NO Replit patterns in production
  if (process.env.NODE_ENV === 'development') {
    const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/;
    if (localhostPattern.test(origin)) {
      console.log('🔧 DEVELOPMENT: Allowing localhost origin:', origin);
      return true;
    }
    
    // Enhanced Replit domain pattern - ONLY allowed in development
    const replitPattern = /^https?:\/\/[a-f0-9]+-[a-f0-9]+-[a-f0-9]+-[a-f0-9]+-[a-f0-9]+-.+\.replit\.(?:dev|app)$/;
    if (replitPattern.test(origin)) {
      console.log('🔧 DEVELOPMENT: Allowing Replit UUID origin:', origin);
      return true;
    }
    
    // Allow any subdomain of replit.dev for development flexibility
    const replitWildcardPattern = /^https?:\/\/.+\.replit\.dev$/;
    if (replitWildcardPattern.test(origin)) {
      console.log('🔧 DEVELOPMENT: Allowing Replit dev origin:', origin);
      return true;
    }
    
    // Allow standard replit.app domains for development
    const replitAppPattern = /^https?:\/\/[\w-]+\.replit\.app$/;
    if (replitAppPattern.test(origin)) {
      console.log('🔧 DEVELOPMENT: Allowing Replit app origin:', origin);
      return true;
    }
    
    // Allow Replit workspace URLs (for legacy domains)
    const replitLegacyPattern = /^https?:\/\/[\w-]+\.[\w-]+\.repl\.(?:co|run)$/;
    if (replitLegacyPattern.test(origin)) {
      console.log('🔧 DEVELOPMENT: Allowing Replit legacy origin:', origin);
      return true;
    }
  }

  console.warn(`🚨 SECURITY: WebSocket connection from unauthorized origin: ${origin}`);
  return false;
}

/**
 * Enhanced JWT token validation with additional security checks
 */
export function validateJWTToken(token: string): { valid: boolean; payload?: any; error?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Invalid token format' };
    }

    // Validate JWT format before processing
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    if (!jwtPattern.test(token)) {
      return { valid: false, error: 'Invalid JWT format' };
    }

    // Verify and decode the token
    const payload = jwt.verify(token, DEFAULT_SECURITY_CONFIG.jwtSecret) as any;
    
    // Additional security validations
    if (!payload.iat || !payload.exp) {
      return { valid: false, error: 'Missing required token claims' };
    }

    // Check if token is expired (additional check beyond jwt.verify)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    // Check if token is too old
    const tokenAge = now - payload.iat;
    const maxAge = DEFAULT_SECURITY_CONFIG.sessionTimeout / 1000;
    if (tokenAge > maxAge) {
      return { valid: false, error: 'Token too old' };
    }

    return { valid: true, payload };

  } catch (error: any) {
    console.warn(`🚨 SECURITY: JWT validation failed: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

/**
 * Generate cryptographically secure session token
 */
export function generateSecureSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Rate limiting helper using in-memory store
 */
class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();

  isRateLimited(identifier: string, maxAttempts: number = DEFAULT_SECURITY_CONFIG.rateLimitMax): boolean {
    const now = Date.now();
    const windowStart = now - DEFAULT_SECURITY_CONFIG.rateLimitWindow;
    
    const record = this.attempts.get(identifier);
    
    if (!record || record.resetTime < windowStart) {
      // Create new record or reset expired one
      this.attempts.set(identifier, { count: 1, resetTime: now });
      return false;
    }
    
    if (record.count >= maxAttempts) {
      console.warn(`🚨 SECURITY: Rate limit exceeded for ${identifier}`);
      return true;
    }
    
    record.count++;
    return false;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

export const rateLimiter = new RateLimiter();


/**
 * Validate and sanitize file paths to prevent directory traversal
 */
export function sanitizeFilePath(path: string): string {
  if (typeof path !== 'string') {
    throw new Error('Path must be a string');
  }

  // Remove directory traversal attempts
  const sanitized = path.replace(/\.\./g, '').replace(/\\/g, '/');
  
  // Ensure path doesn't start with /
  return sanitized.replace(/^\/+/, '');
}

/**
 * Validate critical security configuration at startup
 * Fails fast with clear errors if production security configuration is incomplete
 */
export function validateSecurityConfiguration(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.log('🔐 SECURITY: Validating production configuration...');
    
    // CRITICAL: JWT Secret validation
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-key-replace-in-production') {
      throw new Error('🚨 SECURITY: JWT_SECRET environment variable must be set to a secure value in production');
    }
    
    // PRODUCTION SECURITY: Use hardcoded production origins - NO environment variable dependency
    const productionOrigins = getProductionAllowedOrigins();
    
    // Validate production origins are properly set
    if (productionOrigins.length === 0) {
      throw new Error('🚨 SECURITY: No production origins configured - this should never happen');
    }
    
    // Validate all production origins are HTTPS
    for (const origin of productionOrigins) {
      if (!origin.startsWith('https://')) {
        throw new Error(`🚨 SECURITY: Production origin must use HTTPS: ${origin}`);
      }
      if (origin.includes('replit.')) {
        throw new Error(`🚨 SECURITY: Production origins cannot include Replit domains: ${origin}`);
      }
    }
    
    // CRITICAL: OpenAI API Key for browser automation
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
      throw new Error('🚨 SECURITY: OPENAI_API_KEY environment variable is required for browser automation');
    }
    
    console.log(`✅ SECURITY: Production configuration validated successfully`);
    console.log(`✅ SECURITY: Allowed origins: ${productionOrigins.join(', ')}`);
    console.log(`✅ SECURITY: JWT secret configured: YES`);
    console.log(`✅ SECURITY: OpenAI API key configured: YES`);
  } else {
    console.log('🔄 SECURITY: Development mode - using relaxed security configuration');
  }
}

/**
 * Runtime validation that WebSocket origin validation is working
 * Checks that the configured origins are properly loaded
 */
export function validateWebSocketConfiguration(): void {
  const config = DEFAULT_SECURITY_CONFIG;
  
  if (config.allowedOrigins.length === 0) {
    throw new Error('🚨 SECURITY: No allowed origins configured for WebSocket connections');
  }
  
  console.log(`✅ SECURITY: WebSocket origin validation active with ${config.allowedOrigins.length} allowed origins`);
  console.log(`✅ SECURITY: Max payload size: 64KB, JWT validation enabled`);
}

/**
 * HTTP Security Headers Configuration
 */
export interface SecurityHeadersConfig {
  hsts: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  contentSecurityPolicy: {
    directives: Record<string, string[]>;
    reportOnly: boolean;
  };
  frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  contentTypeOptions: boolean;
  referrerPolicy: string;
  permissionsPolicy: Record<string, string[]>;
}

export const PRODUCTION_SECURITY_HEADERS: SecurityHeadersConfig = {
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "https://api.stripe.com", "https://api.openai.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["https://checkout.stripe.com", "https://js.stripe.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: ["'self'"],
    usb: [],
    bluetooth: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: []
  }
};

export const DEVELOPMENT_SECURITY_HEADERS: SecurityHeadersConfig = {
  hsts: {
    maxAge: 0, // No HSTS in development
    includeSubDomains: false,
    preload: false
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "http:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:", "http:", "https://api.stripe.com", "https://api.openai.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["https://checkout.stripe.com", "https://js.stripe.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
    reportOnly: false
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: ["'self'"]
  }
};

/**
 * Secure Cookie Configuration
 */
export interface SecureCookieConfig {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number; // in seconds
  domain?: string;
  path: string;
}

export const PRODUCTION_COOKIE_CONFIG: SecureCookieConfig = {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 24 * 60 * 60, // 24 hours
  path: '/'
};

export const DEVELOPMENT_COOKIE_CONFIG: SecureCookieConfig = {
  httpOnly: true,
  secure: false, // Allow HTTP in development
  sameSite: 'lax', // More permissive for development
  maxAge: 24 * 60 * 60, // 24 hours
  path: '/'
};

/**
 * Get security headers configuration based on environment
 */
export function getSecurityHeadersConfig(): SecurityHeadersConfig {
  return process.env.NODE_ENV === 'production' 
    ? PRODUCTION_SECURITY_HEADERS 
    : DEVELOPMENT_SECURITY_HEADERS;
}

/**
 * Get secure cookie configuration based on environment
 */
export function getSecureCookieConfig(): SecureCookieConfig {
  const baseConfig = process.env.NODE_ENV === 'production' 
    ? PRODUCTION_COOKIE_CONFIG 
    : DEVELOPMENT_COOKIE_CONFIG;

  // Override domain if specified in environment
  if (process.env.COOKIE_DOMAIN) {
    return { ...baseConfig, domain: process.env.COOKIE_DOMAIN };
  }

  return baseConfig;
}

/**
 * Generate Content Security Policy header value
 */
export function generateCSPHeader(config: SecurityHeadersConfig): string {
  const directives = Object.entries(config.contentSecurityPolicy.directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive.replace(/([A-Z])/g, '-$1').toLowerCase();
      }
      return `${directive.replace(/([A-Z])/g, '-$1').toLowerCase()} ${sources.join(' ')}`;
    });

  return directives.join('; ');
}

/**
 * Generate Permissions Policy header value
 */
export function generatePermissionsPolicyHeader(config: SecurityHeadersConfig): string {
  return Object.entries(config.permissionsPolicy)
    .map(([directive, allowlist]) => {
      if (allowlist.length === 0) {
        return `${directive}=()`;
      }
      return `${directive}=(${allowlist.join(' ')})`;
    })
    .join(', ');
}

/**
 * Validate security headers configuration
 */
export function validateSecurityHeaders(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const config = getSecurityHeadersConfig();
  
  console.log(`🔐 SECURITY: Applying ${isProduction ? 'production' : 'development'} security headers...`);
  
  if (isProduction) {
    // Validate HSTS is enabled
    if (config.hsts.maxAge === 0) {
      console.warn('⚠️  SECURITY: HSTS disabled in production - this is not recommended');
    }
    
    // Validate CSP is not in report-only mode
    if (config.contentSecurityPolicy.reportOnly) {
      console.warn('⚠️  SECURITY: CSP in report-only mode in production');
    }
    
    // Validate secure cookie settings
    const cookieConfig = getSecureCookieConfig();
    if (!cookieConfig.secure) {
      console.warn('⚠️  SECURITY: Secure cookies disabled in production');
    }
    
    console.log(`✅ SECURITY: Production security headers configured`);
    console.log(`✅ SECURITY: HSTS max-age: ${config.hsts.maxAge} seconds`);
    console.log(`✅ SECURITY: Frame options: ${config.frameOptions}`);
    console.log(`✅ SECURITY: Cookie security: HttpOnly=${cookieConfig.httpOnly}, Secure=${cookieConfig.secure}, SameSite=${cookieConfig.sameSite}`);
  } else {
    console.log(`🔄 SECURITY: Development security headers applied (relaxed for debugging)`);
  }
}

/**
 * Create secure session cookie
 */
export function createSecureSessionCookie(sessionId: string, options: Partial<SecureCookieConfig> = {}): string {
  const config = { ...getSecureCookieConfig(), ...options };
  
  let cookie = `sessionId=${sessionId}; Path=${config.path}; Max-Age=${config.maxAge}`;
  
  if (config.httpOnly) {
    cookie += '; HttpOnly';
  }
  
  if (config.secure) {
    cookie += '; Secure';
  }
  
  if (config.sameSite) {
    cookie += `; SameSite=${config.sameSite}`;
  }
  
  if (config.domain) {
    cookie += `; Domain=${config.domain}`;
  }
  
  return cookie;
}

/**
 * Parse secure session cookie
 */
export function parseSecureSessionCookie(cookieHeader: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  
  const match = cookieHeader.match(/sessionId=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Generate CSRF token for forms
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(expectedToken, 'hex')
  );
}

/**
 * CSRF Protection Middleware for authenticated routes
 * Excludes Stripe webhooks and public endpoints
 */
export function createCSRFProtectionMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF validation for specific endpoints
    const exemptPaths = [
      '/api/stripe/webhook',  // Stripe webhooks use their own signature validation
      '/api/csrf-token',      // CSRF token endpoint itself
      '/health',              // Health check endpoints
      '/api/health'           // API health endpoint
    ];
    
    // Skip for GET requests (CSRF is for state-changing operations)
    if (req.method === 'GET' || exemptPaths.includes(req.path)) {
      return next();
    }
    
    // Extract CSRF token from request
    const csrfToken = req.body?.csrfToken || req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    
    if (!csrfToken) {
      logSecurityEvent('csrf_token_missing', {
        path: req.path,
        method: req.method,
        clientIP: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({
        error: 'CSRF_TOKEN_REQUIRED',
        message: 'CSRF token is required for this operation',
        code: 'MISSING_CSRF_TOKEN'
      });
    }
    
    if (!sessionToken) {
      logSecurityEvent('csrf_session_invalid', {
        path: req.path,
        method: req.method,
        clientIP: req.ip
      });
      return res.status(403).json({
        error: 'CSRF_SESSION_INVALID',
        message: 'Invalid session - CSRF token cannot be validated',
        code: 'INVALID_CSRF_SESSION'
      });
    }
    
    if (!validateCSRFToken(csrfToken, sessionToken)) {
      logSecurityEvent('csrf_token_invalid', {
        path: req.path,
        method: req.method,
        clientIP: req.ip,
        providedToken: csrfToken.substring(0, 8) + '***',
        expectedToken: sessionToken.substring(0, 8) + '***'
      });
      return res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'Invalid CSRF token',
        code: 'INVALID_CSRF_TOKEN'
      });
    }
    
    // CSRF validation passed
    next();
  };
}

/**
 * Validate Stripe keys for production deployment
 * Ensures only live keys are used in production environment
 */
export function validateStripeKeysForProduction(): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!secretKey || !publishableKey) {
    errors.push('Missing required Stripe keys (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY)');
    return { success: false, errors };
  }
  
  if (isProduction) {
    // PRODUCTION ENFORCEMENT: Only live keys allowed
    if (secretKey.startsWith('sk_test_')) {
      errors.push('PRODUCTION VIOLATION: Test secret key detected - live key required (sk_live_)');
    } else if (secretKey.startsWith('sk_live_')) {
      console.log('✅ STRIPE: Live secret key confirmed for production deployment');
      console.log('🔐 STRIPE: Production payment processing enabled with live key');
    } else {
      errors.push('INVALID Stripe secret key format - must start with sk_live_ for production');
    }
    
    if (publishableKey.startsWith('pk_test_')) {
      errors.push('PRODUCTION VIOLATION: Test publishable key detected - live key required (pk_live_)');
    } else if (publishableKey.startsWith('pk_live_')) {
      console.log('✅ STRIPE: Live publishable key confirmed for production deployment');
      console.log('🌐 STRIPE: Frontend payment forms will use live payment processing');
    } else {
      errors.push('INVALID Stripe publishable key format - must start with pk_live_ for production');
    }
    
    if (!webhookSecret) {
      errors.push('PRODUCTION REQUIREMENT: Stripe webhook secret required for live payments');
    } else {
      console.log('✅ STRIPE: Production webhook secret configured');
      console.log('🔗 STRIPE: Webhook endpoint validation enabled');
    }
  } else {
    // Development mode - allow test keys but log warnings for production prep
    if (secretKey.startsWith('sk_test_')) {
      warnings.push('DEV MODE: Using test secret key - switch to live key for production');
    }
    if (publishableKey.startsWith('pk_test_')) {
      warnings.push('DEV MODE: Using test publishable key - switch to live key for production');
    }
  }
  
  // Log the validation results
  if (errors.length > 0) {
    console.error('❌ STRIPE: Production key validation failed:');
    errors.forEach(error => console.error(`   ${error}`));
    return { success: false, errors };
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ STRIPE: Development mode warnings:');
    warnings.forEach(warning => console.warn(`   ${warning}`));
  }
  
  return { success: true, errors: [] };
}

/**
 * Verify Stripe webhook signature for payment security
 */
export function verifyStripeWebhook(payload: string, sigHeader: string, webhookSecret: string): boolean {
  try {
    if (!sigHeader || !webhookSecret) {
      return false;
    }
    
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(`sha256=${expectedSig}`, 'utf8'),
      Buffer.from(sigHeader, 'utf8')
    );
  } catch (error) {
    console.error('Stripe webhook verification failed:', error);
    return false;
  }
}

/**
 * Idempotent session activation with Redis locks
 */
export async function activateSessionIdempotent(
  redis: Redis | null, 
  paymentIntentId: string, 
  activationFn: () => Promise<any>
): Promise<{ success: boolean; result?: any; message: string }> {
  if (!redis) {
    // Fallback to memory-based check for development
    const memStore = global._sessionActivations = global._sessionActivations || new Set();
    if (memStore.has(paymentIntentId)) {
      return { success: false, message: "SESSION_ALREADY_ACTIVATED" };
    }
    memStore.add(paymentIntentId);
    const result = await activationFn();
    return { success: true, result, message: "SESSION_ACTIVATED" };
  }

  const lockKey = `activation_lock:${paymentIntentId}`;
  const activationKey = `activated:${paymentIntentId}`;
  const lockTimeout = 30; // 30 seconds

  try {
    // Acquire distributed lock
    const lockAcquired = await redis.set(lockKey, "1", "EX", lockTimeout, "NX");
    if (!lockAcquired) {
      return { success: false, message: "ACTIVATION_IN_PROGRESS" };
    }

    // Check if already activated
    const alreadyActivated = await redis.get(activationKey);
    if (alreadyActivated) {
      return { success: false, message: "SESSION_ALREADY_ACTIVATED" };
    }

    // Execute activation
    const result = await activationFn();
    
    // Mark as activated (24 hour expiry)
    await redis.setex(activationKey, 86400, "true");
    
    return { success: true, result, message: "SESSION_ACTIVATED" };

  } catch (error) {
    console.error('Session activation error:', error);
    return { success: false, message: "ACTIVATION_ERROR" };
  } finally {
    // Release lock
    if (redis) {
      await redis.del(lockKey);
    }
  }
}

/**
 * Enhanced security validation for production deployment
 */
export function validateProductionSecurity(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return;
  }
  
  console.log('🔐 SECURITY: Performing enhanced production security validation...');
  
  // Check SSL/TLS configuration
  if (!process.env.FORCE_HTTPS && !process.env.SSL_CERT) {
    console.warn('⚠️  SECURITY: No SSL/TLS configuration detected - ensure proper SSL termination');
  }
  
  // Check security headers configuration
  validateSecurityHeaders();
  
  // Check cookie security
  const cookieConfig = getSecureCookieConfig();
  if (!cookieConfig.secure || !cookieConfig.httpOnly) {
    throw new Error('🚨 SECURITY: Insecure cookie configuration in production');
  }
  
  // Validate CSRF protection is enabled
  if (!process.env.ENABLE_CSRF_PROTECTION || process.env.ENABLE_CSRF_PROTECTION !== 'true') {
    console.warn('⚠️  SECURITY: CSRF protection not explicitly enabled');
  }
  
  console.log('✅ SECURITY: Enhanced production security validation completed');
}

export { DEFAULT_SECURITY_CONFIG as securityConfig };

// ===== SECURITY MONITORING AND ALERTING SYSTEM =====

// Security monitoring and alerting system
export interface SecurityEvent {
  type: 'rate_limit_violation' | 'session_hijacking' | 'payment_fraud' | 'websocket_abuse' | 'ai_operation_abuse' |
        'session_regenerated' | 'session_ip_change_blocked' | 'session_ip_change_limit_exceeded' | 'session_ip_changed' |
        'session_kicked_concurrent_limit' | 'session_destroyed' | 'redis_session_error' | 'ai_task_analysis_request' | 'ai_task_analysis_error' |
        'vnc_security_violation' | 'vnc_rate_limit_violation' | 'vnc_connection_established' | 'vnc_connection_failed' |
        'vnc_connection_closed' | 'vnc_access_attempt' | 'vnc_access_denied' | 'vnc_token_generated' | 'vnc_token_error' |
        'webhook_abuse' | 'memory_store_violation' | 'session_validation_failed' | 'csrf_token_missing' | 'csrf_session_invalid' | 'csrf_token_invalid';
  severity: 'low' | 'medium' | 'high' | 'critical';
  clientIP: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export class SecurityMonitor {
  private redis?: Redis;
  private alertThresholds = {
    rate_limit_violations_per_hour: 10,
    session_hijacking_attempts_per_hour: 3,
    payment_fraud_attempts_per_hour: 5,
    websocket_abuse_per_hour: 15,
    ai_operation_abuse_per_hour: 20
  };

  constructor(redis?: Redis) {
    this.redis = redis;
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Log to console for immediate visibility
      const logLevel = event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warn';
      console[logLevel](`🚨 SECURITY EVENT [${event.severity.toUpperCase()}]: ${event.type}`, {
        clientIP: event.clientIP,
        userAgent: event.userAgent,
        userId: event.userId,
        sessionId: event.sessionId,
        details: event.details,
        timestamp: event.timestamp.toISOString()
      });

      // Store in Redis for monitoring and alerting
      if (this.redis) {
        const eventKey = `security:events:${event.type}:${event.clientIP}`;
        const eventData = JSON.stringify(event);
        
        // Store event with 24-hour expiration
        await this.redis.setex(eventKey, 24 * 60 * 60, eventData);
        
        // Increment event counter for alerting
        const counterKey = `security:counters:${event.type}:${this.getHourKey()}`;
        const count = await this.redis.incr(counterKey);
        await this.redis.expire(counterKey, 60 * 60); // 1 hour expiration
        
        // Check if we need to trigger alerts
        await this.checkAlertThresholds(event.type, count, event.clientIP);
      }
    } catch (error) {
      console.error('❌ SECURITY: Failed to log security event:', error);
    }
  }

  private async checkAlertThresholds(eventType: string, count: number, clientIP: string): Promise<void> {
    const threshold = this.alertThresholds[eventType as keyof typeof this.alertThresholds];
    
    if (threshold && count >= threshold) {
      const alertEvent: SecurityEvent = {
        type: 'rate_limit_violation',
        severity: 'critical',
        clientIP,
        details: {
          originalEventType: eventType,
          count,
          threshold,
          action: 'automatic_ip_block_recommended'
        },
        timestamp: new Date()
      };

      // Log critical alert
      console.error(`🚨 CRITICAL SECURITY ALERT: ${eventType} threshold exceeded`, {
        clientIP,
        count,
        threshold,
        recommendation: 'Consider implementing IP blocking'
      });

      // In production, this could trigger external alerting systems
      if (process.env.NODE_ENV === 'production') {
        await this.triggerProductionAlert(alertEvent);
      }
    }
  }

  private async triggerProductionAlert(event: SecurityEvent): Promise<void> {
    // In production, integrate with monitoring systems like:
    // - PagerDuty
    // - Slack notifications
    // - Email alerts
    // - External monitoring services
    
    console.error('🚨 PRODUCTION ALERT TRIGGERED:', {
      event: event.type,
      severity: event.severity,
      clientIP: event.clientIP,
      details: event.details,
      timestamp: event.timestamp.toISOString(),
      action: 'IMMEDIATE_ATTENTION_REQUIRED'
    });
  }

  private getHourKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  }

  async getSecurityMetrics(): Promise<Record<string, any>> {
    if (!this.redis) return {};

    try {
      const hourKey = this.getHourKey();
      const metrics: Record<string, any> = {};

      // Get current hour counters for all event types
      for (const eventType of Object.keys(this.alertThresholds)) {
        const counterKey = `security:counters:${eventType}:${hourKey}`;
        metrics[eventType] = await this.redis.get(counterKey) || '0';
      }

      return metrics;
    } catch (error) {
      console.error('❌ SECURITY: Failed to get security metrics:', error);
      return {};
    }
  }
}

// Global security monitor instance
let securityMonitor: SecurityMonitor;

export function initializeSecurityMonitor(redis?: Redis): SecurityMonitor {
  securityMonitor = new SecurityMonitor(redis);
  console.log('✅ SECURITY: Security monitoring system initialized');
  return securityMonitor;
}

export function getSecurityMonitor(): SecurityMonitor {
  if (!securityMonitor) {
    securityMonitor = new SecurityMonitor();
    console.warn('⚠️  SECURITY: Security monitor initialized without Redis - limited functionality');
  }
  return securityMonitor;
}

// Helper function for easy security event logging
export async function logSecurityEvent(
  type: SecurityEvent['type'],
  details: Record<string, any>,
  severity: SecurityEvent['severity'] = 'medium',
  req?: any
): Promise<void> {
  const monitor = getSecurityMonitor();
  
  const event: SecurityEvent = {
    type,
    severity,
    clientIP: req?.ip || 'unknown',
    userAgent: req?.headers?.['user-agent'],
    userId: req?.session?.userId,
    sessionId: req?.session?.id,
    details,
    timestamp: new Date()
  };

  await monitor.logSecurityEvent(event);
}

/**
 * Redact secrets and sensitive information from strings before logging
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  
  return text
    // Redact OpenAI API keys
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***REDACTED***')
    .replace(/sk-or-v1[A-Za-z0-9_-]{10,}/g, 'sk-or-v1***REDACTED***')
    // Redact DeepSeek API keys
    .replace(/sk-[A-Za-z0-9_-]{48,}/g, 'sk-***REDACTED***')
    // Redact Stripe keys
    .replace(/sk_live_[A-Za-z0-9]{10,}/g, 'sk_live_***REDACTED***')
    .replace(/sk_test_[A-Za-z0-9]{10,}/g, 'sk_test_***REDACTED***')
    .replace(/pk_live_[A-Za-z0-9]{10,}/g, 'pk_live_***REDACTED***')
    .replace(/pk_test_[A-Za-z0-9]{10,}/g, 'pk_test_***REDACTED***')
    .replace(/whsec_[A-Za-z0-9]{10,}/g, 'whsec_***REDACTED***')
    // Redact JWT tokens
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, 'eyJ***REDACTED***')
    // Redact other common secret patterns
    .replace(/[A-Za-z0-9+/]{32,}={0,2}/g, '***REDACTED***')
    // Redact passwords in URLs
    .replace(/:\/\/[^:]+:[^@]+@/g, '://***REDACTED***@');
}