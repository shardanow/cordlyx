import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CommentsService } from './comments.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { items } from '../../database/schema/items.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { issueSequences } from '../../database/schema/sequences.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('CommentsService', () => {
  let commentsService: CommentsService;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    commentsService = new CommentsService({ getByCommentIds: async () => [] } as any);
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'comments-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Comments Test',
    });

    const projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Comments Test Project',
      slug: 'comments-test-project',
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });

    await db.insert(issueSequences).values({ projectId, lastValue: 0 });

    const [type] = await db.insert(itemTypes).values({
      id: randomUUID(), projectId, name: 'Task', color: '#3B82F6', isDefault: true, sortOrder: '0',
    }).returning({ id: itemTypes.id });
    const [status] = await db.insert(itemStatuses).values({
      id: randomUUID(), projectId, name: 'Todo', color: '#6B7280', category: 'todo', isDefault: true, sortOrder: '0',
    }).returning({ id: itemStatuses.id });
    const [priority] = await db.insert(itemPriorities).values({
      id: randomUUID(), projectId, name: 'Medium', color: '#F59E0B', isDefault: true, sortOrder: '0',
    }).returning({ id: itemPriorities.id });

    await db.insert(projectMembers).values({
      id: randomUUID(), projectId, userId, role: 'member',
    });

    itemId = randomUUID();
    await db.insert(items).values({
      id: itemId,
      projectId,
      sequenceNum: 1,
      typeId: type.id,
      statusId: status.id,
      priorityId: priority.id,
      assigneeId: userId,
      reporterId: userId,
      title: 'Test Item',
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should list comments (empty)', async () => {
    const result = await commentsService.getByItem(itemId);
    expect(result).toEqual([]);
  });

  it('should create a comment', async () => {
    const comment = await commentsService.create(itemId, userId, 'Hello world');
    expect(comment).not.toBeNull();
    expect(comment!.body).toBe('Hello world');
    expect(comment!.authorId).toBe(userId);
    expect(comment!.parentId).toBeNull();
    expect(comment!.author!.name).toBe('Comments Test');
  });

  it('should create a reply (with parentId)', async () => {
    const comments = await commentsService.getByItem(itemId);
    const parent = comments[0]!;
    const reply = await commentsService.create(itemId, userId, 'Reply!', parent.id);
    expect(reply!.parentId).toBe(parent.id);
  });

  it('should list comments with author', async () => {
    const result = await commentsService.getByItem(itemId);
    expect(result.length).toBe(1);
    expect(result[0]!.author).toBeDefined();
    expect(result[0]!.author!.name).toBe('Comments Test');
    expect(result[0]!.replies.length).toBe(1);
  });

  it('should update comment body', async () => {
    const comments = await commentsService.getByItem(itemId);
    const comment = comments[0]!;
    const updated = await commentsService.update(comment.id, 'Updated body');
    expect(updated!.body).toBe('Updated body');
  });

  it('should soft delete comment', async () => {
    const comments = await commentsService.getByItem(itemId);
    const comment = comments[0]!;
    const result = await commentsService.softDelete(comment.id);
    expect(result).toEqual({ success: true });

    const remaining = await commentsService.getByItem(itemId);
    expect(remaining.find((c) => c.id === comment.id)).toBeUndefined();
  });

  it('should be idempotent on soft-deleting already deleted comment', async () => {
    const fresh = await commentsService.create(itemId, userId, 'Idempotent test');
    const result = await commentsService.softDelete(fresh!.id);
    expect(result).toEqual({ success: true });

    // Second delete should also succeed (not throw)
    const result2 = await commentsService.softDelete(fresh!.id);
    expect(result2).toEqual({ success: true });
  });

  it('should return undefined when updating non-existent comment', async () => {
    const result = await commentsService.update(randomUUID(), 'Any body');
    expect(result).toBeUndefined();
  });

  it('should exclude soft-deleted comments from listing', async () => {
    // Only one comment remains after previous delete; create a fresh one
    const fresh = await commentsService.create(itemId, userId, 'Will be hidden');
    expect(fresh).not.toBeNull();

    const before = await commentsService.getByItem(itemId);
    expect(before.some((c) => c.id === fresh!.id)).toBe(true);

    await commentsService.softDelete(fresh!.id);

    const after = await commentsService.getByItem(itemId);
    expect(after.some((c) => c.id === fresh!.id)).toBe(false);
  });
});
