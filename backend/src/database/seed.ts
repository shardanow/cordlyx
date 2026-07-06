import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { eq, and, sql } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { users } from './schema/users.js';
import { projects } from './schema/projects.js';
import { projectMembers } from './schema/members.js';
import { itemTypes, itemStatuses, itemPriorities } from './schema/config.js';
import { items } from './schema/items.js';
import { issueSequences } from './schema/sequences.js';
import { tags } from './schema/tags.js';
import { comments } from './schema/comments.js';

// __dirname is available in CJS (SWC compiles to CJS)
config({ path: resolve(__dirname, '../../../.env') });

const { Pool } = pg;

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding database...');

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log('Database already has data — skipping seed');
    await pool.end();
    return;
  }

  const aliceId = randomUUID();
  const bobId = randomUUID();

  await db.insert(users).values([
    { id: aliceId, username: 'alice', email: 'alice@example.com', passwordHash: await bcrypt.hash('password123', 12), name: 'Alice Johnson' },
    { id: bobId, username: 'bob', email: 'bob@example.com', passwordHash: await bcrypt.hash('password123', 12), name: 'Bob Smith' },
  ]);

  const projectId = randomUUID();

  await db.insert(projects).values({
    id: projectId, name: 'Demo Project', slug: 'demo',
    description: 'A demo project for testing CordLyx features', ownerId: aliceId,
  });

  await db.insert(projectMembers).values([
    { projectId, userId: aliceId, role: 'admin' },
    { projectId, userId: bobId, role: 'member' },
  ]);

  await db.insert(issueSequences).values({ projectId, lastValue: 0 });

  await db.insert(itemTypes).values([
    { projectId, name: 'Task', color: '#3B82F6', icon: 'check-square', isDefault: true, sortOrder: 1 },
    { projectId, name: 'Bug', color: '#EF4444', icon: 'bug', isDefault: true, sortOrder: 2 },
    { projectId, name: 'Feature', color: '#8B5CF6', icon: 'sparkles', isDefault: true, sortOrder: 3 },
    { projectId, name: 'Idea', color: '#F59E0B', icon: 'lightbulb', isDefault: true, sortOrder: 4 },
  ]);

  await db.insert(itemStatuses).values([
    { projectId, name: 'Inbox', color: '#6366F1', category: 'inbox', isDefault: true, sortOrder: 0 },
    { projectId, name: 'Backlog', color: '#6B7280', category: 'backlog', isDefault: false, sortOrder: 1 },
    { projectId, name: 'To Do', color: '#3B82F6', category: 'todo', isDefault: true, sortOrder: 2 },
    { projectId, name: 'In Progress', color: '#F59E0B', category: 'active', isDefault: true, sortOrder: 3 },
    { projectId, name: 'Done', color: '#10B981', category: 'done', isDefault: true, sortOrder: 4 },
  ]);

  await db.insert(itemPriorities).values([
    { projectId, name: 'Critical', color: '#EF4444', icon: 'arrow-up', isDefault: false, sortOrder: 1 },
    { projectId, name: 'Medium', color: '#F59E0B', icon: 'minus', isDefault: true, sortOrder: 2 },
    { projectId, name: 'Low', color: '#6B7280', icon: 'chevron-down', isDefault: false, sortOrder: 3 },
  ]);

  const [taskType] = await db.select().from(itemTypes).where(and(eq(itemTypes.projectId, projectId), eq(itemTypes.name, 'Task'))).limit(1);
  const [bugType] = await db.select().from(itemTypes).where(and(eq(itemTypes.projectId, projectId), eq(itemTypes.name, 'Bug'))).limit(1);
  const [todoStatus] = await db.select().from(itemStatuses).where(and(eq(itemStatuses.projectId, projectId), eq(itemStatuses.name, 'To Do'))).limit(1);
  const [doneStatus] = await db.select().from(itemStatuses).where(and(eq(itemStatuses.projectId, projectId), eq(itemStatuses.name, 'Done'))).limit(1);
  const [inProgressStatus] = await db.select().from(itemStatuses).where(and(eq(itemStatuses.projectId, projectId), eq(itemStatuses.name, 'In Progress'))).limit(1);
  const [medPriority] = await db.select().from(itemPriorities).where(and(eq(itemPriorities.projectId, projectId), eq(itemPriorities.name, 'Medium'))).limit(1);
  const [criticalPriority] = await db.select().from(itemPriorities).where(and(eq(itemPriorities.projectId, projectId), eq(itemPriorities.name, 'Critical'))).limit(1);

  await db.insert(items).values([
    { id: randomUUID(), projectId, sequenceNum: 1, title: 'Set up CI/CD pipeline', typeId: taskType!.id, statusId: todoStatus!.id, priorityId: medPriority!.id, assigneeId: aliceId, reporterId: aliceId },
    { id: randomUUID(), projectId, sequenceNum: 2, title: 'Login page is broken on mobile', typeId: bugType!.id, statusId: inProgressStatus!.id, priorityId: criticalPriority!.id, assigneeId: bobId, reporterId: aliceId, description: 'The login form overflows on screens narrower than 360px' },
    { id: randomUUID(), projectId, sequenceNum: 3, title: 'Add dark mode support', typeId: taskType!.id, statusId: doneStatus!.id, priorityId: medPriority!.id, assigneeId: aliceId, reporterId: bobId },
  ]);

  await db.insert(tags).values([
    { projectId, name: 'frontend', color: '#3B82F6' },
    { projectId, name: 'backend', color: '#10B981' },
    { projectId, name: 'urgent', color: '#EF4444' },
  ]);

  console.log('Seed complete! Demo project created.');
  console.log('  Login: alice@example.com / password123');
  console.log('  Login: bob@example.com / password123');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
