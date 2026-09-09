import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb, type DbClient } from '../../database/client.js';
import { decodeCursorDate } from '../../common/cursors.js';
import { items } from '../../database/schema/items.js';
import { attachments } from '../../database/schema/attachments.js';
import { tags as tagsTable, itemTags } from '../../database/schema/tags.js';
import { issueSequences } from '../../database/schema/sequences.js';
import { itemStatuses, itemPriorities, itemTypes } from '../../database/schema/config.js';
import { users } from '../../database/schema/users.js';
import { eq, and, sql, desc, asc, gt, isNull, inArray, count } from 'drizzle-orm';

@Injectable()
export class ItemsService {
  async create(
    projectId: string,
    data: {
      title: string;
      typeId: string;
      statusId?: string;
      priorityId?: string;
      assigneeId?: string | null;
      reporterId?: string | null;
      parentId?: string | null;
      description?: string | null;
      dueDate?: string | null;
      startDate?: string | null;
      estimatedHours?: number | null;
      tagIds?: string[];
      planId?: string | null;
      roadmapId?: string | null;
    },
    reporterId: string,
  ) {
    // Sequence bump + insert (+ tags) are atomic: a later failure
    // (bad FK, missing defaults) never leaves gaps or orphans.
    const itemId = await getDb().transaction(async (txx) => {
      const db = txx as unknown as DbClient;
      const seq = await db
        .update(issueSequences)
        .set({ lastValue: sql`${issueSequences.lastValue} + 1` })
        .where(eq(issueSequences.projectId, projectId))
        .returning({ lastValue: issueSequences.lastValue });

      if (!seq[0]) {
        throw new NotFoundException('Project sequence not found');
      }

      let statusId = data.statusId;
      if (!statusId) {
        const defaultStatus = await db
          .select({ id: itemStatuses.id })
          .from(itemStatuses)
          .where(and(eq(itemStatuses.projectId, projectId), eq(itemStatuses.isDefault, true), eq(itemStatuses.category, 'inbox')))
          .limit(1);
        statusId = defaultStatus[0]?.id;
      }

      let priorityId = data.priorityId;
      if (!priorityId) {
        const defaultPriority = await db
          .select({ id: itemPriorities.id })
          .from(itemPriorities)
          .where(and(eq(itemPriorities.projectId, projectId), eq(itemPriorities.isDefault, true)))
          .limit(1);
        priorityId = defaultPriority[0]?.id;
      }

      if (!statusId || !priorityId) {
        throw new NotFoundException('Default status or priority not configured');
      }

      const newId = randomUUID();
      const sequenceNum = seq[0].lastValue!;

      if (data.parentId) {
        const parent = await db
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, data.parentId), eq(items.projectId, projectId), isNull(items.deletedAt)))
          .limit(1);
        if (!parent[0]) {
          throw new BadRequestException('Parent item not found in this project');
        }
        if (data.parentId === newId) {
          throw new BadRequestException('Item cannot be its own parent');
        }
      }

      await db.insert(items).values({
        id: newId,
        projectId,
        sequenceNum: sequenceNum as any,
        typeId: data.typeId,
        statusId,
        priorityId,
        assigneeId: data.assigneeId ?? null,
        reporterId,
        parentId: data.parentId ?? null,
        title: data.title,
        description: data.description ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        estimatedHours: (data.estimatedHours ?? null) as any,
        planId: data.planId ?? null,
        roadmapId: data.roadmapId ?? null,
      });

      if (data.tagIds?.length) {
        await db.insert(itemTags).values(
          data.tagIds.map((tagId) => ({ itemId: newId, tagId })),
        );
      }

