import { pgTable, uuid, varchar, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  token: varchar('token', { length: 64 }).notNull().unique(),
  createdById: uuid('created_by_id').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id] }),
  foreignKey({ columns: [table.createdById], foreignColumns: [users.id] }),
]);
