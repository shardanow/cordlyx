import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { notifications } from '../../database/schema/notifications.js';
import { users } from '../../database/schema/users.js';
import { projectMembers } from '../../database/schema/members.js';
import { eq, and, isNull, desc, lt } from 'drizzle-orm';

export interface CreateNotificationDto {
  userId: string;
  actorId: string;
  projectId: string;
  itemId?: string | null;
  type: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  async create(dto: CreateNotificationDto) {
    if (dto.userId === dto.actorId) return null; // Don't notify yourself
    const db = getDb();
    const [row] = await db
      .insert(notifications)
      .values({
        userId: dto.userId,
        actorId: dto.actorId,
        projectId: dto.projectId,
        itemId: dto.itemId ?? null,
        type: dto.type,
        data: dto.data ?? {},
      })
      .returning();
    return row;
  }

  async getUnread(userId: string, limit = 50) {
    const db = getDb();
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        projectId: notifications.projectId,
        itemId: notifications.itemId,
        data: notifications.data,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actor: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows;
  }

  async getAll(userId: string, cursor?: string, limit = 50) {
    const db = getDb();
    const conditions = [eq(notifications.userId, userId)] as any[];
    if (cursor) {
      const [cursorDate] = Buffer.from(cursor, 'base64').toString('utf-8').split('|');
      conditions.push(lt(notifications.createdAt, new Date(cursorDate!)));
    }
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        projectId: notifications.projectId,
        itemId: notifications.itemId,
        data: notifications.data,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actor: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    const nextCursor = last
      ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64')
      : null;
    return { data, meta: { cursor: nextCursor, hasMore, limit } };
  }

  async markRead(userId: string, notificationId: string) {
    const db = getDb();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
    return { success: true };
  }

  async markAllRead(userId: string) {
    const db = getDb();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { success: true };
  }

  async unreadCount(userId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return rows.length;
  }

  /** Find project member user IDs whose name matches the mention (case-insensitive) */
  async findMembersByMention(projectId: string, mention: string): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ userId: projectMembers.userId, name: users.name })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));

    const lowerMention = mention.toLowerCase();
    return rows
      .filter((r) => r.name.toLowerCase().replace(/\s+/g, '') === lowerMention ||
                     r.name.toLowerCase().startsWith(lowerMention))
      .map((r) => r.userId);
  }
}
