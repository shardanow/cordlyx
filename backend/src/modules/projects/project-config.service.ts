import { Injectable } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { CacheService } from '../../cache/cache.service.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ProjectConfigService {
  constructor(private readonly cache: CacheService) {}

  private configKey(projectId: string, kind: string) {
    return `config:${kind}:${projectId}`;
  }

  private async invalidateConfig(projectId: string) {
    await Promise.all([
      this.cache.del(this.configKey(projectId, 'types')),
      this.cache.del(this.configKey(projectId, 'statuses')),
      this.cache.del(this.configKey(projectId, 'priorities')),
    ]);
  }

  // --- Types ---

  async getTypes(projectId: string) {
    const key = this.configKey(projectId, 'types');
    const cached = await this.cache.get<any[]>(key);
    if (cached) return cached;
    const db = getDb();
    const result = await db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)).orderBy(itemTypes.sortOrder);
    await this.cache.set(key, result, 3600);
    return result;
  }

  async createType(projectId: string, data: { name: string; color: string; icon?: string | null }) {
    const db = getDb();
    const id = randomUUID();
    await db.insert(itemTypes).values({ id, projectId, ...data, icon: data.icon ?? null });
    await this.cache.del(this.configKey(projectId, 'types'));
    return db.select().from(itemTypes).where(eq(itemTypes.id, id)).limit(1).then((r) => r[0]);
  }

  async updateType(typeId: string, data: { name?: string; color?: string; icon?: string | null; sortOrder?: number }) {
    const db = getDb();
    await db.update(itemTypes).set({ ...data, updatedAt: new Date() }).where(eq(itemTypes.id, typeId));
    const result = await db.select().from(itemTypes).where(eq(itemTypes.id, typeId)).limit(1);
    if (result[0]) await this.cache.del(this.configKey(result[0].projectId, 'types'));
    return result[0];
  }

  async deleteType(typeId: string) {
    const db = getDb();
    const [row] = await db.select({ projectId: itemTypes.projectId }).from(itemTypes).where(eq(itemTypes.id, typeId)).limit(1);
    await db.delete(itemTypes).where(eq(itemTypes.id, typeId));
    if (row) await this.cache.del(this.configKey(row.projectId, 'types'));
  }

  // --- Statuses ---

  async getStatuses(projectId: string) {
    const key = this.configKey(projectId, 'statuses');
    const cached = await this.cache.get<any[]>(key);
    if (cached) return cached;
    const db = getDb();
    const result = await db.select().from(itemStatuses).where(eq(itemStatuses.projectId, projectId)).orderBy(itemStatuses.sortOrder);
    await this.cache.set(key, result, 3600);
    return result;
  }

  async createStatus(projectId: string, data: { name: string; color: string; category: string }) {
    const db = getDb();
    const id = randomUUID();
    await db.insert(itemStatuses).values({ id, projectId, ...data });
    await this.cache.del(this.configKey(projectId, 'statuses'));
    return db.select().from(itemStatuses).where(eq(itemStatuses.id, id)).limit(1).then((r) => r[0]);
  }

  async updateStatus(statusId: string, data: { name?: string; color?: string; category?: string; sortOrder?: number }) {
    const db = getDb();
    await db.update(itemStatuses).set({ ...data, updatedAt: new Date() }).where(eq(itemStatuses.id, statusId));
    const result = await db.select().from(itemStatuses).where(eq(itemStatuses.id, statusId)).limit(1);
    if (result[0]) await this.cache.del(this.configKey(result[0].projectId, 'statuses'));
    return result[0];
  }

  async deleteStatus(statusId: string) {
    const db = getDb();
    const [row] = await db.select({ projectId: itemStatuses.projectId }).from(itemStatuses).where(eq(itemStatuses.id, statusId)).limit(1);
    await db.delete(itemStatuses).where(eq(itemStatuses.id, statusId));
    if (row) await this.cache.del(this.configKey(row.projectId, 'statuses'));
  }

  // --- Priorities ---

  async getPriorities(projectId: string) {
    const key = this.configKey(projectId, 'priorities');
    const cached = await this.cache.get<any[]>(key);
    if (cached) return cached;
    const db = getDb();
    const result = await db.select().from(itemPriorities).where(eq(itemPriorities.projectId, projectId)).orderBy(itemPriorities.sortOrder);
    await this.cache.set(key, result, 3600);
    return result;
  }

  async createPriority(projectId: string, data: { name: string; color?: string | null; icon?: string | null }) {
    const db = getDb();
    const id = randomUUID();
    await db.insert(itemPriorities).values({ id, projectId, ...data, color: data.color ?? null, icon: data.icon ?? null });
    await this.cache.del(this.configKey(projectId, 'priorities'));
    return db.select().from(itemPriorities).where(eq(itemPriorities.id, id)).limit(1).then((r) => r[0]);
  }

  async updatePriority(priorityId: string, data: { name?: string; color?: string | null; icon?: string | null; sortOrder?: number }) {
    const db = getDb();
    await db.update(itemPriorities).set({ ...data, updatedAt: new Date() }).where(eq(itemPriorities.id, priorityId));
    const result = await db.select().from(itemPriorities).where(eq(itemPriorities.id, priorityId)).limit(1);
    if (result[0]) await this.cache.del(this.configKey(result[0].projectId, 'priorities'));
    return result[0];
  }

  async deletePriority(priorityId: string) {
    const db = getDb();
    const [row] = await db.select({ projectId: itemPriorities.projectId }).from(itemPriorities).where(eq(itemPriorities.id, priorityId)).limit(1);
    await db.delete(itemPriorities).where(eq(itemPriorities.id, priorityId));
    if (row) await this.cache.del(this.configKey(row.projectId, 'priorities'));
  }
}
