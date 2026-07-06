import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

let _client: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_client) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    _client = drizzle(pool, { schema, logger: process.env.NODE_ENV === 'development' });
  }
  return _client;
}

export type DbClient = ReturnType<typeof getDb>;
