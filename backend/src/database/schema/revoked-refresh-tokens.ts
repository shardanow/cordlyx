import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** Refresh-token denylist for logout. Rows expire with the token itself. */
export const revokedRefreshTokens = pgTable(
  'revoked_refresh_tokens',
  {
    jti: varchar('jti', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_revoked_refresh_tokens_user').on(table.userId),
  ],
);
