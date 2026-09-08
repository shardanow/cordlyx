import { Injectable, BadRequestException } from '@nestjs/common';
import { getDb } from '../../database/client.js';
import { notificationPrefs } from '../../database/schema/notification-prefs.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const updatePrefsSchema = z.object({
  muted: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
});

export interface PrefsUpdate {
  muted?: boolean;
  emailDigest?: boolean;
  digestHour?: number;
}

@Injectable()
export class NotificationPrefsService {
  async getMine(userId: string) {
    const db = getDb();
    const rows = await db
      .select({
        projectId: notificationPrefs.projectId,
        projectSlug: projects.slug,
        projectName: projects.name,
        muted: notificationPrefs.muted,
        emailDigest: notificationPrefs.emailDigest,
        digestHour: notificationPrefs.digestHour,
        updatedAt: notificationPrefs.updatedAt,
      })
      .from(notificationPrefs)
      .innerJoin(projects, eq(notificationPrefs.projectId, projects.id))
      .where(eq(notificationPrefs.userId, userId));
    return rows;
  }

  async upsert(userId: string, projectId: string, data: PrefsUpdate) {
    if (data.digestHour !== undefined && (!Number.isInteger(data.digestHour) || data.digestHour < 0 || data.digestHour > 23)) {
      throw new BadRequestException('digestHour must be an integer 0-23');
    }
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.muted !== undefined) patch.muted = data.muted;
    if (data.emailDigest !== undefined) patch.emailDigest = data.emailDigest;
    if (data.digestHour !== undefined) patch.digestHour = data.digestHour;
    const [row] = await db
      .insert(notificationPrefs)
      .values({ userId, projectId, ...patch } as never)
      .onConflictDoUpdate({
        target: [notificationPrefs.userId, notificationPrefs.projectId],
        set: patch as never,
      })
      .returning();
    return row;
  }

  async isMuted(userId: string, projectId: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db
      .select({ muted: notificationPrefs.muted })
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.projectId, projectId)))
      .limit(1);
    return row?.muted ?? false;
  }

  /** Users due for an email digest at the given UTC hour (unmuted projects only). */
  async digestSubscribers(hour: number) {
    const db = getDb();
    return db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        projectId: projects.id,
        projectSlug: projects.slug,
        projectName: projects.name,
      })
      .from(notificationPrefs)
      .innerJoin(users, eq(notificationPrefs.userId, users.id))
      .innerJoin(projects, eq(notificationPrefs.projectId, projects.id))
      .where(
        and(
          eq(notificationPrefs.emailDigest, true),
          eq(notificationPrefs.digestHour, hour),
          eq(notificationPrefs.muted, false),
          eq(users.isActive, true),
        ),
      );
  }
}