      return newId;
    });

    return this.getById(projectId, itemId);
  }

  async clone(projectId: string, sourceItemId: string, reporterId: string) {
    const source = await this.getById(projectId, sourceItemId);
    if (!source) throw new NotFoundException('Item not found');
    return this.create(projectId, {
      title: `${source.title} (copy)`,
      typeId: source.typeId,
      statusId: source.statusId,
      priorityId: source.priorityId,
      assigneeId: source.assigneeId,
      description: source.description,
      planId: source.planId,
      tagIds: source.tags?.map((t) => t.id),
    }, reporterId);
  }

  private async getItemTags(itemId: string) {
    const db = getDb();
    const result = await db
      .select({ id: tagsTable.id, name: tagsTable.name, color: tagsTable.color })
      .from(itemTags)
      .innerJoin(tagsTable, eq(itemTags.tagId, tagsTable.id))
      .where(eq(itemTags.itemId, itemId));
    return result;
  }

  async getById(projectId: string, itemId: string) {
    const db = getDb();
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId), isNull(items.deletedAt)))
      .limit(1);
    const item = result[0] ?? null;
    if (!item) return null;
    const tagList = await this.getItemTags(itemId);
    return { ...item, tags: tagList };
  }

  async getBySequence(projectId: string, sequenceNum: number) {
    const db = getDb();
    const result = await db
      .select()
      .from(items)
      .where(
        and(eq(items.projectId, projectId), eq(items.sequenceNum, sequenceNum as any), isNull(items.deletedAt)),
      )
      .limit(1);
    const item = result[0] ?? null;
    if (!item) return null;
    const tagList = await this.getItemTags(item.id);
    return { ...item, tags: tagList };
  }

  async list(
    projectId: string,
    filters: {
      typeId?: string;
      statusId?: string;
      priorityId?: string;
      assigneeId?: string;
      reporterId?: string;
      tagIds?: string;
      parentId?: string;
      planId?: string;
      search?: string;
      cursor?: string;
      page?: number;
      limit: number;
      sort: string;
    },
  ) {
    const db = getDb();
    const conditions = [
      eq(items.projectId, projectId),
      isNull(items.deletedAt),
    ] as any[];

    if (filters.typeId) conditions.push(eq(items.typeId, filters.typeId));
    if (filters.statusId) conditions.push(eq(items.statusId, filters.statusId));
    if (filters.priorityId) conditions.push(eq(items.priorityId, filters.priorityId));
    if (filters.assigneeId) conditions.push(eq(items.assigneeId, filters.assigneeId));
    if (filters.reporterId) conditions.push(eq(items.reporterId, filters.reporterId));
    if (filters.parentId) conditions.push(eq(items.parentId, filters.parentId));
    if (filters.planId) conditions.push(eq(items.planId, filters.planId));
    if (filters.search) {
      conditions.push(
        sql`(${items.title} ILIKE ${'%' + filters.search + '%'} OR ${items.description} ILIKE ${'%' + filters.search + '%'})`,
      );
    }
    if (filters.tagIds) {
      const tagIdList = filters.tagIds.split(',').filter(Boolean);
      if (tagIdList.length > 0) {
        conditions.push(
          sql`${items.id} IN (SELECT item_id FROM item_tags WHERE tag_id = ANY(${tagIdList}::uuid[]))`,
        );
      }
    }

    const usePageMode = filters.page !== undefined && filters.page !== null;
    // Cursor mode keeps legacy behavior; page mode ignores cursor for jump support.
    if (!usePageMode && filters.cursor) {
      const { date: cursorDate } = decodeCursorDate(filters.cursor);
      conditions.push(sql`${items.createdAt} < ${cursorDate}::timestamptz`);
    }

    const isDesc = filters.sort.startsWith('-');
    const rawSortField = isDesc ? filters.sort.slice(1) : filters.sort;
    // Convert snake_case sort fields to camelCase Drizzle column names
    const camelField = rawSortField.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const columnMap: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      priority: 'priorityId',
      dueDate: 'dueDate',
      status: 'statusId',
      assignee: 'assigneeId',
    };
    const dbField = columnMap[camelField] ?? camelField;
    const orderByColumn = (items as any)[dbField] ?? items.createdAt;
    const primaryOrder = isDesc ? desc(orderByColumn) : asc(orderByColumn);
    // Stable tiebreaker so offset pagination doesn't skip/duplicate rows.
    const orderBy = [primaryOrder, desc(items.id)];

    const limit = Math.min(filters.limit, 100);

    // Filtered total for headers ("N items in project", "limit of total").
    // Runs with the same conditions (minus cursor/page slicing).
    const totalRows = await db
      .select({ value: count() })
      .from(items)
      .where(and(...conditions));
    const total = Number(totalRows[0]?.value ?? 0);

    if (usePageMode) {
      const page = Math.max(1, Math.floor(filters.page as number));
      const offset = (page - 1) * limit;
      const result = await db
        .select()
        .from(items)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const hasMore = page < totalPages;
      const lastItem = result[result.length - 1];
      const cursor = lastItem
        ? Buffer.from(`${lastItem.createdAt.toISOString()}|${lastItem.id}`).toString('base64')
        : null;
      return { data: result, meta: { cursor, hasMore, limit, total, page, totalPages } };
    }

    const result = await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit + 1);

    const hasMore = result.length > limit;
    const data = result.slice(0, limit);
    const lastItem = data[data.length - 1];
    const cursor = lastItem
      ? Buffer.from(`${lastItem.createdAt.toISOString()}|${lastItem.id}`).toString('base64')
      : null;

    return { data, meta: { cursor, hasMore, limit, total } };
  }

  /** Direct children of one item (single level, for Tree UI drill-down). */
  async listChildren(projectId: string, parentId: string) {
    const db = getDb();
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.projectId, projectId), eq(items.parentId, parentId), isNull(items.deletedAt)))
      .orderBy(desc(items.createdAt))
      .limit(200);
    return { data: result };
  }

  /** Number of non-deleted children per parent id (for expand chevrons). */
  async childrenCounts(projectId: string, parentIds: string[]) {
    const db = getDb();
    if (!parentIds.length) return {} as Record<string, number>;
    const rows = await db
      .select({ parentId: items.parentId, value: count() })
      .from(items)
      .where(
        and(
          eq(items.projectId, projectId),
          isNull(items.deletedAt),
          inArray(items.parentId, parentIds),
        ),
      )
      .groupBy(items.parentId);
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.parentId) out[r.parentId] = Number(r.value);
    }
    return out;
  }

  /** Walk ancestors to block cycles when reparenting (max depth guard). */
  async assertNoCycle(projectId: string, itemId: string, newParentId: string | null) {
    if (!newParentId) return;
    if (newParentId === itemId) throw new BadRequestException('Item cannot be its own parent');
    const db = getDb();
    let current: string | null = newParentId;
    for (let depth = 0; depth < 12; depth++) {
      if (current === itemId) throw new BadRequestException('Circular parent reference');
      const rows = await db
        .select({ parentId: items.parentId })
        .from(items)
        .where(and(eq(items.id, current as string), eq(items.projectId, projectId)))
        .limit(1);
      current = (rows[0]?.parentId as string | null) ?? null;
      if (!current) return;
    }
    throw new BadRequestException('Parent hierarchy too deep (max 10)');
  }

  async update(
    projectId: string,
    itemId: string,
    data: {
      title?: string;
      description?: string | null;
      typeId?: string;
      statusId?: string;
      priorityId?: string;
      assigneeId?: string | null;
      parentId?: string | null;
      dueDate?: string | null;
      startDate?: string | null;
      estimatedHours?: number | null;
      tagIds?: string[];
      planId?: string | null;
      roadmapId?: string | null;
    },
  ) {
    const db = getDb();

    // Capture old values before update for activity logging
    const [oldRow] = await db
      .select({
        assigneeId: items.assigneeId,
        statusId: items.statusId,
        title: items.title,
        priorityId: items.priorityId,
        description: items.description,
        planId: items.planId,
      })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId), isNull(items.deletedAt)))
      .limit(1);
    if (!oldRow) {
      throw new NotFoundException('Item not found');
    }
    if (data.parentId !== undefined) {
      await this.assertNoCycle(projectId, itemId, data.parentId);
      if (data.parentId) {
        const parent = await db
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, data.parentId), eq(items.projectId, projectId), isNull(items.deletedAt)))
          .limit(1);
        if (!parent[0]) throw new BadRequestException('Parent item not found in this project');
      }
    }
    const oldValues = {
      assigneeId: oldRow?.assigneeId ?? null,
      statusId: oldRow?.statusId ?? null,
      title: oldRow?.title ?? null,
      priorityId: oldRow?.priorityId ?? null,
      description: oldRow?.description ?? null,
      planId: oldRow?.planId ?? null,
    };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.typeId !== undefined) updateData.typeId = data.typeId;
    if (data.statusId !== undefined) updateData.statusId = data.statusId;
    if (data.priorityId !== undefined) updateData.priorityId = data.priorityId;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.planId !== undefined) updateData.planId = data.planId;
    if (data.roadmapId !== undefined) updateData.roadmapId = data.roadmapId;

    await db
      .update(items)
      .set(updateData as any)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId)));

    if (data.tagIds !== undefined) {
      await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
      if (data.tagIds.length) {
        await db.insert(itemTags).values(data.tagIds.map((tagId) => ({ itemId, tagId })));
      }
    }

    const updated = await this.getById(projectId, itemId);
    return { item: updated, oldValues };
  }

  async softDelete(projectId: string, itemId: string) {
    const db = getDb();
    const [oldItem] = await db
      .select({ title: items.title, deletedAt: items.deletedAt })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId)))
      .limit(1);
    if (!oldItem) {
      throw new NotFoundException('Item not found');
    }
    if (oldItem.deletedAt) {
      return { success: true, title: oldItem.title };
    }

    // Clean up attachments: delete physical files and DB records
    const itemAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.itemId, itemId));
    if (itemAttachments.length) {
      const basePath = process.env.STORAGE_LOCAL_PATH ?? './data/uploads';
      await Promise.all(
        itemAttachments.map((att) =>
          unlink(join(basePath, att.storagePath)).catch(() => {}),
        ),
      );
      await db.delete(attachments).where(eq(attachments.itemId, itemId));
    }

    await db
      .update(items)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId)));
    return { success: true, title: oldItem?.title ?? null };
  }

  async moveItem(
    projectId: string,
    itemId: string,
    data: { statusId: string; sortOrder?: number },
  ) {
    const db = getDb();
    const [existing] = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId), isNull(items.deletedAt)))
      .limit(1);
    if (!existing) {
      throw new NotFoundException('Item not found');
    }
    const updateData: Record<string, unknown> = {
      statusId: data.statusId,
      updatedAt: new Date(),
    };
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    await db
      .update(items)
      .set(updateData as any)
      .where(and(eq(items.id, itemId), eq(items.projectId, projectId), isNull(items.deletedAt)));

    return this.getById(projectId, itemId);
  }

  /**
   * Incremental sync for offline-capable clients: all items touched after
   * `since` (including soft-deleted stubs), oldest first. When truncated,
   * clients must fall back to a full list (fullSyncRequired).
   */
  async syncSince(projectId: string, since: Date, limit = 200) {
    const db = getDb();
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const rows = await db
      .select()
      .from(items)
      .where(and(eq(items.projectId, projectId), gt(items.updatedAt, since)))
      .orderBy(items.updatedAt)
      .limit(safeLimit + 1);

    const hasMore = rows.length > safeLimit;
    const page = rows.slice(0, safeLimit);
    const liveIds = page.filter((r) => !r.deletedAt).map((r) => r.id);
    const tagMap = new Map<string, string[]>();
    if (liveIds.length > 0) {
      const tagRows = await db
        .select({ itemId: itemTags.itemId, tagId: itemTags.tagId })
        .from(itemTags)
        .where(inArray(itemTags.itemId, liveIds));
      for (const t of tagRows) {
        const list = tagMap.get(t.itemId) ?? [];
        list.push(t.tagId);
        tagMap.set(t.itemId, list);
      }
    }

    const data = page.map((r) =>
      r.deletedAt
        ? { id: r.id, sequenceNum: r.sequenceNum, deleted: true as const, updatedAt: r.updatedAt.toISOString() }
        : { ...r, tagIds: tagMap.get(r.id) ?? [] },
    );
    return {
      data,
      meta: { serverTime: new Date().toISOString(), hasMore, fullSyncRequired: hasMore },
    };
  }

  async exportAll(projectId: string, format: 'csv' | 'json' | 'jsonl') {
    const db = getDb();

    const rows = await db
      .select({
        id: items.id,
        sequenceNum: items.sequenceNum,
        title: items.title,
        description: items.description,
        typeName: itemTypes.name,
        statusName: itemStatuses.name,
        statusCategory: itemStatuses.category,
        priorityName: itemPriorities.name,
        assigneeName: users.name,
        assigneeEmail: users.email,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        dueDate: items.dueDate,
        estimatedHours: items.estimatedHours,
        sortOrder: items.sortOrder,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.typeId, itemTypes.id))
      .leftJoin(itemStatuses, eq(items.statusId, itemStatuses.id))
      .leftJoin(itemPriorities, eq(items.priorityId, itemPriorities.id))
      .leftJoin(users, eq(items.assigneeId, users.id))
      .where(and(eq(items.projectId, projectId), isNull(items.deletedAt)))
      .orderBy(items.createdAt);

    if (format === 'json') return rows;
    if (format === 'jsonl') return rows.map((r) => JSON.stringify(r)).join('\n');

    // CSV
    const headers = ['ID', 'Sequence', 'Title', 'Description', 'Type', 'Status', 'Category', 'Priority', 'Assignee', 'Email', 'Created', 'Updated', 'Due Date', 'Est. Hours'];
    const csvRows = rows.map((r) =>
      headers.map((h) => {
        const val = (r as any)[{
          'ID': 'id', 'Sequence': 'sequenceNum', 'Title': 'title', 'Description': 'description',
          'Type': 'typeName', 'Status': 'statusName', 'Category': 'statusCategory',
          'Priority': 'priorityName', 'Assignee': 'assigneeName', 'Email': 'assigneeEmail',
          'Created': 'createdAt', 'Updated': 'updatedAt', 'Due Date': 'dueDate', 'Est. Hours': 'estimatedHours',
        }[h] ?? '']?.toString?.() ?? '';
        // Escape CSV
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','),
    );
    return [headers.join(','), ...csvRows].join('\n');
  }
}
