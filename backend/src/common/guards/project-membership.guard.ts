import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { projectMembers } from '../../database/schema/members.js';
import { projects } from '../../database/schema/projects.js';
import { CacheService } from '../../cache/cache.service.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class ProjectMembershipGuard implements CanActivate {
  constructor(private readonly cache: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const projectSlug = request.params.projectSlug ?? request.params.projectId;
    if (!projectSlug) {
      return true; // no project context
    }

    const cacheKey = `membership:${projectSlug}:${user.id}`;
    const cached = await this.cache.get<{ projectId: string; role: string }>(cacheKey);
    if (cached) {
      request.projectId = cached.projectId;
      request.projectRole = cached.role;
      return true;
    }

    const db = getDb();

    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, projectSlug))
      .limit(1);

    if (!project[0]) {
      throw new ForbiddenException('Project not found');
    }

    const membership = await db
      .select({ id: projectMembers.id, role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project[0].id),
          eq(projectMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!membership[0]) {
      throw new ForbiddenException('You are not a member of this project');
    }

    request.projectId = project[0].id;
    request.projectRole = membership[0].role;

    // Cache both by slug (for fast lookup) and projectId (for targeted invalidation)
    const value = { projectId: project[0].id, role: membership[0].role };
    await Promise.all([
      this.cache.set(cacheKey, value, 1800),
      this.cache.set(`membership:id:${project[0].id}:${user.id}`, membership[0].role, 1800),
    ]);

    return true;
  }
}
