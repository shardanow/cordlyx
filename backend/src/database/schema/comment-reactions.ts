import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { comments } from './comments.js';
import { users } from './users.js';

export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    reaction: varchar('reaction', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.commentId, table.userId, table.reaction),
  ],
);
