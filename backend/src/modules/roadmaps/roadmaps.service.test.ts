import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RoadmapsService } from './roadmaps.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('RoadmapsService', () => {
  let roadmapsService: RoadmapsService;
  let projectId: string;

  beforeAll(async () => {
    roadmapsService = new RoadmapsService({ emit: () => {} } as any);
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'roadmaps-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Roadmaps Test',
    });

    projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Roadmaps Test Project',
      slug: 'roadmaps-test-project',
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should list roadmaps (empty)', async () => {
    const result = await roadmapsService.list(projectId, {});
    expect(result).toEqual([]);
  });

  it('should create a roadmap', async () => {
    const roadmap = await roadmapsService.create(projectId, {
      name: 'Q1 2025',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      color: '#3B82F6',
    });
    expect(roadmap.name).toBe('Q1 2025');
    expect(roadmap.color).toBe('#3B82F6');
  });

  it('should list roadmaps after creation', async () => {
    const result = await roadmapsService.list(projectId, {});
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.map((r) => r.name)).toContain('Q1 2025');
  });

  it('should get roadmap by id', async () => {
    const list = await roadmapsService.list(projectId, {});
    const roadmap = list[0]!;
    const found = await roadmapsService.getById(projectId, roadmap.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(roadmap.id);
  });

  it('should update a roadmap', async () => {
    const list = await roadmapsService.list(projectId, {});
    const roadmap = list[0]!;
    const updated = await roadmapsService.update(projectId, roadmap.id, { name: 'Q2 2025', color: '#10B981' });
    expect(updated.name).toBe('Q2 2025');
    expect(updated.color).toBe('#10B981');
  });

  it('should delete a roadmap', async () => {
    const list = await roadmapsService.list(projectId, {});
    const roadmap = list.find((r) => r.name === 'Q2 2025');
    if (roadmap) {
      const result = await roadmapsService.delete(projectId, roadmap.id);
      expect(result).toEqual({ success: true });
    }
    const remaining = await roadmapsService.list(projectId, {});
    expect(remaining.find((r) => r.id === roadmap?.id)).toBeUndefined();
  });

  it('should list roadmaps with search filter', async () => {
    await roadmapsService.create(projectId, {
      name: 'Sprint 1',
      startDate: '2025-06-01',
      endDate: '2025-06-14',
    });
    await roadmapsService.create(projectId, {
      name: 'Release 2.0',
      startDate: '2025-07-01',
      endDate: '2025-07-31',
    });
    const result = await roadmapsService.list(projectId, { search: 'sprint' });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Sprint 1');
  });
});
