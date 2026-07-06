import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ProjectMembershipGuard } from './project-membership.guard.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

function createMockContext(userId: string | undefined, projectSlug?: string) {
  const request: any = { user: userId ? { id: userId } : undefined, params: {} };
  if (projectSlug) {
    request.params.projectSlug = projectSlug;
  }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('ProjectMembershipGuard', () => {
  let guard: ProjectMembershipGuard;
  let userId: string;
  let projectId: string;
  let slug: string;

  beforeAll(async () => {
    guard = new ProjectMembershipGuard({ get: async () => null, set: async () => {}, del: async () => {}, delPattern: async () => {} } as any);
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'membership-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Membership Test',
    });

    slug = 'membership-test-project';
    projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Membership Test Project',
      slug,
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });

    await db.insert(itemTypes).values({
      id: randomUUID(),
      projectId,
      name: 'Task',
      color: '#3B82F6',
      isDefault: true,
      sortOrder: '0',
    });
    await db.insert(itemStatuses).values({
      id: randomUUID(),
      projectId,
      name: 'Todo',
      color: '#6B7280',
      category: 'todo',
      isDefault: true,
      sortOrder: '0',
    });
    await db.insert(itemPriorities).values({
      id: randomUUID(),
      projectId,
      name: 'Medium',
      color: '#F59E0B',
      isDefault: true,
      sortOrder: '0',
    });

    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId,
      userId,
      role: 'member',
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should allow member access and set projectId and projectRole', async () => {
    const ctx = createMockContext(userId, slug);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.projectId).toBe(projectId);
    expect(req.projectRole).toBe('member');
  });

  it('should throw ForbiddenException when user is not a member', async () => {
    const otherUserId = randomUUID();
    const ctx = createMockContext(otherUserId, slug);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when project does not exist', async () => {
    const ctx = createMockContext(userId, 'nonexistent-project');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not authenticated', async () => {
    const ctx = createMockContext(undefined, slug);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Not authenticated');
  });

  it('should return true when no project context (no slug)', async () => {
    const ctx = createMockContext(userId);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
