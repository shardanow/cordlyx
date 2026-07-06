import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SearchService } from './search.service.js';
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

describe('SearchService', () => {
  let searchService: SearchService;
  let projectId: string;
  let projectSlug: string;

  beforeAll(async () => {
    searchService = new SearchService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'search-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Search Test',
    });

    projectId = randomUUID();
    projectSlug = 'search-test-project';
    await db.insert(projects).values({
      id: projectId,
      name: 'Search Test Project',
      slug: projectSlug,
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

    // Insert items with titles that will have search vectors
const titles = [
  'Authentication login page CSS styling',
  'Database connection pool configuration',
  'API endpoint rate limiting',
  'Frontend dark mode theme toggle',
  'WebSocket real-time notifications',
  'Login form validation error',
  'Database migration rollback script',
  'API documentation generator',
  'Frontend component unit testing',
  'WebSocket reconnection logic',
];
    for (let i = 0; i < titles.length; i++) {
      await db.insert(items).values({
        id: randomUUID(),
        projectId,
        sequenceNum: i + 1,
        typeId: type.id,
        statusId: status.id,
        priorityId: priority.id,
        assigneeId: userId,
        reporterId: userId,
        title: titles[i]!,
      });
    }
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should find items matching search query', async () => {
    const result = await searchService.search('login', projectId);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0]!.title.toLowerCase()).toContain('login');
  });

  it('should return empty for no matches', async () => {
    const result = await searchService.search('zzzzzznonexistent', projectId);
    expect(result.data).toEqual([]);
  });

  it('should include project slug and name', async () => {
    const result = await searchService.search('login', projectId);
    expect(result.data[0]!.projectSlug).toBe(projectSlug);
    expect(result.data[0]!.projectName).toBe('Search Test Project');
  });

  it('should search across all projects when no projectId', async () => {
    const result = await searchService.search('login');
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should paginate results', async () => {
    const firstPage = await searchService.search('login', projectId, { limit: 1 });
    expect(firstPage.data.length).toBe(1);
    expect(firstPage.meta.cursor).not.toBeNull();
  });

  it('should support cursor-based pagination', async () => {
    const page1 = await searchService.search('login', projectId, { limit: 1 });
    if (page1.meta.cursor) {
      const page2 = await searchService.search('login', projectId, { cursor: page1.meta.cursor, limit: 1 });
      expect(page2.data.length).toBeGreaterThanOrEqual(1);
      // Verify no overlap
      const ids1 = page1.data.map((i) => i.id);
      const ids2 = page2.data.map((i) => i.id);
      for (const id of ids1) {
        expect(ids2).not.toContain(id);
      }
    }
  });

  it('should return empty when cursor is past end', async () => {
    const epoch = new Date(0).toISOString();
    const pastCursor = Buffer.from(`${epoch}|00000000-0000-0000-0000-000000000000`).toString('base64');
    const result = await searchService.search('login', projectId, { cursor: pastCursor, limit: 10 });
    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.cursor).toBeNull();
  });

  it('should handle empty search query gracefully', async () => {
    const result = await searchService.search('', projectId);
    // empty query returns empty — plainto_tsquery('english', '') returns nothing
    expect(result.data).toEqual([]);
  });

  it('should handle special characters in search query', async () => {
    const result = await searchService.search('login & | ! @ # $ % ^ * ( )', projectId);
    // Should not crash; may or may not find results but must not throw
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toHaveProperty('hasMore');
  });
});
