import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const projectRoles = ['admin', 'member', 'viewer'] as const;

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.projectId, table.userId)],
);
