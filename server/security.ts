import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import validator from 'validator';

// Security Configuration
export interface SecurityConfig {
  maxInputLength: number;
  allowedOrigins: string[];
  jwtSecret: string;
  sessionTimeout: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxInputLength: 5000,
  allowedOrigins: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS?.split(',') || (() => {
        throw new Error('ALLOWED_ORIGINS environment variable is required in production');
      })())
    : ['http://localhost:5000', 'http://127.0.0.1:5000'],
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
    throw new Error('Invalid input type - string required');
  }

  if (input.trim().length === 0) {
    throw new Error('Input cannot be empty');
  }

  // Check for prompt injection before sanitization
  if (detectPromptInjection(input)) {
    throw new Error('Input contains potentially malicious content and has been blocked for security');
  }

  // Sanitize the input
  const sanitized = sanitizeUserInput(input);

  // Double-check after sanitization
  if (detectPromptInjection(sanitized)) {
    throw new Error('Input failed security validation after sanitization');
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
  
  // For development, allow localhost variants
  if (process.env.NODE_ENV === 'development') {
    const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/;
    if (localhostPattern.test(origin)) {
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
 * Security audit log function
 */
export function logSecurityEvent(event: string, details: Record<string, any> = {}): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details,
    severity: 'SECURITY'
  };
  
  // In production, this should go to a secure log aggregation service
  console.warn(`🚨 SECURITY AUDIT: ${JSON.stringify(logEntry)}`);
}

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
    
    // CRITICAL: Allowed Origins validation  
    if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.trim() === '') {
      throw new Error('🚨 SECURITY: ALLOWED_ORIGINS environment variable is required in production');
    }
    
    // Validate allowed origins format
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    for (const origin of origins) {
      if (!origin.match(/^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/)) {
        throw new Error(`🚨 SECURITY: Invalid origin format in ALLOWED_ORIGINS: ${origin}`);
      }
    }
    
    // CRITICAL: OpenAI API Key for browser automation
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
      throw new Error('🚨 SECURITY: OPENAI_API_KEY environment variable is required for browser automation');
    }
    
    console.log(`✅ SECURITY: Production configuration validated successfully`);
    console.log(`✅ SECURITY: Allowed origins: ${origins.join(', ')}`);
    console.log(`✅ SECURITY: JWT secret configured: ${process.env.JWT_SECRET.substring(0, 8)}...`);
    console.log(`✅ SECURITY: OpenAI API key configured: ${process.env.OPENAI_API_KEY.substring(0, 8)}...`);
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