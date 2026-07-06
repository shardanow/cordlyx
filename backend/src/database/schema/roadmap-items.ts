import { pgTable, uuid, varchar, doublePrecision, timestamp, unique } from 'drizzle-orm/pg-core';
import { roadmaps } from './roadmaps.js';
import { items } from './items.js';
import { roadmapLanes } from './roadmap-lanes.js';

export const roadmapItems = pgTable(
  'roadmap_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roadmapId: uuid('roadmap_id')
      .notNull()
      .references(() => roadmaps.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    laneId: uuid('lane_id').references(() => roadmapLanes.id, { onDelete: 'set null' }),
    startDate: timestamp('start_date'),
    dueDate: timestamp('due_date'),
    sortOrder: doublePrecision('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.roadmapId, table.itemId),
  ],
);
