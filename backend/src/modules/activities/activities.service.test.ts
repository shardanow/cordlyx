import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ActivitiesService } from './activities.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { activities } from '../../database/schema/activities.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('ActivitiesService', () => {
  let activitiesService: ActivitiesService;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    activitiesService = new ActivitiesService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'activities-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Activities Test',
    });

    projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Activities Test Project',
      slug: 'activities-test-project',
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });

    // Insert test activities with different timestamps
    for (let i = 0; i < 5; i++) {
      await db.insert(activities).values({
        id: randomUUID(),
        projectId,
        actorId: userId,
        itemId: null,
        action: 'item.created',
        fieldName: null,
        oldValue: null,
        newValue: null,
        metadata: { iteration: i },
        createdAt: new Date(Date.now() - i * 1000),
      });
    }
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should return activities for project', async () => {
    const result = await activitiesService.getByProject(projectId);
    expect(result.data.length).toBe(5);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.cursor).not.toBeNull();
  });

  it('should return paginated results with limit', async () => {
    const result = await activitiesService.getByProject(projectId, undefined, 2);
    expect(result.data.length).toBe(2);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.cursor).not.toBeNull();
  });

  it('should use cursor for next page', async () => {
    const page1 = await activitiesService.getByProject(projectId, undefined, 2);
    const page2 = await activitiesService.getByProject(projectId, page1.meta.cursor!, 2);
    expect(page2.data.length).toBe(2);
    expect(page2.meta.hasMore).toBe(true);
  });

  it('should return empty for non-existent project', async () => {
    const result = await activitiesService.getByProject(randomUUID());
    expect(result.data).toEqual([]);
    expect(result.meta.cursor).toBeNull();
  });

  it('should include actor info', async () => {
    const result = await activitiesService.getByProject(projectId, undefined, 1);
    expect(result.data[0]!.actor).toBeDefined();
    expect(result.data[0]!.actor!.name).toBe('Activities Test');
  });

  it('should return empty for non-existent item', async () => {
    const result = await activitiesService.getByItem(randomUUID());
    expect(result.data).toEqual([]);
  });

  it('should cap limit at 100', async () => {
    const result = await activitiesService.getByProject(projectId, undefined, 999);
    expect(result.data.length).toBe(5);
    expect(result.meta.limit).toBe(100);
  });

  it('should return empty when cursor is past end', async () => {
    // Craft a cursor pointing to epoch (before any activity)
    const epoch = new Date(0).toISOString();
    const pastCursor = Buffer.from(`${epoch}|none`).toString('base64');
    const result = await activitiesService.getByProject(projectId, pastCursor, 10);
    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.cursor).toBeNull();
  });

  it('should return hasMore when results exactly match limit', async () => {
    // Create enough activities to hit exactly 2 on a second page
    // We already have 5, so page 1 (limit=2) → 2 items, hasMore=true
    // page 2 (limit=2) → 2 items, hasMore=true
    // page 3 (limit=2) → 1 item, hasMore=false
    const page1 = await activitiesService.getByProject(projectId, undefined, 2);
    expect(page1.data.length).toBe(2);
    expect(page1.meta.hasMore).toBe(true);

    const page2 = await activitiesService.getByProject(projectId, page1.meta.cursor!, 2);
    expect(page2.data.length).toBe(2);
    expect(page2.meta.hasMore).toBe(true);

    const page3 = await activitiesService.getByProject(projectId, page2.meta.cursor!, 2);
    expect(page3.data.length).toBe(1);
    expect(page3.meta.hasMore).toBe(false);
  });
});
