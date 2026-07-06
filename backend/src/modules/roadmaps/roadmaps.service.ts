import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getDb } from '../../database/client.js';
import { roadmaps } from '../../database/schema/roadmaps.js';
import { roadmapLanes } from '../../database/schema/roadmap-lanes.js';
import { roadmapItems } from '../../database/schema/roadmap-items.js';
import { items } from '../../database/schema/items.js';
import { itemRelations } from '../../database/schema/relations.js';
import { itemTags, tags as tagsTable } from '../../database/schema/tags.js';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';

@Injectable()
export class RoadmapsService {
  constructor(private eventEmitter: EventEmitter2) {}

  private async attachTagsToItems(itemList: any[]) {
    if (!itemList.length) return itemList;
    const db = getDb();
    const itemIds = itemList.map((i) => i.id);
    const tagRows = await db
      .select({
        itemId: itemTags.itemId,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
      .from(itemTags)
      .innerJoin(tagsTable, eq(itemTags.tagId, tagsTable.id));

    const tagMap: Record<string, { id: string; name: string; color: string | null }[]> = {};
    for (const row of tagRows) {
      const iid = row.itemId;
      if (iid) {
        if (!tagMap[iid]) tagMap[iid] = [];
        tagMap[iid].push({ id: row.id ?? '', name: row.name ?? '', color: row.color });
      }
    }
    return itemList.map((item) => ({ ...item, tags: tagMap[item.id] ?? [] }));
  }

  async list(projectId: string, filters: { sort?: string; search?: string }) {
    const db = getDb();
    const conditions = [eq(roadmaps.projectId, projectId)] as any[];
    if (filters.search) {
      conditions.push(sql`${roadmaps.name} ILIKE ${'%' + filters.search + '%'}`);
    }
    const isDesc = filters.sort?.startsWith('-');
    const sortField = isDesc ? filters.sort!.slice(1) : filters.sort;
    const columnMap: Record<string, any> = {
      name: roadmaps.name,
      created_at: roadmaps.createdAt,
      sort_order: roadmaps.sortOrder,
    };
    const orderColumn = columnMap[sortField ?? 'created_at'] ?? roadmaps.createdAt;
    const orderDir = isDesc ? sql`${orderColumn} DESC` : sql`${orderColumn} ASC`;
    return db
      .select()
      .from(roadmaps)
      .where(and(...conditions))
      .orderBy(orderDir);
  }

  async getById(projectId: string, roadmapId: string) {
    const db = getDb();
    const [roadmap] = await db
      .select()
      .from(roadmaps)
      .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.projectId, projectId)))
      .limit(1);
    return roadmap ?? null;
  }

  async create(
    projectId: string,
    data: {
      name: string;
      description?: string | null;
      startDate: string;
      endDate: string;
      color?: string | null;
      sortOrder?: number;
    },
  ) {
    const db = getDb();
    const [roadmap] = await db
      .insert(roadmaps)
      .values({
        projectId,
        name: data.name,
        description: data.description ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        color: data.color ?? null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    this.eventEmitter.emit('roadmap.created', { roadmap, projectId });
    return roadmap;
  }

  async update(
    projectId: string,
    roadmapId: string,
    data: {
      name?: string;
      description?: string | null;
      startDate?: string;
      endDate?: string;
      color?: string | null;
      sortOrder?: number;
    },
  ) {
    const db = getDb();
    const existing = await this.getById(projectId, roadmapId);
    if (!existing) throw new NotFoundException('Roadmap not found');

    const [updated] = await db
      .update(roadmaps)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.projectId, projectId)))
      .returning();
    this.eventEmitter.emit('roadmap.updated', { roadmap: updated, projectId });
    return updated;
  }

  async delete(projectId: string, roadmapId: string) {
    const db = getDb();
    const existing = await this.getById(projectId, roadmapId);
    if (!existing) throw new NotFoundException('Roadmap not found');

    await db
      .delete(roadmaps)
      .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.projectId, projectId)));
    this.eventEmitter.emit('roadmap.deleted', { roadmapId, projectId });
    return { success: true };
  }

  async getRoadmapWithItems(projectId: string, roadmapId: string) {
    const db = getDb();
    const roadmap = await this.getById(projectId, roadmapId);
    if (!roadmap) throw new NotFoundException('Roadmap not found');

    // Fetch lanes from the dedicated table
    const lanes = await db
      .select()
      .from(roadmapLanes)
      .where(eq(roadmapLanes.roadmapId, roadmapId))
      .orderBy(roadmapLanes.sortOrder);

    // Fetch roadmap-items junction, joined with items
    const riRows = await db
      .select({
        ri: roadmapItems,
        item: items,
      })
      .from(roadmapItems)
      .innerJoin(items, eq(roadmapItems.itemId, items.id))
      .where(and(eq(roadmapItems.roadmapId, roadmapId), isNull(items.deletedAt)))
      .orderBy(roadmapItems.sortOrder);

    const allItems = riRows.map((r) => ({ ...r.item, tags: [] as any[] }));
    const itemsWithTags = await this.attachTagsToItems(allItems);

    // Build a map: itemId → laneId
    const itemLaneMap: Record<string, string | null> = {};
    for (const r of riRows) {
      itemLaneMap[r.item.id] = r.ri.laneId ?? null;
    }

    // Build itemsWithDates map
    const itemDatesMap: Record<string, { startDate: string | null; dueDate: string | null }> = {};
    for (const r of riRows) {
      itemDatesMap[r.item.id] = {
        startDate: r.ri.startDate?.toISOString() ?? null,
        dueDate: r.ri.dueDate?.toISOString() ?? null,
      };
    }

    // Merge laneId and dates into items
    const mergedItems = itemsWithTags.map((item) => ({
      ...item,
      roadmapLaneId: itemLaneMap[item.id] ?? null,
      roadmapStartDate: itemDatesMap[item.id]?.startDate ?? null,
      roadmapDueDate: itemDatesMap[item.id]?.dueDate ?? null,
    }));

    // Group by lane
    const lanesWithItems = lanes.map((lane) => ({
      ...lane,
      items: mergedItems.filter((item) => item.roadmapLaneId === lane.id),
    }));

    // Unscheduled: items not in any roadmap_items for this project
    const unscheduledItems = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.projectId, projectId),
          isNull(items.deletedAt),
          sql`${items.id} NOT IN (SELECT item_id FROM ${roadmapItems} WHERE roadmap_id = ${roadmapId})`,
        ),
      )
      .orderBy(items.createdAt);

    const unscheduledWithTags = await this.attachTagsToItems(unscheduledItems);

    return { roadmap, lanes: lanesWithItems, unscheduledItems: unscheduledWithTags };
  }

  async getRoadmapRelations(projectId: string, roadmapId: string) {
    const db = getDb();
    const riRows = await db
      .select({ itemId: roadmapItems.itemId })
      .from(roadmapItems)
      .where(eq(roadmapItems.roadmapId, roadmapId));
    const itemIds = riRows.map((r) => r.itemId);
    if (!itemIds.length) return [];

    const rows = await db
      .select({
        relation: itemRelations,
        sourceItem: {
          id: items.id,
          sequenceNum: items.sequenceNum,
          title: items.title,
        },
        targetItem: {
          id: items.id,
          sequenceNum: items.sequenceNum,
          title: items.title,
        },
      })
      .from(itemRelations)
      .leftJoin(items, eq(itemRelations.targetItemId, items.id))
      .where(
        and(
          inArray(itemRelations.sourceItemId, itemIds),
          isNull(items.deletedAt),
        ),
      );

    const sourceItemMap: Record<string, { id: string; sequenceNum: number; title: string } | null> = {};
    for (const r of rows) {
      sourceItemMap[r.relation.sourceItemId] = r.sourceItem;
    }
    const targetItemMap: Record<string, { id: string; sequenceNum: number; title: string } | null> = {};
    for (const r of rows) {
      targetItemMap[r.relation.targetItemId] = r.targetItem;
    }

    return rows.map((r) => ({
      ...r.relation,
      sourceItem: sourceItemMap[r.relation.sourceItemId] ?? null,
      targetItem: targetItemMap[r.relation.targetItemId] ?? null,
    }));
  }

  // --- Lane CRUD ---

  async createLane(roadmapId: string, data: { name: string; color?: string | null; sortOrder?: number }) {
    const db = getDb();
    const [lane] = await db
      .insert(roadmapLanes)
      .values({
        roadmapId,
        name: data.name,
        color: data.color ?? null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return lane;
  }

  async updateLane(laneId: string, data: { name?: string; icon?: string | null; color?: string | null; sortOrder?: number }) {
    const db = getDb();
    const [updated] = await db
      .update(roadmapLanes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roadmapLanes.id, laneId))
      .returning();
    if (!updated) throw new NotFoundException('Lane not found');
    return updated;
  }

  async deleteLane(laneId: string) {
    const db = getDb();
    const existing = await db
      .select({ id: roadmapLanes.id })
      .from(roadmapLanes)
      .where(eq(roadmapLanes.id, laneId))
      .limit(1);
    if (!existing[0]) throw new NotFoundException('Lane not found');

    // Remove lane reference from roadmap_items
    await db
      .update(roadmapItems)
      .set({ laneId: null })
      .where(eq(roadmapItems.laneId, laneId));

    await db
      .delete(roadmapLanes)
      .where(eq(roadmapLanes.id, laneId));
    return { success: true };
  }

  // --- Scheduling ---

  async scheduleItems(
    projectId: string,
    roadmapId: string,
    data: { itemIds: string[]; laneId?: string | null; startDate?: string | null; dueDate?: string | null },
  ) {
    const db = getDb();
    const existing = await this.getById(projectId, roadmapId);
    if (!existing) throw new NotFoundException('Roadmap not found');

    const now = new Date();
    const values = data.itemIds.map((itemId) => ({
      roadmapId,
      itemId,
      laneId: data.laneId ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      sortOrder: now.getTime(),
      createdAt: now,
    }));

    // Upsert: insert or update on conflict (roadmap_id, item_id)
    for (const val of values) {
      await db
        .insert(roadmapItems)
        .values(val)
        .onConflictDoUpdate({
          target: [roadmapItems.roadmapId, roadmapItems.itemId],
          set: {
            laneId: val.laneId,
            startDate: val.startDate,
            dueDate: val.dueDate,
            sortOrder: val.sortOrder,
          },
        });
    }

    return this.getRoadmapWithItems(projectId, roadmapId);
  }

  async unscheduleItem(projectId: string, roadmapId: string, itemId: string) {
    const db = getDb();
    await db
      .delete(roadmapItems)
      .where(
        and(
          eq(roadmapItems.roadmapId, roadmapId),
          eq(roadmapItems.itemId, itemId),
        ),
      );
    return this.getRoadmapWithItems(projectId, roadmapId);
  }

  async updateItemDates(
    projectId: string,
    roadmapId: string,
    itemId: string,
    data: { startDate?: string | null; dueDate?: string | null; laneId?: string | null; roadmapId?: string },
  ) {
    const db = getDb();
    const updateData: Record<string, unknown> = {};
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.laneId !== undefined) updateData.laneId = data.laneId;

    if (Object.keys(updateData).length > 0) {
      await db
        .update(roadmapItems)
        .set(updateData as any)
        .where(
          and(
            eq(roadmapItems.roadmapId, roadmapId),
            eq(roadmapItems.itemId, itemId),
          ),
        );
    }

    return this.getRoadmapWithItems(projectId, roadmapId);
  }
}
