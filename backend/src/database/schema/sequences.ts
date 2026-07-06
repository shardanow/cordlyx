import { pgTable, uuid, bigint } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const issueSequences = pgTable('issue_sequences', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  lastValue: bigint('last_value', { mode: 'number' }).notNull().default(0),
});
