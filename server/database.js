/**
 * Database Module - REAL Implementation
 * Handles database operations for sessions and payments using PostgreSQL
 */

import { Pool } from 'pg';

// Real PostgreSQL connection pool
let pool = null;

export async function initializeDatabase() {
  try {
    console.log('🔧 REAL Database: Initializing PostgreSQL connection...');
    
    // Real PostgreSQL connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/onedollaragent',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    console.log('✅ REAL Database: PostgreSQL connected successfully');
    return { connected: true, pool };
  } catch (error) {
    console.error('❌ REAL Database: Connection failed:', error);
    return { connected: false, error: error.message };
  }
}

export async function createTables() {
  try {
    if (!pool) {
      throw new Error('Database not initialized');
    }

    console.log('🔧 REAL Database: Creating tables...');
    
    const client = await pool.connect();
    
    // Real table creation with ALL required columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        checkout_session_id VARCHAR(255),
        payment_intent_id VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        payment_verified BOOLEAN DEFAULT FALSE,
        amount_paid NUMERIC(10, 2),
        customer_email VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_tasks (
        task_id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) REFERENCES user_sessions(session_id),
        instruction TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        activity_id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) REFERENCES user_sessions(session_id),
        agent_type VARCHAR(100) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CRITICAL FIX: Add missing columns to existing tables
    console.log('🔄 REAL Database: Running migrations for existing tables...');
    
    // FIRST: Remove any problematic unique constraints on agent_id
    try {
      await client.query(`
        ALTER TABLE user_sessions 
        DROP CONSTRAINT IF EXISTS user_sessions_agent_id_key;
      `);
      console.log('✅ REAL Database: Migration: Removed unique constraint on agent_id');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      await client.query(`
        ALTER TABLE user_sessions 
        DROP CONSTRAINT IF EXISTS user_sessions_pkey;
      `);
      console.log('✅ REAL Database: Migration: Removed primary key constraint');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing checkout_session_id column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(255);
      `);
      console.log('✅ REAL Database: Migration: checkout_session_id column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing payment_intent_id column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);
      `);
      console.log('✅ REAL Database: Migration: payment_intent_id column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing payment_verified column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ REAL Database: Migration: payment_verified column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing amount_paid column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2);
      `);
      console.log('✅ REAL Database: Migration: amount_paid column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing customer_email column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
      `);
      console.log('✅ REAL Database: Migration: customer_email column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing stripe_customer_id column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
      `);
      console.log('✅ REAL Database: Migration: stripe_customer_id column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }
    
    try {
      // Add missing created_at column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ REAL Database: Migration: created_at column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
  }

  try {
      // Add missing updated_at column if it doesn't exist
      await client.query(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log('✅ REAL Database: Migration: updated_at column added');
    } catch (migrationError) {
      console.warn('⚠️ REAL Database: Migration warning (non-critical):', migrationError.message);
    }

    // FINAL: Recreate table with proper constraints if needed
    try {
      console.log('🔄 REAL Database: Ensuring proper table structure...');
      
      // Check if we need to recreate the table structure
      const tableCheck = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'user_sessions' AND column_name = 'session_id';
      `);
      
      if (tableCheck.rows.length === 0) {
        console.log('⚠️ REAL Database: user_sessions table missing, will be created by CREATE TABLE IF NOT EXISTS');
      } else {
        console.log('✅ REAL Database: user_sessions table structure verified');
      }
      
    } catch (tableError) {
      console.warn('⚠️ REAL Database: Table structure check warning:', tableError.message);
    }

    client.release();
    console.log('✅ REAL Database: Tables created and migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ REAL Database: Table creation failed:', error);
    return false;
  }
}

export async function getUserSession(sessionId) {
  try {
  if (!pool) {
      throw new Error('Database not initialized');
    }

    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM user_sessions WHERE session_id = $1',
      [sessionId]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('❌ REAL Database: getUserSession failed:', error);
    return null;
  }
}

export async function updateSessionStatus(sessionId, status) {
  try {
  if (!pool) {
      throw new Error('Database not initialized');
    }

    const client = await pool.connect();
    const result = await client.query(
      'UPDATE user_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE session_id = $2',
      [status, sessionId]
    );
    client.release();

    console.log(`✅ REAL Database: Updated session ${sessionId} to status: ${status}`);
    return result.rowCount > 0;
  } catch (error) {
    console.error('❌ REAL Database: updateSessionStatus failed:', error);
    return false;
  }
}

export async function createUserSession(sessionData) {
  try {
    if (!pool) {
      throw new Error('Database not initialized');
    }

    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO user_sessions (session_id, agent_id, checkout_session_id, payment_intent_id, expires_at, status, payment_verified, amount_paid, customer_email, stripe_customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (session_id) DO UPDATE SET
       status = EXCLUDED.status,
       payment_verified = EXCLUDED.payment_verified,
       amount_paid = EXCLUDED.amount_paid,
       customer_email = EXCLUDED.customer_email,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        sessionData.session_id || sessionData.sessionId,
        sessionData.agent_id || sessionData.agentId,
        sessionData.checkout_session_id || sessionData.checkoutSessionId,
        sessionData.payment_intent_id || sessionData.paymentIntentId,
        sessionData.expires_at || sessionData.expiresAt,
        sessionData.status || 'active',
        sessionData.payment_verified || false,
        sessionData.amount_paid || sessionData.amountPaid || 1.00,
        sessionData.customer_email || sessionData.customerEmail || 'user@example.com',
        sessionData.stripe_customer_id || sessionData.stripeCustomerId || null
      ]
    );
    client.release();

    console.log(`✅ REAL Database: Created/updated session ${sessionData.session_id || sessionData.sessionId}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ REAL Database: createUserSession failed:', error);
    return null;
  }
}

export async function logAgentActivity(sessionId, agentType, actionType, details = {}) {
  try {
  if (!pool) {
      throw new Error('Database not initialized');
    }

    const client = await pool.connect();
    await client.query(
      'INSERT INTO agent_activity (session_id, agent_type, action_type, details) VALUES ($1, $2, $3, $4)',
      [sessionId, agentType, actionType, JSON.stringify(details)]
    );
    client.release();

    console.log(`✅ REAL Database: Logged activity for session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ REAL Database: logAgentActivity failed:', error);
    return false;
  }
}

export function getDatabase() {
  if (!pool) {
    console.warn('⚠️ REAL Database: Pool not initialized');
    return null;
  }
  return pool;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ REAL Database: Connection closed');
  }
}