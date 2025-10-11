/**
 * JWT Utilities for WebSocket Authentication
 * 
 * Generates and validates JWT tokens for secure WebSocket connections
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'onedollaragent-secret-key-2024';
const JWT_EXPIRES_IN = '24h';

/**
 * Generate JWT token for WebSocket authentication
 */
export function generateWebSocketToken(sessionId, agentId) {
  try {
    const payload = {
      sessionId,
      agentId,
      type: 'websocket_auth',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    console.log(`🔐 JWT: Generated WebSocket token for session: ${sessionId}`);
    return token;
  } catch (error) {
    console.error('❌ JWT: Failed to generate token:', error.message);
    throw error;
  }
}

/**
 * Verify JWT token for WebSocket authentication
 */
export function verifyWebSocketToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'websocket_auth') {
      throw new Error('Invalid token type');
    }
    
    console.log(`✅ JWT: Token verified for session: ${decoded.sessionId}`);
    return decoded;
  } catch (error) {
    console.error('❌ JWT: Token verification failed:', error.message);
    throw error;
  }
}

/**
 * Extract JWT token from WebSocket connection
 */
export function extractTokenFromWebSocket(request) {
  try {
    // Try to get token from query parameters
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');
    
    if (token) {
      console.log('🔐 JWT: Token found in query parameters');
      return token;
    }
    
    // Try to get token from headers
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('🔐 JWT: Token found in Authorization header');
      return token;
    }
    
    console.warn('⚠️ JWT: No token found in WebSocket connection');
    return null;
  } catch (error) {
    console.error('❌ JWT: Failed to extract token:', error.message);
    return null;
  }
}

/**
 * Authenticate WebSocket connection
 */
export function authenticateWebSocketConnection(request) {
  try {
    const token = extractTokenFromWebSocket(request);
    
    if (!token) {
      console.warn('⚠️ JWT: No token provided for WebSocket authentication');
      return null;
    }
    
    const decoded = verifyWebSocketToken(token);
    console.log(`✅ JWT: WebSocket authenticated for session: ${decoded.sessionId}`);
    return decoded;
  } catch (error) {
    console.error('❌ JWT: WebSocket authentication failed:', error.message);
    return null;
  }
}
