import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { items } from './items.js';
import { users } from './users.js';

export const itemVotes = pgTable(
  'item_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.itemId, table.userId)],
);
