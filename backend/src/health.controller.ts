import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import { getDb } from './database/client.js';
import { sql } from 'drizzle-orm';

interface CheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
  [key: string]: unknown;
}

/** Warn threshold for failed activity jobs (informational, see queue metrics). */
const FAILED_JOBS_WARN_THRESHOLD = 100;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(@InjectQueue('activity') private readonly activityQueue: Queue) {}

  @Get()
  @SkipThrottle()
  async check(@Res() res: Response): Promise<void> {
    const db = getDb();
    const started = Date.now();

    const pgStarted = Date.now();
    let postgres: CheckResult;
    try {
      await withTimeout(db.execute(sql`SELECT 1`), 3000, 'postgres');
      postgres = { status: 'up', latencyMs: Date.now() - pgStarted };
    } catch (err) {
      postgres = { status: 'down', latencyMs: Date.now() - pgStarted, error: messageOf(err) };
    }

    const redisStarted = Date.now();
    let redis: CheckResult;
    try {
      const client = (await withTimeout(
        Promise.resolve(this.activityQueue.client),
        3000,
        'redis',
      )) as unknown as { ping: () => Promise<string> };
      const pong = await withTimeout(client.ping(), 3000, 'redis');
      redis = { status: pong === 'PONG' ? 'up' : 'down', latencyMs: Date.now() - redisStarted };
    } catch (err) {
      redis = { status: 'down', latencyMs: Date.now() - redisStarted, error: messageOf(err) };
    }

    let queue: CheckResult & { waiting?: number; active?: number; failed?: number; delayed?: number };
    try {
      const counts = await withTimeout(
        this.activityQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'paused'),
        3000,
        'queue',
      );
      const failed = counts.failed ?? 0;
      queue = {
        status: redis.status === 'up' ? 'up' : 'down',
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        failed,
        delayed: counts.delayed ?? 0,
        failedAboveThreshold: failed > FAILED_JOBS_WARN_THRESHOLD,
      };
    } catch (err) {
      queue = { status: 'down', error: messageOf(err) };
    }

    const degraded = postgres.status !== 'up' || redis.status !== 'up' || queue.status !== 'up';
    const body = {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      checks: { postgres, redis, queue },
    };
    // Library-specific response: Nest must not serialize anything after this.
    res.status(degraded ? 503 : 200).json(body);
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
