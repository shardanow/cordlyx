import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { items } from '../../database/schema/items.js';
import { issueSequences } from '../../database/schema/sequences.js';
import { tags, itemTags } from '../../database/schema/tags.js';
import { eq, sql } from 'drizzle-orm';
import { ItemsService } from './items.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('ItemsService', () => {
  let itemsService: ItemsService;
  let projectsService: ProjectsService;

  let testUser: { id: string; email: string };
  let projectId: string;
  let taskTypeId: string;
  let todoStatusId: string;
  let inProgressStatusId: string;
  let doneStatusId: string;
  let mediumPriorityId: string;

  beforeAll(async () => {
    itemsService = new ItemsService();
    projectsService = new ProjectsService();

    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'items-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Items Test',
    });
    testUser = { id: userId, email: 'items-test@test.com' };

    // Create project
    const project = await projectsService.create(
      { name: 'Items Test', slug: 'items-test' },
      userId,
    );
    projectId = project!.id;

    // Get config IDs
    const types = await db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId));
    const statuses = await db.select().from(itemStatuses).where(eq(itemStatuses.projectId, projectId));
    const priorities = await db.select().from(itemPriorities).where(eq(itemPriorities.projectId, projectId));

    taskTypeId = types.find((t) => t.name === 'Task')!.id;
    todoStatusId = statuses.find((s) => s.category === 'inbox')!.id;
    inProgressStatusId = statuses.find((s) => s.name === 'In Progress')!.id;
    doneStatusId = statuses.find((s) => s.name === 'Done')!.id;
    mediumPriorityId = priorities.find((p) => p.name === 'Medium')!.id;
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  describe('create', () => {
    it('should create an item with auto-sequence', async () => {
      const item = await itemsService.create(
        projectId,
        { title: 'First item', typeId: taskTypeId },
        testUser.id,
      );

      expect(item).not.toBeNull();
      expect(item!.sequenceNum).toBe(1);
      expect(item!.title).toBe('First item');
      expect(item!.reporterId).toBe(testUser.id);
    });

    it('should auto-assign default status and priority', async () => {
      const item = await itemsService.create(
        projectId,
        { title: 'Defaults test', typeId: taskTypeId },
        testUser.id,
      );

      expect(item!.statusId).toBe(todoStatusId);
      expect(item!.priorityId).toBe(mediumPriorityId);
    });

    it('should increment sequence numbers', async () => {
      const [a, b] = await Promise.all([
        itemsService.create(projectId, { title: 'Seq A', typeId: taskTypeId }, testUser.id),
        itemsService.create(projectId, { title: 'Seq B', typeId: taskTypeId }, testUser.id),
      ]);

      expect(a!.sequenceNum).not.toBe(b!.sequenceNum);
    });
  });

  describe('getById / getBySequence', () => {
    it('should find item by id', async () => {
      const created = await itemsService.create(
        projectId, { title: 'Find by ID', typeId: taskTypeId }, testUser.id,
      );
      const found = await itemsService.getById(projectId, created!.id);
      expect(found!.title).toBe('Find by ID');
    });

    it('should find item by sequence number', async () => {
      const found = await itemsService.getBySequence(projectId, 1);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('First item');
    });
  });

  describe('update', () => {
    it('should update item fields', async () => {
      const created = await itemsService.create(
        projectId, { title: 'Update me', typeId: taskTypeId }, testUser.id,
      );

      const { item: updated } = await itemsService.update(projectId, created!.id, {
        title: 'Updated title',
        statusId: inProgressStatusId,
      });

      expect(updated!.title).toBe('Updated title');
      expect(updated!.statusId).toBe(inProgressStatusId);
    });
  });

  describe('softDelete', () => {
    it('should soft delete an item', async () => {
      const created = await itemsService.create(
        projectId, { title: 'Delete me', typeId: taskTypeId }, testUser.id,
      );

      await itemsService.softDelete(projectId, created!.id);
      const deleted = await itemsService.getById(projectId, created!.id);
      expect(deleted).toBeNull(); // deleted_at IS NULL filter
    });

    it('should still return deleted item via direct DB query', async () => {
      const db = getDb();
      const deletedItem = await db
        .select()
        .from(items)
        .where(eq(items.title, 'Delete me'))
        .limit(1);

      expect(deletedItem[0]).toBeTruthy();
      expect(deletedItem[0]!.deletedAt).not.toBeNull(); // soft delete marker present
    });
  });

  describe('list with pagination', () => {
    it('should return paginated results', async () => {
      const result = await itemsService.list(projectId, { limit: 2, sort: '-created_at' });
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.meta).toHaveProperty('cursor');
      expect(result.meta).toHaveProperty('hasMore');
    });

    it('should support cursor pagination', async () => {
      const page1 = await itemsService.list(projectId, { limit: 2, sort: '-created_at' });
      if (page1.meta.cursor) {
        const page2 = await itemsService.list(projectId, {
          limit: 2,
          cursor: page1.meta.cursor,
          sort: '-created_at',
        });
        expect(page2.data.length).toBeGreaterThanOrEqual(0);
        // No items from page 1 should appear in page 2
        const ids1 = new Set(page1.data.map((i) => i.id));
        const ids2 = page2.data.map((i) => i.id);
        expect(ids2.some((id) => ids1.has(id))).toBe(false);
      }
    });

    it('should return empty when cursor is past end', async () => {
      const epoch = new Date(0).toISOString();
      const badCursor = Buffer.from(`${epoch}|none`).toString('base64');
      const result = await itemsService.list(projectId, {
        cursor: badCursor, limit: 10, sort: '-created_at',
      });
      expect(result.data).toEqual([]);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
    });

    it('should return filtered total with page mode', async () => {
      const p1 = await itemsService.list(projectId, { limit: 2, page: 1, sort: '-created_at' });
      expect(p1.meta.total).toBeGreaterThanOrEqual(p1.data.length);
      expect(p1.meta.page).toBe(1);
      expect(p1.meta.totalPages).toBeGreaterThanOrEqual(1);
      const p2 = await itemsService.list(projectId, { limit: 2, page: 2, sort: '-created_at' });
      expect(p2.meta.page).toBe(2);
      // Pages must not overlap (stable sort with id tiebreaker).
      const ids1 = new Set(p1.data.map((i) => i.id));
      expect(p2.data.some((i) => ids1.has(i.id))).toBe(false);
      // Total is consistent across pages.
      expect(p2.meta.total).toBe(p1.meta.total);
    });

    it('should return total in cursor mode too (for headers)', async () => {
      const result = await itemsService.list(projectId, { limit: 5, sort: '-created_at' });
      expect(result.meta.total).toBeGreaterThanOrEqual(result.data.length);
    });

    it('should attach tags to listed items', async () => {
      const db = getDb();
      const [tag] = await db.insert(tags).values({ projectId, name: `t-${Date.now()}`, color: '#ff0000' }).returning();
      const tagged = await itemsService.create(
        projectId, { title: 'Tagged item', typeId: taskTypeId, tagIds: [tag.id] }, testUser.id,
      );
      const result = await itemsService.list(projectId, { limit: 50, sort: '-created_at' });
      const row = result.data.find((i) => i.id === tagged!.id) as unknown as { tags: { id: string; name: string }[] };
      expect(row.tags.map((t) => t.id)).toContain(tag.id);
      const untaggedRow = result.data.find((i) => i.id !== tagged!.id) as unknown as { tags: unknown[] };
      expect(untaggedRow.tags).toEqual([]);
    });

    it('should filter by tagIds and reject garbage', async () => {
      const db = getDb();
      const [tag] = await db.insert(tags).values({ projectId, name: `f-${Date.now()}` }).returning();
      const tagged = await itemsService.create(
        projectId, { title: 'Filtered item', typeId: taskTypeId, tagIds: [tag.id] }, testUser.id,
      );
      await itemsService.create(projectId, { title: 'Plain item', typeId: taskTypeId }, testUser.id);

      const one = await itemsService.list(projectId, { limit: 50, sort: '-created_at', tagIds: tag.id });
      expect(one.data.map((i) => i.id)).toContain(tagged!.id);
      expect(one.meta.total).toBe(1);

      await expect(
        itemsService.list(projectId, { limit: 5, sort: '-created_at', tagIds: 'not-a-uuid' }),
      ).rejects.toThrow('Invalid tag id');
    });
  });

  describe('hierarchy (parentId tree)', () => {
    it('should count children and list them, and block cycles', async () => {
      const parent = await itemsService.create(
        projectId, { title: 'Tree parent', typeId: taskTypeId }, testUser.id,
      );
      const child = await itemsService.create(
        projectId, { title: 'Tree child', typeId: taskTypeId, parentId: parent!.id }, testUser.id,
      );
      const grandchild = await itemsService.create(
        projectId, { title: 'Tree grandchild', typeId: taskTypeId, parentId: child!.id }, testUser.id,
      );
      expect(grandchild).not.toBeNull();

      const counts = await itemsService.childrenCounts(projectId, [parent!.id, child!.id]);
      expect(counts[parent!.id]).toBe(1);
      expect(counts[child!.id]).toBe(1);

      const listed = await itemsService.listChildren(projectId, parent!.id);
      expect(listed.data.some((i) => i.id === child!.id)).toBe(true);

      // Reparenting parent under its own grandchild must fail.
      await expect(
        itemsService.update(projectId, parent!.id, { parentId: grandchild!.id }),
      ).rejects.toThrow();
      // Self-parent must fail.
      await expect(
        itemsService.update(projectId, parent!.id, { parentId: parent!.id }),
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should throw NotFound when updating non-existent item', async () => {
      await expect(
        itemsService.update(projectId, randomUUID(), { title: 'ghost' }),
      ).rejects.toThrow('Item not found');
    });

    it('should be idempotent when soft-deleting already deleted item', async () => {
      const created = await itemsService.create(
        projectId, { title: 'Double delete', typeId: taskTypeId }, testUser.id,
      );

      await itemsService.softDelete(projectId, created!.id);
      // Should not throw on second delete
      await expect(
        itemsService.softDelete(projectId, created!.id),
      ).resolves.not.toThrow();
    });

    it('should not list soft-deleted items', async () => {
      const created = await itemsService.create(
        projectId, { title: 'Will be deleted', typeId: taskTypeId }, testUser.id,
      );

      // Verify it appears before delete
      const before = await itemsService.list(projectId, { limit: 50, sort: '-created_at' });
      expect(before.data.some((i) => i.id === created!.id)).toBe(true);

      await itemsService.softDelete(projectId, created!.id);

      // Verify it no longer appears after delete
      const after = await itemsService.list(projectId, { limit: 50, sort: '-created_at' });
      expect(after.data.some((i) => i.id === created!.id)).toBe(false);
    });
  });

  describe('transactions', () => {
    it('should not consume sequence numbers on failed create', async () => {
      const db = getDb();
      const { issueSequences } = await import('../../database/schema/sequences.js');
      const { eq } = await import('drizzle-orm');
      const before = await db
        .select({ lastValue: issueSequences.lastValue })
        .from(issueSequences)
        .where(eq(issueSequences.projectId, projectId))
        .limit(1);

      await expect(
        itemsService.create(projectId, { title: 'Bad FK', typeId: randomUUID() }, testUser.id),
      ).rejects.toThrow();

      const after = await db
        .select({ lastValue: issueSequences.lastValue })
        .from(issueSequences)
        .where(eq(issueSequences.projectId, projectId))
        .limit(1);
      expect(after[0]!.lastValue).toBe(before[0]!.lastValue);
    });
  });

  describe('syncSince', () => {    it('returns touched items with tags and deleted stubs, oldest first', async () => {
      const since = new Date();
      // Ensure updatedAt ordering is deterministic
      await new Promise((r) => setTimeout(r, 10));

      const a = (await itemsService.create(
        projectId, { title: 'Sync A', typeId: taskTypeId, tagIds: [] }, testUser.id,
      ))!;
      const b = (await itemsService.create(
        projectId, { title: 'Sync B', typeId: taskTypeId }, testUser.id,
      ))!;
      await itemsService.update(projectId, a.id, { description: 'touched' });
      await itemsService.softDelete(projectId, b.id);

      const res = await itemsService.syncSince(projectId, since, 200);
      const ids = res.data.map((r: any) => r.id);
      expect(ids).toContain(a.id);
      expect(ids).toContain(b.id);
      expect(res.meta.hasMore).toBe(false);
      expect(res.meta.fullSyncRequired).toBe(false);
      expect(typeof res.meta.serverTime).toBe('string');

      const stub: any = res.data.find((r: any) => r.id === b.id);
      expect(stub.deleted).toBe(true);

      const live: any = res.data.find((r: any) => r.id === a.id);
      expect(live.title).toBe('Sync A');
      expect(Array.isArray(live.tagIds)).toBe(true);

      // Ascending by updatedAt
      const times = res.data.map((r: any) => new Date(r.updatedAt).getTime());
      expect([...times].sort((x, y) => x - y)).toEqual(times);
    });

    it('flags truncation for full sync fallback', async () => {
      const res = await itemsService.syncSince(projectId, new Date(0), 1);
      expect(res.meta.hasMore).toBe(true);
      expect(res.meta.fullSyncRequired).toBe(true);
      expect(res.data).toHaveLength(1);
    });
  });
});
