import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { CacheService } from '../../cache/cache.service.js';
import { ApiKeysService } from './api-keys.service.js';

describe('ApiKeysService rate limits (DB)', () => {
  let service: ApiKeysService;
  let userId: string;

  beforeAll(async () => {
    service = new ApiKeysService(new CacheService());
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'apikey-limits@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Key Limits',
    });
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('creates keys with the default budget and updates it', async () => {
    const created: any = await service.create(userId, { name: 'k1' });
    expect(created.rateLimitPerMin).toBe(120);

    const updated: any = await service.update(userId, created.id, { rateLimitPerMin: 10 });
    expect(updated.rateLimitPerMin).toBe(10);

    const listed: any[] = await service.list(userId);
    expect(listed.find((k) => k.id === created.id)?.rateLimitPerMin).toBe(10);

    const validated = await service.validateKey(created.key);
    expect(validated).toMatchObject({ keyId: created.id, rateLimitPerMin: 10 });
  });

  it('rejects out-of-range budgets', async () => {
    await expect(service.create(userId, { name: 'bad', rateLimitPerMin: 0 })).rejects.toThrow(/between 1 and 10000/);
    await expect(service.create(userId, { name: 'bad', rateLimitPerMin: 10001 })).rejects.toThrow(/between 1 and 10000/);
  });

  it('revoked keys stop working despite the validation cache', async () => {
    const created: any = await service.create(userId, { name: 'k2' });
    expect(await service.validateKey(created.key)).not.toBeNull();
    await service.revoke(userId, created.id);
    expect(await service.validateKey(created.key)).toBeNull();
  });
});
