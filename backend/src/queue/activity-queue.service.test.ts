import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ActivityQueueService } from './activity-queue.service.js';
import { getDb } from '../database/client.js';
import { activities } from '../database/schema/activities.js';
import { eq, sql } from 'drizzle-orm';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { randomUUID } from 'node:crypto';

describe('ActivityQueueService', () => {
  let activityQueueService: ActivityQueueService;
  let testQueue: Queue;
  let redis: IORedis;

  beforeAll(async () => {
    redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379/0');
    testQueue = new Queue('activity', { connection: redis as any });
    activityQueueService = new ActivityQueueService(testQueue);

    const db = getDb();
    await db.delete(activities).where(sql`1=1`);
  });

  afterAll(async () => {
    await testQueue.close();
    await redis.quit();
    const db = getDb();
    await db.delete(activities).where(sql`1=1`);
  });

  it('should write an activity job to the queue', async () => {
    const projectId = randomUUID();
    const actorId = randomUUID();
    const itemId = randomUUID();

    await activityQueueService.write({
      projectId,
      actorId,
      itemId,
      action: 'item.created',
      fieldName: null,
      oldValue: null,
      newValue: { title: 'Test item' },
    });

    // Check job was added to queue
    const jobCounts = await testQueue.getJobCounts();
    expect(jobCounts.waiting + jobCounts.active).toBeGreaterThanOrEqual(1);
  });

  it('should handle missing optional fields', async () => {
    await activityQueueService.write({
      projectId: randomUUID(),
      actorId: randomUUID(),
      action: 'item.deleted',
    });

    const jobCounts = await testQueue.getJobCounts();
    expect(jobCounts.waiting + jobCounts.active).toBeGreaterThanOrEqual(1);
  });
});
