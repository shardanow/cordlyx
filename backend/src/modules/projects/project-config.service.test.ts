import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ProjectConfigService } from './project-config.service.js';
import { ProjectsService } from './projects.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('ProjectConfigService', () => {
  let configService: ProjectConfigService;
  let projectsService: ProjectsService;
  let projectId: string;

  beforeAll(async () => {
    configService = new ProjectConfigService({ get: async () => null, set: async () => {}, del: async () => {}, delPattern: async () => {} } as any);
    projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'config-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Config Test',
    });

    const project = await projectsService.create(
      { name: 'Config Test Project', slug: 'config-test-proj' },
      userId,
    );
    projectId = project!.id;
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  describe('types', () => {
    it('should list default types', async () => {
      const types = await configService.getTypes(projectId);
      expect(types.length).toBeGreaterThanOrEqual(4);
      expect(types.some((t) => t.name === 'Task')).toBe(true);
    });

    it('should create a custom type', async () => {
      const type = await configService.createType(projectId, {
        name: 'Spike', color: '#FF0000', icon: 'star',
      });
      expect(type!.name).toBe('Spike');
      expect(type!.color).toBe('#FF0000');
    });

    it('should update a type', async () => {
      const types = await configService.getTypes(projectId);
      const type = types.find((t) => t.name === 'Spike')!;
      const updated = await configService.updateType(type.id, { name: 'Spike Updated' });
      expect(updated!.name).toBe('Spike Updated');
    });

    it('should delete a type', async () => {
      const types = await configService.getTypes(projectId);
      const type = types.find((t) => t.name === 'Spike Updated')!;
      await configService.deleteType(type.id);
      const remaining = await configService.getTypes(projectId);
      expect(remaining.some((t) => t.id === type.id)).toBe(false);
    });
  });

  describe('statuses', () => {
    it('should list default statuses', async () => {
      const statuses = await configService.getStatuses(projectId);
      expect(statuses.length).toBeGreaterThanOrEqual(4);
      expect(statuses.some((s) => s.name === 'To Do')).toBe(true);
    });

    it('should create a custom status', async () => {
      const status = await configService.createStatus(projectId, {
        name: 'Needs Review', color: '#00FF00', category: 'active',
      });
      expect(status!.name).toBe('Needs Review');
    });

    it('should update a status', async () => {
      const statuses = await configService.getStatuses(projectId);
      const status = statuses.find((s) => s.name === 'Needs Review')!;
      const updated = await configService.updateStatus(status.id, { name: 'Awaiting Review' });
      expect(updated!.name).toBe('Awaiting Review');
    });

    it('should delete a status', async () => {
      const statuses = await configService.getStatuses(projectId);
      const status = statuses.find((s) => s.name === 'Awaiting Review')!;
      await configService.deleteStatus(status.id);
      const remaining = await configService.getStatuses(projectId);
      expect(remaining.some((s) => s.id === status.id)).toBe(false);
    });
  });

  describe('priorities', () => {
    it('should list default priorities', async () => {
      const priorities = await configService.getPriorities(projectId);
      expect(priorities.length).toBeGreaterThanOrEqual(3);
      expect(priorities.some((p) => p.name === 'Medium')).toBe(true);
    });

    it('should create a custom priority', async () => {
      const priority = await configService.createPriority(projectId, {
        name: 'Urgent', color: '#FF0000', icon: 'alert',
      });
      expect(priority!.name).toBe('Urgent');
    });

    it('should update a priority', async () => {
      const priorities = await configService.getPriorities(projectId);
      const priority = priorities.find((p) => p.name === 'Urgent')!;
      const updated = await configService.updatePriority(priority.id, { name: 'Super Urgent' });
      expect(updated!.name).toBe('Super Urgent');
    });

    it('should delete a priority', async () => {
      const priorities = await configService.getPriorities(projectId);
      const priority = priorities.find((p) => p.name === 'Super Urgent')!;
      await configService.deletePriority(priority.id);
      const remaining = await configService.getPriorities(projectId);
      expect(remaining.some((p) => p.id === priority.id)).toBe(false);
    });
  });
});
