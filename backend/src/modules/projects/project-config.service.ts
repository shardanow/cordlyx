import { Injectable, NotFoundException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { CacheService } from '../../cache/cache.service.js';
import { eq, and } from 'drizzle-orm';
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

  async updateType(projectId: string, typeId: string, data: { name?: string; color?: string; icon?: string | null; sortOrder?: number }) {
    const db = getDb();
    await this.assertTypeInProject(projectId, typeId);
    await db.update(itemTypes).set({ ...data, updatedAt: new Date() }).where(eq(itemTypes.id, typeId));
    const result = await db.select().from(itemTypes).where(eq(itemTypes.id, typeId)).limit(1);
    if (result[0]) await this.cache.del(this.configKey(result[0].projectId, 'types'));
    return result[0];
  }

  async deleteType(projectId: string, typeId: string) {
    const db = getDb();
    await this.assertTypeInProject(projectId, typeId);
    await db.delete(itemTypes).where(eq(itemTypes.id, typeId));
    await this.cache.del(this.configKey(projectId, 'types'));
  }

  private async assertTypeInProject(projectId: string, typeId: string): Promise<void> {
    const db = getDb();
    const [row] = await db
      .select({ id: itemTypes.id })
      .from(itemTypes)
      .where(and(eq(itemTypes.id, typeId), eq(itemTypes.projectId, projectId)))
      .limit(1);
    if (!row) throw new NotFoundException('Type not found in this project');
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

  async updateStatus(projectId: string, statusId: string, data: { name?: string; color?: string; category?: string; sortOrder?: number }) {
    const db = getDb();
    await this.assertStatusInProject(projectId, statusId);
    await db.update(itemStatuses).set({ ...data, updatedAt: new Date() }).where(eq(itemStatuses.id, statusId));
    const result = await db.select().from(itemStatuses).where(eq(itemStatuses.id, statusId)).limit(1);
    if (result[0]) await this.cache.del(this.configKey(result[0].projectId, 'statuses'));
    return result[0];
  }

  async deleteStatus(projectId: string, statusId: string) {
    const db = getDb();
    await this.assertStatusInProject(projectId, statusId);
    await db.delete(itemStatuses).where(eq(itemStatuses.id, statusId));
    await this.cache.del(this.configKey(projectId, 'statuses'));
  }

  private async assertStatusInProject(projectId: string, statusId: string): Promise<void> {
    const db = getDb();
    const [row] = await db
      .select({ id: itemStatuses.id })
      .from(itemStatuses)
      .where(and(eq(itemStatuses.id, statusId), eq(itemStatuses.projectId, projectId)))
      .limit(1);
    if (!row) throw new NotFoundException('Status not found in this project');
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

  async updatePriority(projectId: string, priorityId: string, data: { name?: string; color?: string | null; icon?: string | null; sortOrder?: number }) {
    const db = getDb();
    await this.assertPriorityInProject(projectId, priorityId);
    await db.update(itemPriorities).set({ ...data, updatedAt: new Date() }).where(eq(itemPriorities.id, priorityId));
    const result = await db.select().from(itemPriorities).where(eq(itemPriorities.id, priorityId)).limit(1);
    if (result[0]) await this.cache.del(this.configKey(result[0].projectId, 'priorities'));
    return result[0];
  }

  async deletePriority(projectId: string, priorityId: string) {
    const db = getDb();
    await this.assertPriorityInProject(projectId, priorityId);
    await db.delete(itemPriorities).where(eq(itemPriorities.id, priorityId));
    await this.cache.del(this.configKey(projectId, 'priorities'));
  }

  private async assertPriorityInProject(projectId: string, priorityId: string): Promise<void> {
    const db = getDb();
    const [row] = await db
      .select({ id: itemPriorities.id })
      .from(itemPriorities)
      .where(and(eq(itemPriorities.id, priorityId), eq(itemPriorities.projectId, projectId)))
      .limit(1);
    if (!row) throw new NotFoundException('Priority not found in this project');
  }
}
