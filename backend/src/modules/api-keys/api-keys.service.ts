import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { apiKeys, DEFAULT_API_KEY_RATE_LIMIT } from '../../database/schema/api-keys.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { eq, and, isNull } from 'drizzle-orm';
import { CacheService } from '../../cache/cache.service.js';

export interface ValidatedApiKey {
  id: string;
  email: string;
  projectId: string | null;
  keyId: string;
  rateLimitPerMin: number;
}

const KEY_CACHE_TTL = 60; // seconds; revoke/update invalidate eagerly

@Injectable()
export class ApiKeysService {
  constructor(private readonly cache: CacheService) {}

  private cacheKey(hash: string): string {
    return `apikey:${hash}`;
  }

  private generateKey(): { raw: string; hash: string; prefix: string } {
    const random = randomBytes(24).toString('base64url');
    const raw = `clx_${random}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, 12);
    return { raw, hash, prefix };
  }

  async create(
    userId: string,
    data: { name: string; projectId?: string; expiresAt?: string; rateLimitPerMin?: number },
  ) {
    const db = getDb();
    const { raw, hash, prefix } = this.generateKey();
    const rateLimitPerMin =
      data.rateLimitPerMin === undefined ? DEFAULT_API_KEY_RATE_LIMIT : normalizeRateLimit(data.rateLimitPerMin);

    const [key] = await db
      .insert(apiKeys)
      .values({
        userId,
        projectId: data.projectId ?? null,
        name: data.name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        rateLimitPerMin,
      })
      .returning();

    return { ...key, key: raw };
  }

  async list(userId: string) {
    const db = getDb();
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        projectId: apiKeys.projectId,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        rateLimitPerMin: apiKeys.rateLimitPerMin,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(apiKeys.createdAt);
  }

  async update(userId: string, keyId: string, data: { name?: string; rateLimitPerMin?: number }) {
    const db = getDb();
    const [key] = await db
      .select({ id: apiKeys.id, keyHash: apiKeys.keyHash })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);
    if (!key) throw new NotFoundException('API key not found');
    const patch: { name?: string; rateLimitPerMin?: number } = {};
    if (data.name !== undefined) {
      if (!data.name.trim() || data.name.length > 100) throw new BadRequestException('Invalid name');
      patch.name = data.name.trim();
    }
    if (data.rateLimitPerMin !== undefined) patch.rateLimitPerMin = normalizeRateLimit(data.rateLimitPerMin);
    if (Object.keys(patch).length > 0) {
      await db.update(apiKeys).set(patch).where(eq(apiKeys.id, keyId));
    }
    await this.cache.del(this.cacheKey(key.keyHash));
    const [updated] = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        projectId: apiKeys.projectId,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        rateLimitPerMin: apiKeys.rateLimitPerMin,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);
    return updated;
  }

  async revoke(userId: string, keyId: string) {
    const db = getDb();
    const [key] = await db
      .select({ id: apiKeys.id, keyHash: apiKeys.keyHash })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);
    if (!key) throw new NotFoundException('API key not found');
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    // Revoked keys must stop working immediately despite the validation cache.
    await this.cache.del(this.cacheKey(key.keyHash));
    return { success: true };
  }

  async validateKey(rawKey: string): Promise<ValidatedApiKey | null> {
    if (!rawKey.startsWith('clx_')) return null;
    const hash = createHash('sha256').update(rawKey).digest('hex');

    const cached = await this.cache.get<ValidatedApiKey & { expiresAt: string | null }>(this.cacheKey(hash));
    if (cached) {
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) return null;
      this.touchLastUsed(cached.keyId);
      const { expiresAt: _expiresAt, ...rest } = cached;
      return rest;
    }

    const db = getDb();
    const [result] = await db
      .select({
        id: users.id,
        email: users.email,
        projectId: apiKeys.projectId,
        expiresAt: apiKeys.expiresAt,
        keyId: apiKeys.id,
        rateLimitPerMin: apiKeys.rateLimitPerMin,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    if (!result) return null;
    if (result.expiresAt && result.expiresAt < new Date()) return null;

    const validated: ValidatedApiKey = {
      id: result.id,
      email: result.email,
      projectId: result.projectId,
      keyId: result.keyId,
      rateLimitPerMin: result.rateLimitPerMin ?? DEFAULT_API_KEY_RATE_LIMIT,
    };
    await this.cache.set(
      this.cacheKey(hash),
      { ...validated, expiresAt: result.expiresAt?.toISOString() ?? null },
      KEY_CACHE_TTL,
    );
    this.touchLastUsed(result.keyId);
    return validated;
  }

  private touchLastUsed(keyId: string): void {
    // Fire and forget — last-used tracking must never slow requests.
    // Throttled to one write per key per minute: the guard + auth guard
    // validate every keyed request, so unthrottled touches would double
    // the write load for no benefit.
    void (async () => {
      try {
        const marker = `apikey:touched:${keyId}`;
        if (await this.cache.get(marker)) return;
        await this.cache.set(marker, '1', 60);
        await getDb().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyId));
      } catch {
        // ignore cache/db errors on bookkeeping path
      }
    })();
  }
}

function normalizeRateLimit(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) {
    throw new BadRequestException('rateLimitPerMin must be an integer between 1 and 10000');
  }
  return n;
}
