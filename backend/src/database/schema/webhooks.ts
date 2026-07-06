import { pgTable, uuid, varchar, timestamp, boolean, jsonb, foreignKey } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  events: jsonb('events').notNull().$type<string[]>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id] }),
]);
