/**
 * JWT UTILITIES FOR WEBSOCKET AUTHENTICATION
 * 
 * Real JWT token generation and validation for WebSocket connections
 * No mocks, no demos - 100% production ready
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // 24 hours to match session TTL

/**
 * Generate JWT token for WebSocket authentication
 * @param {string} sessionId - Session ID
 * @param {string} agentId - Agent ID
 * @returns {string} JWT token
 */
export function generateWebSocketToken(sessionId, agentId) {
  try {
    console.log('🔐 JWT: Generating WebSocket token for session:', sessionId);
    
    const payload = {
      sessionId,
      agentId,
      type: 'websocket_auth',
      iat: Math.floor(Date.now() / 1000)
      // ❌ REMOVED: exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) - conflicts with expiresIn
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { 
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRES_IN
    });
    
    console.log('✅ JWT: Token generated successfully');
    return token;
    
  } catch (error) {
    console.error('❌ JWT: Token generation failed:', error);
    throw new Error(`JWT generation failed: ${error.message}`);
  }
}

/**
 * Verify JWT token for WebSocket authentication
 * @param {string} token - JWT token
 * @returns {object} Decoded payload
 */
export function verifyWebSocketToken(token) {
  try {
    console.log('🔐 JWT: Verifying WebSocket token...');
    
    const payload = jwt.verify(token, JWT_SECRET, { 
      algorithms: ['HS256'],
      clockTolerance: 30 // 30 seconds tolerance
    });
    
    // Validate token type
    if (payload.type !== 'websocket_auth') {
      throw new Error('Invalid token type');
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }
    
    console.log('✅ JWT: Token verified successfully for session:', payload.sessionId);
    return payload;
    
  } catch (error) {
    console.error('❌ JWT: Token verification failed:', error);
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}

/**
 * Extract session ID from JWT token without verification
 * Used for logging purposes only
 * @param {string} token - JWT token
 * @returns {string|null} Session ID or null
 */
export function extractSessionIdFromToken(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.sessionId || null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 */
export function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch (error) {
    return true;
  }
}

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null
 */
export function getTokenExpiration(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return null;
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
}

/**
 * Generate refresh token for session renewal
 * @param {string} sessionId - Session ID
 * @returns {string} Refresh token
 */
export function generateRefreshToken(sessionId) {
  try {
    const payload = {
      sessionId,
      type: 'refresh_token',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };
    
    return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
  } catch (error) {
    console.error('❌ JWT: Refresh token generation failed:', error);
    throw new Error(`Refresh token generation failed: ${error.message}`);
  }
}

/**
 * Validate session access
 * @param {string} sessionId - Session ID
 * @param {string} token - JWT token
 * @returns {boolean} True if valid
 */
export function validateSessionAccess(sessionId, token) {
  try {
    const payload = verifyWebSocketToken(token);
    return payload.sessionId === sessionId;
  } catch (error) {
    return false;
  }
}

// Export all functions
export default {
  generateWebSocketToken,
  verifyWebSocketToken,
  extractSessionIdFromToken,
  isTokenExpired,
  getTokenExpiration,
  generateRefreshToken,
  validateSessionAccess
};