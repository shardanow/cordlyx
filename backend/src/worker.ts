import 'reflect-metadata';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { activities } from './database/schema/activities.js';
import { runHourlyDigest } from './modules/notifications/digest-runner.js';
import { config } from 'dotenv';

config({ path: '../.env' });

const { Pool } = pg;

async function main() {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379/0', {
    maxRetriesPerRequest: null,
  });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const worker = new Worker(
    'activity',
    async (job) => {
      const started = Date.now();
      if (job.name === 'digest-hourly') {
        const result = await runHourlyDigest({}, new Date().getUTCHours());
        console.log(`[DigestWorker] Hour done job=${job.id} in ${Date.now() - started}ms: ${JSON.stringify(result)}`);
        return;
      }
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

      console.log(`[ActivityWorker] Completed: ${action} job=${job.id} in ${Date.now() - started}ms`);
    },
    { connection: connection as any },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[ActivityWorker] Failed: ${job?.data?.action ?? 'unknown'} job=${job?.id} attemptsMade=${job?.attemptsMade} err=${err.message}`,
    );
  });

  worker.on('error', (err) => {
    console.error('[ActivityWorker] Error:', err);
  });

  console.log('🚀 Activity worker started');
}

main().catch(console.error);
