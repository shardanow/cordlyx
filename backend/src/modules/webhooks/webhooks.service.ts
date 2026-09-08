import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { webhooks, webhookDeliveries } from '../../database/schema/webhooks.js';
import { eq, and, desc, inArray, lt, sql } from 'drizzle-orm';

/** Events that can be delivered to webhooks (must match EventEmitter2 names). */
export const WEBHOOK_EVENTS = [
  'item.created',
  'item.updated',
  'item.deleted',
  'item.status_changed',
  'item.assigned',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'comment.reaction_added',
  'comment.reaction_removed',
  'attachment.created',
  'attachment.deleted',
  'relation.created',
  'relation.deleted',
  'plan.created',
  'plan.updated',
  'plan.deleted',
  'plan.status_changed',
  'roadmap.created',
  'roadmap.updated',
  'roadmap.deleted',
] as const;

/** Delivery log retention per webhook. */
export const WEBHOOK_LOG_RETENTION_DAYS = 30;

export interface WebhookTarget {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  secret: string | null;
}

@Injectable()
export class WebhooksService {
  async list(projectId: string) {
    const db = getDb();
    const rows = await db
      .select({
        id: webhooks.id,
        projectId: webhooks.projectId,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        createdAt: webhooks.createdAt,
        updatedAt: webhooks.updatedAt,
      })
      .from(webhooks)
      .where(eq(webhooks.projectId, projectId))
      .orderBy(webhooks.createdAt);

    const ids = rows.map((r) => r.id);
    const lastByWebhook = new Map<string, { at: Date; ok: boolean }>();
    if (ids.length > 0) {
      const recent = await db
        .select({
          webhookId: webhookDeliveries.webhookId,
          createdAt: webhookDeliveries.createdAt,
          success: webhookDeliveries.success,
        })
        .from(webhookDeliveries)
        .where(inArray(webhookDeliveries.webhookId, ids))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(ids.length * 5);
      for (const row of recent) {
        if (!lastByWebhook.has(row.webhookId)) {
          lastByWebhook.set(row.webhookId, { at: row.createdAt, ok: row.success });
        }
      }
    }
    return rows.map((r) => ({ ...r, lastDelivery: lastByWebhook.get(r.id) ?? null }));
  }

  async create(projectId: string, data: { url: string; events: string[] }) {
    const db = getDb();
    const id = randomUUID();
    const secret = randomBytes(32).toString('hex');
    await db.insert(webhooks).values({ id, projectId, url: data.url, events: data.events, secret });
    // Secret is returned only here (and on regenerate) — list/get never expose it.
    const created = await this.getById(id);
    return { ...created, secret };
  }

  async regenerateSecret(id: string, projectId: string) {
    const db = getDb();
    const existing = await db.select().from(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.projectId, projectId))).limit(1);
    if (!existing[0]) throw new NotFoundException('Webhook not found');
    const secret = randomBytes(32).toString('hex');
    await db.update(webhooks).set({ secret, updatedAt: new Date() }).where(eq(webhooks.id, id));
    return { id, secret };
  }

  async getById(id: string) {
    const db = getDb();
    const result = await db
      .select({
        id: webhooks.id,
        projectId: webhooks.projectId,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        createdAt: webhooks.createdAt,
        updatedAt: webhooks.updatedAt,
      })
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /** Active targets for dispatch (includes secrets for signing). */
  async findActiveForProject(projectId: string): Promise<WebhookTarget[]> {
    const db = getDb();
    return db
      .select({
        id: webhooks.id,
        projectId: webhooks.projectId,
        url: webhooks.url,
        events: webhooks.events,
        secret: webhooks.secret,
      })
      .from(webhooks)
      .where(and(eq(webhooks.projectId, projectId), eq(webhooks.isActive, true)));
  }

  async getDeliveries(webhookId: string, projectId: string, limit = 50) {
    const db = getDb();
    const existing = await db.select({ id: webhooks.id }).from(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.projectId, projectId))).limit(1);
    if (!existing[0]) throw new NotFoundException('Webhook not found');
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(safeLimit);
  }

  async recordDelivery(data: {
    webhookId: string;
    event: string;
    httpStatus?: number | null;
    success: boolean;
    errorMessage?: string | null;
    durationMs?: number | null;
    attempt: number;
  }) {
    const db = getDb();
    await db.insert(webhookDeliveries).values({
      webhookId: data.webhookId,
      event: data.event,
      httpStatus: data.httpStatus ?? null,
      success: data.success,
      errorMessage: data.errorMessage ?? null,
      durationMs: data.durationMs ?? null,
      attempt: data.attempt,
    });
    // Bound log growth per webhook.
    await db
      .delete(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.webhookId, data.webhookId),
          lt(webhookDeliveries.createdAt, sql`now() - ${WEBHOOK_LOG_RETENTION_DAYS} * interval '1 day'`),
        ),
      )
      .catch(() => {});
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
