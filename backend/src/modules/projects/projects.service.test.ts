import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { issueSequences } from '../../database/schema/sequences.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { eq, sql } from 'drizzle-orm';
import { ProjectsService } from './projects.service.js';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

// Helper to create a test user
async function createTestUser(email = 'proj-test@test.com') {
  const db = getDb();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await bcrypt.hash('password123', 12),
    name: 'Project Test',
  });
  return { id, email };
}

describe('ProjectsService', () => {
  let projectsService: ProjectsService;
  let testUser: { id: string; email: string };

  beforeAll(async () => {
    projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    testUser = await createTestUser();
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  describe('create', () => {
    it('should create a project with defaults', async () => {
      const project = await projectsService.create(
        { name: 'Test Project', slug: 'test-proj' },
        testUser.id,
      );

      expect(project).not.toBeNull();
      expect(project!.name).toBe('Test Project');
      expect(project!.slug).toBe('test-proj');
      expect(project!.ownerId).toBe(testUser.id);
    });

    it('should reject duplicate slug', async () => {
      await expect(
        projectsService.create({ name: 'Another', slug: 'test-proj' }, testUser.id),
      ).rejects.toThrow('Project slug already taken');
    });

    it('should seed default configs', async () => {
      const project = await projectsService.create(
        { name: 'Config Test', slug: 'config-test' },
        testUser.id,
      );

      const db = getDb();
      const types = await db.select().from(itemTypes).where(eq(itemTypes.projectId, project!.id));
      const statuses = await db.select().from(itemStatuses).where(eq(itemStatuses.projectId, project!.id));
      const priorities = await db.select().from(itemPriorities).where(eq(itemPriorities.projectId, project!.id));

      expect(types.length).toBeGreaterThanOrEqual(4); // Task, Bug, Feature, Idea
      expect(statuses.length).toBeGreaterThanOrEqual(4); // Backlog, Todo, In Progress, Done
      expect(priorities.length).toBeGreaterThanOrEqual(3); // Critical, Medium, Low
    });
  });

  describe('listForUser', () => {
    it('should list projects for member', async () => {
      const userProjects = await projectsService.listForUser(testUser.id);
      expect(userProjects.length).toBeGreaterThanOrEqual(1);
      expect(userProjects.some((p) => p.slug === 'test-proj')).toBe(true);
    });

    it('should not list projects for non-member', async () => {
      const otherUser = await createTestUser('other@test.com');
      const projects = await projectsService.listForUser(otherUser.id);
      expect(projects.some((p) => p.slug === 'test-proj')).toBe(false);
    });
  });

  describe('getBySlug', () => {
    it('should find project by slug', async () => {
      const project = await projectsService.getBySlug('test-proj');
      expect(project).not.toBeNull();
      expect(project!.name).toBe('Test Project');
    });

    it('should return null for missing slug', async () => {
      const project = await projectsService.getBySlug('non-existent');
      expect(project).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft-delete a project by setting isArchived', async () => {
      const project = await projectsService.create(
        { name: 'Delete Me', slug: 'delete-me' },
        testUser.id,
      );
      expect(project).not.toBeNull();

      const result = await projectsService.softDelete('delete-me');
      expect(result).toEqual({ success: true });

      // Verify it's archived
      const db = getDb();
      const [archived] = await db
        .select()
        .from(projects)
        .where(eq(projects.slug, 'delete-me'))
        .limit(1);
      expect(archived!.isArchived).toBe(true);

      // Verify it no longer appears in listForUser
      const userProjects = await projectsService.listForUser(testUser.id);
      expect(userProjects.some((p) => p.slug === 'delete-me')).toBe(false);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      await expect(
        projectsService.softDelete('non-existent-slug'),
      ).rejects.toThrow('Project not found');
    });
  });
});
