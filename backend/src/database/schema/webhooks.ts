import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb, foreignKey, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  events: jsonb('events').notNull().$type<string[]>(),
  isActive: boolean('is_active').notNull().default(true),
  secret: varchar('secret', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.projectId], foreignColumns: [projects.id] }),
]);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id')
    .notNull()
    .references(() => webhooks.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 100 }).notNull(),
  httpStatus: integer('http_status'),
  success: boolean('success').notNull().default(false),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  attempt: integer('attempt').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_webhook_deliveries_webhook_created').on(table.webhookId, table.createdAt),
]);
