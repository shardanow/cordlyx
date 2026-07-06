import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';
import { items } from './items.js';

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
