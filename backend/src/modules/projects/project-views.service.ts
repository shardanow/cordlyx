import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { projectViews, type SavedViewFilters } from '../../database/schema/project-views.js';
import { eq, and, or, desc } from 'drizzle-orm';
import { z } from 'zod';

export const viewFiltersSchema = z.object({
  typeId: z.string().uuid().or(z.literal('')).optional(),
  statusId: z.string().uuid().or(z.literal('')).optional(),
  priorityId: z.string().uuid().or(z.literal('')).optional(),
  assigneeId: z.string().uuid().or(z.literal('')).optional(),
  planId: z.string().uuid().or(z.literal('')).optional(),
  search: z.string().max(500).optional(),
});

export const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  filters: viewFiltersSchema.optional().default({}),
  isShared: z.boolean().optional().default(false),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: viewFiltersSchema.optional(),
  isShared: z.boolean().optional(),
});

@Injectable()
export class ProjectViewsService {
  /** Own views plus views shared with the project. */
  async list(projectId: string, userId: string) {
    const db = getDb();
    return db
      .select()
      .from(projectViews)
      .where(
        and(
          eq(projectViews.projectId, projectId),
          or(eq(projectViews.ownerId, userId), eq(projectViews.isShared, true)),
        ),
      )
      .orderBy(desc(projectViews.isDefault), projectViews.createdAt);
  }

  async create(projectId: string, ownerId: string, data: { name: string; filters?: SavedViewFilters; isShared?: boolean }) {
    const db = getDb();
    const [view] = await db
      .insert(projectViews)
      .values({
        projectId,
        ownerId,
        name: data.name.trim(),
        filters: data.filters ?? {},
        isShared: data.isShared ?? false,
      })
      .returning();
    return view;
  }

  private async requireEditable(viewId: string, projectId: string, userId: string, isAdmin: boolean) {
    const db = getDb();
    const [view] = await db
      .select()
      .from(projectViews)
      .where(and(eq(projectViews.id, viewId), eq(projectViews.projectId, projectId)))
      .limit(1);
    if (!view) throw new NotFoundException('View not found');
    if (view.ownerId !== userId && !isAdmin) {
      throw new ForbiddenException('Only the owner or a project admin can change this view');
    }
    return view;
  }

  async update(
    viewId: string,
    projectId: string,
    userId: string,
    isAdmin: boolean,
    data: { name?: string; filters?: SavedViewFilters; isShared?: boolean },
  ) {
    await this.requireEditable(viewId, projectId, userId, isAdmin);
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.filters !== undefined) patch.filters = data.filters;
    if (data.isShared !== undefined) patch.isShared = data.isShared;
    const [updated] = await db.update(projectViews).set(patch as never).where(eq(projectViews.id, viewId)).returning();
    return updated;
  }

  async remove(viewId: string, projectId: string, userId: string, isAdmin: boolean) {
    const view = await this.requireEditable(viewId, projectId, userId, isAdmin);
    const db = getDb();
    await db.delete(projectViews).where(eq(projectViews.id, viewId));
    return { success: true, wasDefault: view.isDefault };
  }

  /** Project default view (admin only) — exactly one per project. */
  async setDefault(viewId: string, projectId: string) {
    const db = getDb();
    const [view] = await db
      .select()
      .from(projectViews)
      .where(and(eq(projectViews.id, viewId), eq(projectViews.projectId, projectId)))
      .limit(1);
    if (!view) throw new NotFoundException('View not found');
    await db.update(projectViews).set({ isDefault: false }).where(eq(projectViews.projectId, projectId));
    const [updated] = await db
      .update(projectViews)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(projectViews.id, viewId))
      .returning();
    return updated;
  }
}
