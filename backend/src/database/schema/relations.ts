import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { items } from './items.js';

export const relationTypes = ['blocks', 'depends_on', 'relates_to', 'duplicates', 'child_of', 'next_action'] as const;

export const itemRelations = pgTable(
  'item_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceItemId: uuid('source_item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    targetItemId: uuid('target_item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    relationType: varchar('relation_type', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.sourceItemId, table.targetItemId, table.relationType)],
);
