import { pgTable, uuid, boolean, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { projects } from './projects.js';

export const notificationPrefs = pgTable(
  'notification_prefs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    muted: boolean('muted').notNull().default(false),
    emailDigest: boolean('email_digest').notNull().default(false),
    digestHour: integer('digest_hour').notNull().default(8),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.projectId)],
);
