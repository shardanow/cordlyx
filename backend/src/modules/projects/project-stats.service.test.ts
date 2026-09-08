import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemTypes, itemStatuses } from '../../database/schema/config.js';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { ProjectStatsService } from './project-stats.service.js';
import { ItemsService } from '../items/items.service.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectStatsService', () => {
  let service: ProjectStatsService;
  let projectId: string;

  beforeAll(async () => {
    service = new ProjectStatsService();
    const itemsService = new ItemsService();
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    const mateId = randomUUID();
    for (const [id, email, name] of [
      [userId, 'stats@test.com', 'Stats'],
      [mateId, 'stats-mate@test.com', 'Mate'],
    ] as const) {
      await db.insert(users).values({ id, email, passwordHash: await bcrypt.hash('password123', 12), name });
    }
    const project = await projectsService.create({ name: 'Stats', slug: 'stats-proj' }, userId);
    projectId = project!.id;

    // creator is admin member; add mate as member via direct insert through service? use members table
    const { projectMembers } = await import('../../database/schema/members.js');
    await db.insert(projectMembers).values({ id: randomUUID(), projectId, userId: mateId, role: 'member' });

    const [taskType] = await db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)).limit(1);
    const statuses = await db.select().from(itemStatuses).where(eq(itemStatuses.projectId, projectId));
    const inbox = statuses.find((s) => s.category === 'inbox')!;
    const done = statuses.find((s) => s.category === 'done')!;

    await itemsService.create(
      projectId,
      { title: 'Open assigned', typeId: taskType.id, statusId: inbox.id, assigneeId: mateId, dueDate: '2000-01-01T00:00:00.000Z' },
      userId,
    );
    await itemsService.create(projectId, { title: 'Open free', typeId: taskType.id, statusId: inbox.id }, userId);
    await itemsService.create(projectId, { title: 'Done one', typeId: taskType.id, statusId: done.id }, userId);
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('aggregates totals, funnel, overdue and workload', async () => {
    const stats = await service.getStats(projectId);
    expect(stats.total).toBe(3);
    expect(stats.open).toBe(2);
    expect(stats.done).toBe(1);

    expect(stats.overdue.count).toBe(1);
    expect(stats.overdue.items[0].title).toBe('Open assigned');

    const inboxRow = stats.byStatus.find((s) => s.category === 'inbox')!;
    expect(inboxRow.count).toBe(2);
    const doneRow = stats.byStatus.find((s) => s.category === 'done')!;
    expect(doneRow.count).toBe(1);
    expect(stats.byStatus.reduce((n, s) => n + s.count, 0)).toBe(3);

    const mate = stats.byAssignee.find((a) => a.name === 'Mate')!;
    expect(mate).toMatchObject({ open: 1, total: 1 });

    expect(stats.byType.reduce((n, t) => n + t.count, 0)).toBe(3);
  });
});
