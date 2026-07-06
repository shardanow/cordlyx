import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getDb } from '../../database/client.js';
import { plans } from '../../database/schema/plans.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class PlansService {
  constructor(private eventEmitter: EventEmitter2) {}

  async list(projectId: string) {
    const db = getDb();
    return db
      .select()
      .from(plans)
      .where(eq(plans.projectId, projectId))
      .orderBy(plans.sortOrder);
  }

  async getById(projectId: string, planId: string) {
    const db = getDb();
    const result = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.projectId, projectId)))
      .limit(1);
    return result[0] ?? null;
  }

  async create(projectId: string, data: { name: string; type: string; description?: string; color?: string; status?: string; sortOrder?: number }) {
    const db = getDb();
    const plan = await db
      .insert(plans)
      .values({
        projectId,
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        color: data.color ?? null,
        status: data.status ?? 'active',
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    this.eventEmitter.emit('plan.created', { plan: plan[0], projectId });
    return plan[0];
  }

  async update(projectId: string, planId: string, data: { name?: string; type?: string; description?: string; color?: string; status?: string; sortOrder?: number }) {
    const db = getDb();
    const existing = await this.getById(projectId, planId);
    if (!existing) throw new NotFoundException('Plan not found');

    const updated = await db
      .update(plans)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(plans.id, planId), eq(plans.projectId, projectId)))
      .returning();

    if (data.status && data.status !== existing.status) {
      this.eventEmitter.emit('plan.status_changed', { plan: updated[0], projectId, oldStatus: existing.status, newStatus: data.status });
    } else {
      this.eventEmitter.emit('plan.updated', { plan: updated[0], projectId });
    }
    return updated[0];
  }

  async delete(projectId: string, planId: string) {
    const db = getDb();
    const existing = await this.getById(projectId, planId);
    if (!existing) throw new NotFoundException('Plan not found');

    await db
      .delete(plans)
      .where(and(eq(plans.id, planId), eq(plans.projectId, projectId)));

    this.eventEmitter.emit('plan.deleted', { planId, projectId });
    return { success: true };
  }
}
