import { Injectable } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { items } from '../../database/schema/items.js';
import { projects } from '../../database/schema/projects.js';
import { eq, and, sql, isNull, desc } from 'drizzle-orm';

@Injectable()
export class SearchService {
  async search(
    query: string,
    projectId?: string,
    options?: { cursor?: string; limit?: number },
  ) {
    const db = getDb();
    const limit = Math.min(options?.limit ?? 50, 100);

    const conditions = [isNull(items.deletedAt)] as any[];

    if (projectId) {
      conditions.push(eq(items.projectId, projectId));
    }

    if (options?.cursor) {
      const decoded = Buffer.from(options.cursor, 'base64').toString('utf-8');
      const [cursorDate, cursorId] = decoded.split('|');
      // Proper keyset pagination: (date < cursorDate) OR (date = cursorDate AND id < cursorId)
      conditions.push(
        sql`(${items.createdAt} < ${cursorDate}::timestamptz OR (${items.createdAt} = ${cursorDate}::timestamptz AND ${items.id} < ${cursorId}))`,
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
