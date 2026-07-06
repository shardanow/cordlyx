import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { webhooks } from '../../database/schema/webhooks.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class WebhooksService {
  async list(projectId: string) {
    const db = getDb();
    return db.select().from(webhooks).where(eq(webhooks.projectId, projectId)).orderBy(webhooks.createdAt);
  }

  async create(projectId: string, data: { url: string; events: string[] }) {
    const db = getDb();
    const id = randomUUID();
    await db.insert(webhooks).values({ id, projectId, url: data.url, events: data.events });
    return this.getById(id);
  }

  async getById(id: string) {
    const db = getDb();
    const result = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    return result[0] ?? null;
  }

  async update(id: string, projectId: string, data: { url?: string; events?: string[]; isActive?: boolean }) {
    const db = getDb();
    const existing = await db.select().from(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.projectId, projectId))).limit(1);
    if (!existing[0]) throw new NotFoundException('Webhook not found');

    await db.update(webhooks).set({ ...data, updatedAt: new Date() }).where(eq(webhooks.id, id));
    return this.getById(id);
  }

  async delete(id: string, projectId: string) {
    const db = getDb();
    const existing = await db.select().from(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.projectId, projectId))).limit(1);
    if (!existing[0]) throw new NotFoundException('Webhook not found');

    await db.delete(webhooks).where(eq(webhooks.id, id));
  }
}
