import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

function mockQueue(overrides: Record<string, unknown> = {}) {
  return {
    client: { ping: async () => 'PONG' },
    getJobCounts: async () => ({ waiting: 0, active: 0, failed: 0, delayed: 0, paused: 0 }),
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('HealthController', () => {
  it('returns ok with check details when dependencies are up', async () => {
    const controller = new HealthController(mockQueue());
    const res = mockRes();
    await controller.check(res);
    const body: any = res.body;
    expect(res.statusCode).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.postgres.status).toBe('up');
    expect(body.checks.redis.status).toBe('up');
    expect(body.checks.queue).toMatchObject({ status: 'up', failed: 0 });
    expect(typeof body.latencyMs).toBe('number');
  });

  it('returns 503 degraded when redis is down', async () => {
    const controller = new HealthController(
      mockQueue({
        client: {
          ping: async () => {
            throw new Error('connect ECONNREFUSED');
          },
        },
        getJobCounts: async () => {
          throw new Error('connect ECONNREFUSED');
        },
      }),
    );
    const res = mockRes();
    await controller.check(res);
    const body: any = res.body;
    expect(res.statusCode).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.redis.status).toBe('down');
  });

  it('flags failed-job backlog above threshold', async () => {
    const controller = new HealthController(
      mockQueue({ getJobCounts: async () => ({ waiting: 0, active: 0, failed: 150, delayed: 0, paused: 0 }) }),
    );
    const res = mockRes();
    await controller.check(res);
    const body: any = res.body;
    expect(res.statusCode).toBe(200);
    expect(body.checks.queue.failedAboveThreshold).toBe(true);
  });
});
