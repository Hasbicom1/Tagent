import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Railway PostgreSQL connection with proper SSL configuration
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Production optimizations for Railway
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL configuration for Railway - use strict verification by default
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
});

export const db = drizzle(pool, { schema });
