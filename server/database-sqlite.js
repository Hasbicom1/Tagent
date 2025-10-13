/**
 * Database Module - SQLite Implementation for Local Development
 * Handles database operations for sessions and payments using SQLite
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SQLite database instance
let db = null;

export async function initializeDatabase() {
  try {
    console.log('🔧 SQLite Database: Initializing local development database...');
    
    // Create SQLite database
    const dbPath = join(__dirname, '..', 'dev.db');
    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Test connection
    db.prepare('SELECT 1').get();
    
    console.log('✅ SQLite Database: Connected successfully');
    return { connected: true, db };
  } catch (error) {
    console.error('❌ SQLite Database: Connection failed:', error);
    return { connected: false, error: error.message };
  }
}

export async function createTables() {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    console.log('🔧 SQLite Database: Creating tables...');
    
    // Create user_sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        checkout_session_id TEXT,
        payment_intent_id TEXT,
        expires_at TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        payment_verified INTEGER DEFAULT 0,
        amount_paid REAL,
        customer_email TEXT,
        stripe_customer_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create automation_tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS automation_tasks (
        task_id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES user_sessions(session_id),
        instruction TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

    // Create agent_activity table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES user_sessions(session_id),
        agent_type TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ SQLite Database: Tables created successfully');
    return true;
  } catch (error) {
    console.error('❌ SQLite Database: Table creation failed:', error);
    return false;
  }
}

export async function getUserSession(sessionId) {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare('SELECT * FROM user_sessions WHERE session_id = ? OR agent_id = ?');
    const session = stmt.get(sessionId, sessionId);
    
    if (session) {
      console.log(`✅ SQLite Database: Retrieved session ${sessionId}`);
      return {
        ...session,
        payment_verified: Boolean(session.payment_verified),
        expires_at: new Date(session.expires_at),
        created_at: new Date(session.created_at),
        updated_at: new Date(session.updated_at)
      };
    }
    
    console.log(`⚠️ SQLite Database: Session ${sessionId} not found`);
    return null;
  } catch (error) {
    console.error('❌ SQLite Database: getUserSession failed:', error);
    return null;
  }
}

export async function createUserSession(sessionData) {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_sessions (
        session_id, agent_id, checkout_session_id, payment_intent_id, 
        expires_at, status, payment_verified, amount_paid, 
        customer_email, stripe_customer_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      sessionData.session_id || sessionData.sessionId,
      sessionData.agent_id || sessionData.agentId,
      sessionData.checkout_session_id || sessionData.checkoutSessionId,
      sessionData.payment_intent_id || sessionData.paymentIntentId,
      (sessionData.expires_at || sessionData.expiresAt)?.toISOString() || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      sessionData.status || 'active',
      sessionData.payment_verified ? 1 : 0,
      sessionData.amount_paid || sessionData.amountPaid || 1.00,
      sessionData.customer_email || sessionData.customerEmail || 'user@example.com',
      sessionData.stripe_customer_id || sessionData.stripeCustomerId || null
    );

    console.log(`✅ SQLite Database: Created/updated session ${sessionData.session_id || sessionData.sessionId}`);
    
    // Return the created session
    return await getUserSession(sessionData.session_id || sessionData.sessionId);
  } catch (error) {
    console.error('❌ SQLite Database: createUserSession failed:', error);
    return null;
  }
}

export async function updateSessionStatus(sessionId, status) {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare('UPDATE user_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?');
    const result = stmt.run(status, sessionId);

    if (result.changes > 0) {
      console.log(`✅ SQLite Database: Updated session ${sessionId} status to ${status}`);
      return true;
    } else {
      console.log(`⚠️ SQLite Database: Session ${sessionId} not found for status update`);
      return false;
    }
  } catch (error) {
    console.error('❌ SQLite Database: updateSessionStatus failed:', error);
    return false;
  }
}

export async function createAutomationTask(taskData) {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare(`
      INSERT INTO automation_tasks (task_id, session_id, instruction, status, result)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      taskData.task_id || taskData.taskId,
      taskData.session_id || taskData.sessionId,
      taskData.instruction,
      taskData.status || 'pending',
      taskData.result ? JSON.stringify(taskData.result) : null
    );

    console.log(`✅ SQLite Database: Created automation task ${taskData.task_id || taskData.taskId}`);
    return { task_id: taskData.task_id || taskData.taskId };
  } catch (error) {
    console.error('❌ SQLite Database: createAutomationTask failed:', error);
    return null;
  }
}

export async function logAgentActivity(activityData) {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const stmt = db.prepare(`
      INSERT INTO agent_activity (session_id, agent_type, action_type, details)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      activityData.session_id || activityData.sessionId,
      activityData.agent_type || activityData.agentType,
      activityData.action_type || activityData.actionType,
      activityData.details ? JSON.stringify(activityData.details) : null
    );

    console.log(`✅ SQLite Database: Logged agent activity for session ${activityData.session_id || activityData.sessionId}`);
    return { activity_id: result.lastInsertRowid };
  } catch (error) {
    console.error('❌ SQLite Database: logAgentActivity failed:', error);
    return null;
  }
}

export function getDatabase() {
  if (!db) {
    console.warn('⚠️ SQLite Database: Database not initialized');
    return null;
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✅ SQLite Database: Connection closed');
  }
}