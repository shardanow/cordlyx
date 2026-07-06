import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TagsService } from './tags.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('TagsService', () => {
  let tagsService: TagsService;
  let projectId: string;

  beforeAll(async () => {
    tagsService = new TagsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'tags-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Tags Test',
    });

    projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Tags Test Project',
      slug: 'tags-test-project',
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });

    await db.insert(itemTypes).values({
      id: randomUUID(), projectId, name: 'Task', color: '#3B82F6', isDefault: true, sortOrder: '0',
    });
    await db.insert(itemStatuses).values({
      id: randomUUID(), projectId, name: 'Todo', color: '#6B7280', category: 'todo', isDefault: true, sortOrder: '0',
    });
    await db.insert(itemPriorities).values({
      id: randomUUID(), projectId, name: 'Medium', color: '#F59E0B', isDefault: true, sortOrder: '0',
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should list tags (empty)', async () => {
    const result = await tagsService.list(projectId);
    expect(result).toEqual([]);
  });

  it('should create a tag', async () => {
    const tag = await tagsService.create(projectId, 'frontend', '#3B82F6');
    expect(tag.name).toBe('frontend');
    expect(tag.color).toBe('#3B82F6');
    expect(tag.projectId).toBe(projectId);
  });

  it('should create a tag without color', async () => {
    const tag = await tagsService.create(projectId, 'backend', null);
    expect(tag).not.toBeNull();
    expect(tag!.name).toBe('backend');
    expect(tag!.color).toBeNull();
  });

  it('should list tags after creation', async () => {
    const result = await tagsService.list(projectId);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.map((t) => t.name)).toContain('frontend');
    expect(result.map((t) => t.name)).toContain('backend');
  });

  it('should delete a tag', async () => {
    const tags = await tagsService.list(projectId);
    const tag = tags[0]!;
    const result = await tagsService.delete(tag.id);
    expect(result).toEqual({ success: true });

    const remaining = await tagsService.list(projectId);
    expect(remaining.find((t) => t.id === tag.id)).toBeUndefined();
  });

  it('should delete non-existent tag without error', async () => {
    const result = await tagsService.delete(randomUUID());
    expect(result).toEqual({ success: true });
  });
});
