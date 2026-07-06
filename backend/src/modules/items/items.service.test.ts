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
  });

  describe('edge cases', () => {
    it('should return null when updating non-existent item', async () => {
      const result = await itemsService.update(
        projectId,
        randomUUID(),
        { title: 'ghost' },
      );
      // getById returns null for non-existent item
      expect(result.item).toBeNull();
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
});
