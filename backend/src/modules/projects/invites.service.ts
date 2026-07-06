import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { invites } from '../../database/schema/invites.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class InvitesService {
  async create(projectId: string, createdById: string, role: string = 'member') {
    const db = getDb();
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(invites).values({
      projectId,
      token,
      createdById,
      role,
      expiresAt,
    });

    return { token, expiresAt };
  }

  async getInfo(token: string) {
    const db = getDb();
    const invite = await db
      .select({
        id: invites.id,
        projectId: invites.projectId,
        role: invites.role,
        expiresAt: invites.expiresAt,
        usedAt: invites.usedAt,
        projectName: projects.name,
        projectSlug: projects.slug,
      })
      .from(invites)
      .innerJoin(projects, eq(invites.projectId, projects.id))
      .where(eq(invites.token, token))
      .limit(1);

    if (!invite[0]) throw new NotFoundException('Invite not found');
    if (invite[0].usedAt) throw new BadRequestException('Invite already used');
    if (new Date() > new Date(invite[0].expiresAt)) throw new BadRequestException('Invite expired');

    return invite[0];
  }

  async accept(token: string, userId: string) {
    const db = getDb();
    const invite = await this.getInfo(token);

    // Check if already a member
    const existing = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, invite.projectId), eq(projectMembers.userId, userId)))
      .limit(1);

    if (existing[0]) throw new BadRequestException('Already a member of this project');

    // Add as member
    const memberId = randomUUID();
    await db.insert(projectMembers).values({
      id: memberId,
      projectId: invite.projectId,
      userId,
      role: invite.role as 'admin' | 'member' | 'viewer',
    });

    // Mark invite as used
    await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));

    return { projectId: invite.projectId, projectName: invite.projectName, projectSlug: invite.projectSlug };
  }
}
