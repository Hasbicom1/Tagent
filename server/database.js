/**
 * DATABASE INTEGRATION - Production Ready
 * 
 * Real database integration for user sessions, payments, and agent management.
 * Uses PostgreSQL with proper connection pooling and error handling.
 */

import { Pool } from 'pg';

// Database connection pool
let pool = null;

export function initializeDatabase() {
  try {
    console.log('🔧 DATABASE: Initializing PostgreSQL connection...');
    
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL required for production');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    pool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.error('❌ DATABASE: Connection failed:', err.message);
      } else {
        console.log('✅ DATABASE: Connected successfully');
        console.log('🕐 DATABASE: Server time:', result.rows[0].now);
      }
    });

    return pool;
  } catch (error) {
    console.error('❌ DATABASE: Initialization failed:', error);
    return null;
  }
}

export function getDatabase() {
  return pool;
}

// User session management
export async function createUserSession(sessionData) {
  if (!pool) {
    console.error('❌ DATABASE: No database connection - session creation failed');
    throw new Error('Database connection required for session creation');
  }

  try {
    const query = `
      INSERT INTO user_sessions (
        session_id, agent_id, expires_at, status, 
        payment_verified, amount_paid, customer_email, 
        stripe_customer_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, created_at
    `;
    
    const values = [
      sessionData.sessionId,
      sessionData.agentId,
      sessionData.expiresAt,
      sessionData.status,
      sessionData.paymentVerified,
      sessionData.amountPaid || 0,
      sessionData.customerEmail || null,
      sessionData.stripeCustomerId || null
    ];

    const result = await pool.query(query, values);
    console.log('✅ DATABASE: User session created:', result.rows[0].id);
    
    return {
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
      ...sessionData
    };
  } catch (error) {
    console.error('❌ DATABASE: Failed to create user session:', error);
    throw error;
  }
}

export async function getUserSession(agentId) {
  if (!pool) {
    console.error('❌ DATABASE: No database connection - session lookup failed');
    throw new Error('Database connection required for session lookup');
  }

  try {
    const query = `
      SELECT * FROM user_sessions 
      WHERE agent_id = $1 AND status = 'active' AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;
    
    const result = await pool.query(query, [agentId]);
    
    if (result.rows.length === 0) {
      console.log('⚠️ DATABASE: No active session found for agent:', agentId);
      return null;
    }

    console.log('✅ DATABASE: User session found:', result.rows[0].id);
    return result.rows[0];
  } catch (error) {
    console.error('❌ DATABASE: Failed to get user session:', error);
    throw error;
  }
}

export async function updateSessionStatus(agentId, status) {
  if (!pool) {
    console.error('❌ DATABASE: No database connection - status update failed');
    throw new Error('Database connection required for status update');
  }

  try {
    const query = `
      UPDATE user_sessions 
      SET status = $1, updated_at = NOW()
      WHERE agent_id = $2
    `;
    
    await pool.query(query, [status, agentId]);
    console.log('✅ DATABASE: Session status updated to:', status);
    return true;
  } catch (error) {
    console.error('❌ DATABASE: Failed to update session status:', error);
    throw error;
  }
}

// Database schema creation
export async function createTables() {
  if (!pool) {
    console.log('⚠️ DATABASE: No database connection, skipping table creation');
    return;
  }

  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        agent_id VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        payment_verified BOOLEAN DEFAULT false,
        amount_paid DECIMAL(10,2) DEFAULT 0,
        customer_email VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_sessions_agent_id ON user_sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
    `;

    await pool.query(createTableQuery);
    console.log('✅ DATABASE: Tables created/verified successfully');
  } catch (error) {
    console.error('❌ DATABASE: Failed to create tables:', error);
    throw error;
  }
}
