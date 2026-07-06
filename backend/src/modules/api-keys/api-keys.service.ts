import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { apiKeys } from '../../database/schema/api-keys.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class ApiKeysService {
  private generateKey(): { raw: string; hash: string; prefix: string } {
    const random = randomBytes(24).toString('base64url');
    const raw = `clx_${random}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, 12);
    return { raw, hash, prefix };
  }

  async create(userId: string, data: { name: string; projectId?: string; expiresAt?: string }) {
    const db = getDb();
    const { raw, hash, prefix } = this.generateKey();

    const [key] = await db
      .insert(apiKeys)
      .values({
        userId,
        projectId: data.projectId ?? null,
        name: data.name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
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
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(apiKeys.createdAt);
  }

  async revoke(userId: string, keyId: string) {
    const db = getDb();
    const [key] = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);
    if (!key) throw new NotFoundException('API key not found');
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    return { success: true };
  }

  async validateKey(rawKey: string): Promise<{ id: string; email: string; projectId: string | null } | null> {
    if (!rawKey.startsWith('clx_')) return null;
    const db = getDb();
    const hash = createHash('sha256').update(rawKey).digest('hex');

    const [result] = await db
      .select({
        id: users.id,
        email: users.email,
        projectId: apiKeys.projectId,
        expiresAt: apiKeys.expiresAt,
        keyId: apiKeys.id,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    if (!result) return null;
    if (result.expiresAt && result.expiresAt < new Date()) return null;

    // Update last used timestamp (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, result.keyId))
      .catch(() => {});

    return { id: result.id, email: result.email, projectId: result.projectId };
  }
}
