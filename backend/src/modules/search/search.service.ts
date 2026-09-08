import { Injectable, ForbiddenException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { decodeCursorDate } from '../../common/cursors.js';
import { items } from '../../database/schema/items.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { eq, and, sql, isNull, desc, inArray } from 'drizzle-orm';

@Injectable()
export class SearchService {
  async search(
    query: string,
    userId: string,
    projectId?: string,
    options?: { cursor?: string; limit?: number },
  ) {
    const db = getDb();
    const limit = Math.min(options?.limit ?? 50, 100);

    // Scope: explicit project must be joined by the user, otherwise only member projects.
    const memberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const allowed = memberships.map((m) => m.projectId);
    if (projectId) {
      if (!allowed.includes(projectId)) {
        throw new ForbiddenException('You are not a member of this project');
      }
    } else if (allowed.length === 0) {
      return { data: [], meta: { cursor: null, hasMore: false, limit } };
    }

    const conditions = [isNull(items.deletedAt)] as any[];

    if (projectId) {
      conditions.push(eq(items.projectId, projectId));
    } else {
      conditions.push(inArray(items.projectId, allowed));
    }

    if (options?.cursor) {
      const { date: cursorDate, id: cursorId } = decodeCursorDate(options.cursor);
      // Proper keyset pagination: (date < cursorDate) OR (date = cursorDate AND id < cursorId)
      conditions.push(
        cursorId
          ? sql`(${items.createdAt} < ${cursorDate}::timestamptz OR (${items.createdAt} = ${cursorDate}::timestamptz AND ${items.id} < ${cursorId}))`
          : sql`${items.createdAt} < ${cursorDate}::timestamptz`,
      );
    }

    const result = await db
      .select({
        id: items.id,
        projectId: items.projectId,
        sequenceNum: items.sequenceNum,
        title: items.title,
        createdAt: items.createdAt,
        projectSlug: projects.slug,
        projectName: projects.name,
      })
      .from(items)
      .innerJoin(projects, eq(items.projectId, projects.id))
      .where(
        and(
          ...conditions,
          sql`search_vector @@ plainto_tsquery('english', ${query})`,
        ),
      )
      .orderBy(desc(items.createdAt), desc(items.id))
      .limit(limit + 1);

    const hasMore = result.length > limit;
    const data = result.slice(0, limit);
    const lastItem = data[data.length - 1];
    const cursor = lastItem
      ? Buffer.from(`${lastItem.createdAt.toISOString()}|${lastItem.id}`).toString('base64')
      : null;

    return { data, meta: { cursor, hasMore, limit } };
  }
}
