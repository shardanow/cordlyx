import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { roadmaps } from './roadmaps.js';

export const roadmapLanes = pgTable(
  'roadmap_lanes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roadmapId: uuid('roadmap_id')
      .notNull()
      .references(() => roadmaps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    icon: varchar('icon', { length: 10 }),
    color: varchar('color', { length: 7 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_lanes_roadmap_sort').on(table.roadmapId, table.sortOrder),
  ],
);
