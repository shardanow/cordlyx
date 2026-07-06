import { Injectable } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { activities } from '../../database/schema/activities.js';
import { items as itemsTable } from '../../database/schema/items.js';
import { users } from '../../database/schema/users.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

@Injectable()
export class ActivitiesService {
  async getByProject(
    projectId: string,
    cursor?: string,
    limit = 50,
    action?: string,
    dateFrom?: string,
    dateTo?: string,
    sort: 'created_at' | '-created_at' = '-created_at',
  ) {
    const db = getDb();
    const conditions: ReturnType<typeof eq>[] = [eq(activities.projectId, projectId)];

    if (action) conditions.push(eq(activities.action, action));
    if (dateFrom) conditions.push(sql`${activities.createdAt} >= ${dateFrom}::timestamptz`);
    if (dateTo) conditions.push(sql`${activities.createdAt} < ${dateTo}::timestamptz + interval '1 day'`);

    if (cursor) {
      const [cursorDate] = Buffer.from(cursor, 'base64').toString('utf-8').split('|');
      conditions.push(
        sort === '-created_at'
          ? sql`${activities.createdAt} < ${cursorDate}::timestamptz`
          : sql`${activities.createdAt} > ${cursorDate}::timestamptz`,
      );
    }

    const actualLimit = Math.min(limit, 100);
    const orderBy = sort === '-created_at' ? desc(activities.createdAt) : asc(activities.createdAt);
    const result = await db
      .select({
        id: activities.id,
        projectId: activities.projectId,
        actorId: activities.actorId,
        itemId: activities.itemId,
        action: activities.action,
        fieldName: activities.fieldName,
        oldValue: activities.oldValue,
        newValue: activities.newValue,
        metadata: activities.metadata,
        createdAt: activities.createdAt,
        itemTitle: itemsTable.title,
        itemSequenceNum: itemsTable.sequenceNum,
        actor: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .leftJoin(itemsTable, eq(activities.itemId, itemsTable.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(actualLimit + 1);

    const hasMore = result.length > actualLimit;
    const data = result.slice(0, actualLimit);
    const lastItem = data[data.length - 1];
    const nextCursor = lastItem
      ? Buffer.from(`${lastItem.createdAt.toISOString()}|${lastItem.id}`).toString('base64')
      : null;

    return { data, meta: { cursor: nextCursor, hasMore, limit: actualLimit } };
  }

  async getByItem(itemId: string, cursor?: string, limit = 50) {
    const db = getDb();
    const conditions: ReturnType<typeof eq>[] = [eq(activities.itemId, itemId)];

    if (cursor) {
      const [cursorDate] = Buffer.from(cursor, 'base64').toString('utf-8').split('|');
      conditions.push(sql`${activities.createdAt} < ${cursorDate}::timestamptz`);
    }

    const actualLimit = Math.min(limit, 100);
    const result = await db
      .select({
        id: activities.id,
        projectId: activities.projectId,
        actorId: activities.actorId,
        itemId: activities.itemId,
        action: activities.action,
        fieldName: activities.fieldName,
        oldValue: activities.oldValue,
        newValue: activities.newValue,
        metadata: activities.metadata,
        createdAt: activities.createdAt,
        itemTitle: itemsTable.title,
        itemSequenceNum: itemsTable.sequenceNum,
        actor: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .leftJoin(itemsTable, eq(activities.itemId, itemsTable.id))
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt))
      .limit(actualLimit + 1);

    const hasMore = result.length > actualLimit;
    const data = result.slice(0, actualLimit);
    const lastItem = data[data.length - 1];
    const nextCursor = lastItem
      ? Buffer.from(`${lastItem.createdAt.toISOString()}|${lastItem.id}`).toString('base64')
      : null;

    return { data, meta: { cursor: nextCursor, hasMore, limit: actualLimit } };
  }
}
