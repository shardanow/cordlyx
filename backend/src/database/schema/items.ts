import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  numeric,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';
import { itemTypes, itemStatuses, itemPriorities } from './config.js';
import { plans } from './plans.js';
import { roadmaps } from './roadmaps.js';

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sequenceNum: integer('sequence_num').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => itemTypes.id),
    statusId: uuid('status_id')
      .notNull()
      .references(() => itemStatuses.id),
    priorityId: uuid('priority_id')
      .notNull()
      .references(() => itemPriorities.id),
    assigneeId: uuid('assignee_id').references(() => users.id),
    reporterId: uuid('reporter_id').references(() => users.id),
    parentId: uuid('parent_id'),
    planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    roadmapId: uuid('roadmap_id').references(() => roadmaps.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    sortOrder: doublePrecision('sort_order').notNull().default(0),
    dueDate: timestamp('due_date'),
    startDate: timestamp('start_date'),
    estimatedHours: numeric('estimated_hours', { precision: 6, scale: 1 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    unique().on(table.projectId, table.sequenceNum),
    index('idx_items_status_sort').on(table.statusId, table.sortOrder),
    index('idx_items_project_created').on(table.projectId, table.createdAt),
  ],
);
