import 'reflect-metadata';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { activities } from './database/schema/activities.js';
import { config } from 'dotenv';

config({ path: '../.env' });

const { Pool } = pg;

async function main() {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379/0');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const worker = new Worker(
    'activity',
    async (job) => {
      const { projectId, actorId, itemId, action, fieldName, oldValue, newValue, metadata } = job.data;

      await db.insert(activities).values({
        projectId,
        actorId,
        itemId: itemId ?? null,
        action,
        fieldName: fieldName ?? null,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        metadata: metadata ?? null,
      });

      console.log(`[ActivityWorker] Written: ${action} by ${actorId}`);
    },
    { connection: connection as any },
  );

  worker.on('error', (err) => {
    console.error('[ActivityWorker] Error:', err);
  });

  console.log('🚀 Activity worker started');
}

main().catch(console.error);
