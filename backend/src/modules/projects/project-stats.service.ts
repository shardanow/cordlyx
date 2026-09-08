import { Injectable } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { items } from '../../database/schema/items.js';
import { itemTypes, itemStatuses } from '../../database/schema/config.js';
import { users } from '../../database/schema/users.js';
import { projectMembers } from '../../database/schema/members.js';
import { eq, and, isNull, sql } from 'drizzle-orm';

const DONE_CATEGORIES = ['done', 'cancelled'];
const OVERDUE_SAMPLE = 8;
const WORKLOAD_LIMIT = 20;

export interface ProjectStats {
  total: number;
  open: number;
  done: number;
  doneRecently7d: number;
  overdue: {
    count: number;
    items: { id: string; sequenceNum: number; title: string; dueDate: string | null; assigneeName: string | null }[];
  };
  byStatus: { statusId: string; name: string; color: string; category: string; count: number }[];
  byAssignee: { userId: string; name: string; avatarUrl: string | null; open: number; total: number }[];
  byType: { typeId: string; name: string; color: string; count: number }[];
}

@Injectable()
export class ProjectStatsService {
  async getStats(projectId: string): Promise<ProjectStats> {
    const db = getDb();
    const alive = and(eq(items.projectId, projectId), isNull(items.deletedAt));

    const [statuses, types, members] = await Promise.all([
      db.select().from(itemStatuses).where(eq(itemStatuses.projectId, projectId)).orderBy(itemStatuses.sortOrder),
      db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)).orderBy(itemTypes.sortOrder),
      db
        .select({ userId: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, projectId)),
    ]);

    const doneStatusIds = new Set(statuses.filter((s) => DONE_CATEGORIES.includes(s.category)).map((s) => s.id));
    const isOpen = (statusId: string) => !doneStatusIds.has(statusId);

    const [itemRows, doneRecent] = await Promise.all([
      db
        .select({
          id: items.id,
          sequenceNum: items.sequenceNum,
          title: items.title,
          statusId: items.statusId,
          typeId: items.typeId,
          assigneeId: items.assigneeId,
          assigneeName: users.name,
          dueDate: items.dueDate,
          createdAt: items.createdAt,
        })
        .from(items)
        .leftJoin(users, eq(items.assigneeId, users.id))
        .where(alive),
      db
        .select({ value: sql<number>`count(*)` })
        .from(items)
        .where(
          and(
            alive,
            sql`${items.updatedAt} > now() - interval '7 days'`,
            statuses.length > 0
              ? sql`${items.statusId} IN (${sql.join(
                  [...doneStatusIds].map((id) => sql`${id}::uuid`),
                  sql`, `,
                )})`
              : sql`false`,
          ),
        ),
    ]);

    const byStatus = statuses.map((s) => ({
      statusId: s.id,
      name: s.name,
      color: s.color,
      category: s.category,
      count: itemRows.filter((i) => i.statusId === s.id).length,
    }));
    const byType = types.map((t) => ({
      typeId: t.id,
      name: t.name,
      color: t.color,
      count: itemRows.filter((i) => i.typeId === t.id).length,
    }));

    const now = new Date();
    const openRows = itemRows.filter((i) => isOpen(i.statusId));
    const overdueRows = openRows
      .filter((i) => i.dueDate && new Date(i.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const memberById = new Map(members.map((m) => [m.userId, m]));
    const byAssignee = [...memberById.values()]
      .map((m) => {
        const mine = itemRows.filter((i) => i.assigneeId === m.userId);
        return {
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          open: mine.filter((i) => isOpen(i.statusId)).length,
          total: mine.length,
        };
      })
      .filter((a) => a.total > 0)
      .sort((a, b) => b.open - a.open || b.total - a.total)
      .slice(0, WORKLOAD_LIMIT);

    return {
      total: itemRows.length,
      open: openRows.length,
      done: itemRows.length - openRows.length,
      doneRecently7d: Number(doneRecent[0]?.value ?? 0),
      overdue: {
        count: overdueRows.length,
        items: overdueRows.slice(0, OVERDUE_SAMPLE).map((i) => ({
          id: i.id,
          sequenceNum: Number(i.sequenceNum),
          title: i.title,
          dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : null,
          assigneeName: i.assigneeName,
        })),
      },
      byStatus,
      byAssignee,
      byType,
    };
  }
}
