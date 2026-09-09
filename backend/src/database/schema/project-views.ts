import { pgTable, uuid, varchar, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export interface SavedViewFilters {
  typeId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  planId?: string;
  search?: string;
  tagIds?: string[];
  sort?: string;
}

export const projectViews = pgTable(
  'project_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    filters: jsonb('filters').notNull().$type<SavedViewFilters>(),
    isShared: boolean('is_shared').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_project_views_project').on(table.projectId, table.createdAt),
  ],
);
