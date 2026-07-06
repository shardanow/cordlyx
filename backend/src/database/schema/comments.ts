import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { items } from './items.js';
import { users } from './users.js';

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  parentId: uuid('parent_id'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
},
(table) => [
  index('idx_comments_item').on(table.itemId),
  index('idx_comments_parent').on(table.parentId),
],
);
