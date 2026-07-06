import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { projectMembers } from '../../database/schema/members.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { CacheService } from '../../cache/cache.service.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class ProjectMembersService {
  constructor(private readonly cache: CacheService) {}

  private async invalidateMembershipCache(projectId: string, userId?: string) {
    if (userId) {
      await this.cache.delPattern(`membership:*:${userId}`);
      await this.cache.del(`membership:id:${projectId}:${userId}`);
    } else {
      await this.cache.delPattern(`membership:id:${projectId}:*`);
    }
  }
  async getMembers(projectId: string) {
    const db = getDb();
    return db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId));
  }

  async addMember(projectId: string, params: { userId?: string; email?: string }, role: 'admin' | 'member' | 'viewer') {
    const db = getDb();

    let userId: string | undefined = params.userId;

    if (params.email) {
      const user = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, params.email))
        .limit(1);
      if (!user[0]) throw new NotFoundException('User not found with this email');
      userId = user[0].id;
    }

    if (!userId) {
      throw new NotFoundException('User not found');
    }

    const existing = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
      )
      .limit(1);

    if (existing[0]) {
      throw new ConflictException('User is already a member of this project');
    }

    await db.insert(projectMembers).values({
      projectId,
      userId,
      role,
    });

    await this.invalidateMembershipCache(projectId, userId);
    return this.getMembers(projectId);
  }

  async updateMember(projectId: string, memberId: string, role: 'admin' | 'member' | 'viewer') {
    const db = getDb();
    const [existing] = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
      .limit(1);
    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)));
    if (existing) await this.invalidateMembershipCache(projectId, existing.userId);
    return this.getMembers(projectId);
  }

  async removeMember(projectId: string, memberId: string) {
    const db = getDb();
    const [existing] = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
      .limit(1);
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)));
    if (existing) await this.invalidateMembershipCache(projectId, existing.userId);
    return this.getMembers(projectId);
  }
}
