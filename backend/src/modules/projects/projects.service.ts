import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { issueSequences } from '../../database/schema/sequences.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class ProjectsService {
  async create(data: { name: string; slug: string; description?: string | null }, ownerId: string) {
    const db = getDb();

    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, data.slug))
      .limit(1);

    if (existing[0]) {
      throw new ConflictException('Project slug already taken');
    }

    const projectId = randomUUID();

    await db.insert(projects).values({
      id: projectId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      ownerId,
    });

    // Add owner as admin
    await db.insert(projectMembers).values({
      projectId,
      userId: ownerId,
      role: 'admin',
    });

    // Create issue sequence
    await db.insert(issueSequences).values({
      projectId,
      lastValue: 0,
    });

    // Seed default configs
    await this.seedDefaults(db, projectId);

    return this.getBySlug(data.slug);
  }

  async getBySlug(slug: string) {
    const db = getDb();
    const result = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    return result[0] ?? null;
  }

  async getById(id: string) {
    const db = getDb();
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0] ?? null;
  }

  async listForUser(userId: string) {
    const db = getDb();
    return db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        description: projects.description,
        ownerId: projects.ownerId,
        isArchived: projects.isArchived,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projectMembers.userId, userId), eq(projects.isArchived, false)))
      .orderBy(projects.createdAt);
  }

  async update(
    slug: string,
    data: { name?: string; slug?: string; description?: string | null; isArchived?: boolean; settings?: Record<string, unknown>; projectId: string },
  ) {
    const db = getDb();

    if (data.slug && data.slug !== slug) {
      const existing = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.slug, data.slug))
        .limit(1);
      if (existing[0]) {
        throw new ConflictException('Project slug already taken');
      }
    }

    const { projectId, ...updates } = data;
    await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return this.getBySlug(data.slug ?? slug);
  }

  async softDelete(slug: string) {
    const db = getDb();
    const project = await this.getBySlug(slug);
    if (!project) throw new NotFoundException('Project not found');
    await db
      .update(projects)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(projects.slug, slug));
    return { success: true };
  }

  private async seedDefaults(
    db: ReturnType<typeof getDb>,
    projectId: string,
  ) {
    // Default item types
    await db.insert(itemTypes).values([
      { projectId, name: 'Task', color: '#3B82F6', icon: 'check-square', isDefault: true, sortOrder: 1 },
      { projectId, name: 'Bug', color: '#EF4444', icon: 'bug', isDefault: true, sortOrder: 2 },
      { projectId, name: 'Feature', color: '#8B5CF6', icon: 'sparkles', isDefault: true, sortOrder: 3 },
      { projectId, name: 'Idea', color: '#F59E0B', icon: 'lightbulb', isDefault: true, sortOrder: 4 },
      { projectId, name: 'Improvement', color: '#10B981', icon: 'trending-up', isDefault: true, sortOrder: 5 },
      { projectId, name: 'Epic', color: '#8B5CF6', icon: 'layers', isDefault: true, sortOrder: 6 },
      { projectId, name: 'Note', color: '#06B6D4', icon: 'file-text', isDefault: true, sortOrder: 7 },
      { projectId, name: 'Decision', color: '#F59E0B', icon: 'scale', isDefault: true, sortOrder: 8 },
      { projectId, name: 'Research', color: '#10B981', icon: 'search', isDefault: true, sortOrder: 9 },
      { projectId, name: 'Document', color: '#6366F1', icon: 'file', isDefault: true, sortOrder: 10 },
    ]);

    // Default statuses
    await db.insert(itemStatuses).values([
      { projectId, name: 'Inbox', color: '#6366F1', category: 'inbox', isDefault: true, sortOrder: 0 },
      { projectId, name: 'Backlog', color: '#6B7280', category: 'backlog', isDefault: true, sortOrder: 1 },
      { projectId, name: 'To Do', color: '#3B82F6', category: 'todo', isDefault: true, sortOrder: 2 },
      { projectId, name: 'In Progress', color: '#F59E0B', category: 'active', isDefault: true, sortOrder: 3 },
      { projectId, name: 'In Review', color: '#8B5CF6', category: 'active', isDefault: true, sortOrder: 4 },
      { projectId, name: 'Done', color: '#10B981', category: 'done', isDefault: true, sortOrder: 5 },
      { projectId, name: 'Cancelled', color: '#EF4444', category: 'cancelled', isDefault: true, sortOrder: 6 },
    ]);

    // Default priorities (only Medium is default for auto-assignment)
    await db.insert(itemPriorities).values([
      { projectId, name: 'Critical', color: '#EF4444', icon: 'arrow-up', isDefault: false, sortOrder: 1 },
      { projectId, name: 'High', color: '#F97316', icon: 'chevron-up', isDefault: false, sortOrder: 2 },
      { projectId, name: 'Medium', color: '#F59E0B', icon: 'minus', isDefault: true, sortOrder: 3 },
      { projectId, name: 'Low', color: '#6B7280', icon: 'chevron-down', isDefault: false, sortOrder: 4 },
    ]);
  }
}
