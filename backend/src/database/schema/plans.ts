import { pgTable, uuid, varchar, text, integer, timestamp, date, index, check } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { sql } from 'drizzle-orm';

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    color: varchar('color', { length: 7 }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_plans_project').on(table.projectId, table.sortOrder),
    check('chk_plans_dates', sql`${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.startDate} <= ${table.endDate}`),
  ],
);
