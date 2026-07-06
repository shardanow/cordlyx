import { Injectable, NotFoundException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { items } from '../../database/schema/items.js';
import { activities } from '../../database/schema/activities.js';
import { projectMembers } from '../../database/schema/members.js';
import { eq, and, isNull, desc, sql, count } from 'drizzle-orm';

@Injectable()
export class AdminService {
  async isAdmin(userId: string, email: string): Promise<boolean> {
    // ADMIN_EMAILS env takes priority
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0 && adminEmails.includes(email.toLowerCase())) {
      return true;
    }
    // Fall back to DB isAdmin flag
    const db = getDb();
    const result = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
    return result[0]?.isAdmin ?? false;
  }

  async listUsers() {
    const db = getDb();
    return db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.createdAt);
  }

  async makeAdmin(userId: string) {
    const db = getDb();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing[0]) throw new NotFoundException('User not found');
    await db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async listProjects() {
    const db = getDb();
    return db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        ownerId: projects.ownerId,
        isArchived: projects.isArchived,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .orderBy(projects.createdAt);
  }

  async archiveProject(projectId: string) {
    const db = getDb();
    const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!existing[0]) throw new NotFoundException('Project not found');
    await db.update(projects).set({ isArchived: true, updatedAt: new Date() }).where(eq(projects.id, projectId));
  }

  async deleteProject(projectId: string) {
    const db = getDb();
    const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!existing[0]) throw new NotFoundException('Project not found');
    await db.delete(projects).where(eq(projects.id, projectId));
  }

  async deactivateUser(userId: string) {
    const db = getDb();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing[0]) throw new NotFoundException('User not found');
    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async getStats() {
    const db = getDb();
    const [userCount] = await db.select({ value: count() }).from(users);
    const [projectCount] = await db.select({ value: count() }).from(projects);
    const [activeProjectCount] = await db.select({ value: count() }).from(projects).where(eq(projects.isArchived, false));
    const [itemCount] = await db.select({ value: count() }).from(items).where(isNull(items.deletedAt));
    return {
      totalUsers: Number(userCount?.value ?? 0),
      totalProjects: Number(projectCount?.value ?? 0),
      totalActiveProjects: Number(activeProjectCount?.value ?? 0),
      totalItems: Number(itemCount?.value ?? 0),
    };
  }

  async updateMemberRole(projectId: string, memberId: string, role: string) {
    const db = getDb();
    const existing = await db
      .select({ id: projectMembers.id, role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
      .limit(1);
    if (!existing[0]) throw new NotFoundException('Member not found');

    // Prevent removing last admin
    if (existing[0].role === 'admin' && role !== 'admin') {
      const adminCount = await db
        .select({ value: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role as any, 'admin')));
      if (Number(adminCount[0]?.value ?? 0) <= 1) {
        throw new NotFoundException('Cannot remove the last admin');
      }
    }

    await db.update(projectMembers).set({ role: role as any }).where(eq(projectMembers.id, memberId));
    return { success: true };
  }

  async getMembersForProject(projectId: string) {
    const db = getDb();
    return db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        name: users.name,
        email: users.email,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId));
  }

  async getGlobalActivity(cursor?: string, limit = 50) {
    const db = getDb();
    const conditions: any[] = [];
    if (cursor) {
      const [cursorDate] = Buffer.from(cursor, 'base64').toString('utf-8').split('|');
      conditions.push(sql`${activities.createdAt} < ${cursorDate}::timestamptz`);
    }
    const rows = await db
      .select({
        id: activities.id,
        action: activities.action,
        fieldName: activities.fieldName,
        oldValue: activities.oldValue,
        newValue: activities.newValue,
        createdAt: activities.createdAt,
        actor: { id: users.id, name: users.name, email: users.email },
        projectName: projects.name,
        projectSlug: projects.slug,
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .leftJoin(projects, eq(activities.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    const nextCursor = last
      ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64')
      : null;
    return { data, meta: { cursor: nextCursor, hasMore, limit } };
  }
}
