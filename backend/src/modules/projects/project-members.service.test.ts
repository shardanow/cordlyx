import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ProjectMembersService } from './project-members.service.js';
import { ProjectsService } from './projects.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('ProjectMembersService', () => {
  let membersService: ProjectMembersService;
  let projectsService: ProjectsService;
  let projectId: string;
  let ownerId: string;
  let otherUserId: string;

  beforeAll(async () => {
    membersService = new ProjectMembersService({ get: async () => null, set: async () => {}, del: async () => {}, delPattern: async () => {} } as any);
    projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    // Create owner
    ownerId = randomUUID();
    await db.insert(users).values({
      id: ownerId,
      email: 'owner@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Owner',
    });

    // Create another user for member management
    otherUserId = randomUUID();
    await db.insert(users).values({
      id: otherUserId,
      email: 'member@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Member',
    });

    const project = await projectsService.create(
      { name: 'Members Test', slug: 'members-test' },
      ownerId,
    );
    projectId = project!.id;
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  describe('getMembers', () => {
    it('should list owner as admin member', async () => {
      const members = await membersService.getMembers(projectId);
      expect(members.length).toBe(1);
      expect(members[0]!.email).toBe('owner@test.com');
      expect(members[0]!.role).toBe('admin');
    });
  });

  describe('addMember', () => {
    it('should add a new member', async () => {
      const members = await membersService.addMember(projectId, { userId: otherUserId, email: 'member@test.com' }, 'member');
      expect(members.length).toBe(2);
      expect(members.some((m) => m.email === 'member@test.com' && m.role === 'member')).toBe(true);
    });

    it('should throw when adding non-existent user', async () => {
      await expect(
        membersService.addMember(projectId, { userId: randomUUID(), email: 'nobody@test.com' }, 'member'),
      ).rejects.toThrow('User not found');
    });

    it('should throw when adding duplicate member', async () => {
      await expect(
        membersService.addMember(projectId, { userId: otherUserId, email: 'member@test.com' }, 'viewer'),
      ).rejects.toThrow('User is already a member');
    });
  });

  describe('updateMember', () => {
    it('should change member role', async () => {
      const members = await membersService.getMembers(projectId);
      const member = members.find((m) => m.email === 'member@test.com')!;
      const updated = await membersService.updateMember(projectId, member.id, 'viewer');
      const updatedMember = updated.find((m) => m.id === member.id);
      expect(updatedMember!.role).toBe('viewer');
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      const members = await membersService.getMembers(projectId);
      const member = members.find((m) => m.email === 'member@test.com')!;
      const remaining = await membersService.removeMember(projectId, member.id);
      expect(remaining.some((m) => m.id === member.id)).toBe(false);
      expect(remaining.length).toBe(1); // only owner left
    });
  });
});
