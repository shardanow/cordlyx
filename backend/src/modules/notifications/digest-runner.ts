import { NotificationsService } from './notifications.service.js';
import { NotificationPrefsService } from './notification-prefs.service.js';
import { MailerService, type DigestItem } from './mailer.service.js';

export interface DigestDeps {
  prefs?: NotificationPrefsService;
  notifications?: NotificationsService;
  mailer?: Pick<MailerService, 'isConfigured' | 'sendDigest'>;
}

export interface DigestResult {
  configured: boolean;
  users: number;
  sent: number;
  skipped: number;
}

export interface UnreadRow {
  type: string;
  actor?: { name?: string | null } | null;
  data?: unknown;
  createdAt: Date | string;
}

/** Normalize unread rows into digest items (shared by runner and manual send). */
export function toDigestItems(unread: UnreadRow[]): DigestItem[] {
  return unread.map((n) => {
    const data = (typeof n.data === 'object' && n.data !== null ? n.data : {}) as Record<string, unknown>;
    return {
      type: n.type,
      actorName: n.actor?.name ?? null,
      itemTitle: data.itemTitle != null ? String(data.itemTitle) : null,
      itemSequenceNum: typeof data.itemSequenceNum === 'number' ? data.itemSequenceNum : null,
      projectSlug: typeof data.projectSlug === 'string' ? data.projectSlug : null,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
    };
  });
}

/**
 * Sends unread-notification digests to users subscribed for the given UTC hour.
 * Shared by both worker entrypoints (Nest-free) and unit tests.
 */
export async function runHourlyDigest(deps: DigestDeps = {}, hour = new Date().getUTCHours()): Promise<DigestResult> {
  const prefs = deps.prefs ?? new NotificationPrefsService();
  const notifications = deps.notifications ?? new NotificationsService();
  const mailer = deps.mailer ?? new MailerService();

  if (!mailer.isConfigured()) return { configured: false, users: 0, sent: 0, skipped: 0 };

  const subs = await prefs.digestSubscribers(hour);
  const byUser = new Map<string, { email: string; name: string; projectIds: Set<string> }>();
  for (const s of subs) {
    const entry = byUser.get(s.userId) ?? { email: s.email, name: s.name, projectIds: new Set<string>() };
    entry.projectIds.add(s.projectId);
    byUser.set(s.userId, entry);
  }

  let sent = 0;
  let skipped = 0;
  for (const [userId, sub] of byUser) {
    const unread = await notifications.getUnread(userId, 20);
    const items = toDigestItems(unread as UnreadRow[]);
    if (items.length === 0) {
      skipped++;
      continue;
    }
    const ok = await mailer.sendDigest(sub.email, sub.name, items);
    if (ok) sent++;
    else skipped++;
  }
  return { configured: true, users: byUser.size, sent, skipped };
}
