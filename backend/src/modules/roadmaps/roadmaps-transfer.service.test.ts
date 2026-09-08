import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemTypes } from '../../database/schema/config.js';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoadmapsService } from './roadmaps.service.js';
import { RoadmapsTransferService } from './roadmaps-transfer.service.js';
import { ItemsService } from '../items/items.service.js';
import { ProjectsService } from '../projects/projects.service.js';

describe('RoadmapsTransferService', () => {
  let service: RoadmapsTransferService;
  let roadmapsService: RoadmapsService;
  let projectId: string;
  let itemSeq1: number;
  let itemSeq2: number;

  beforeAll(async () => {
    const emitter = { emit: () => {} } as unknown as EventEmitter2;
    roadmapsService = new RoadmapsService(emitter);
    service = new RoadmapsTransferService(roadmapsService);
    const itemsService = new ItemsService();
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'roadmaps-transfer@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Roadmaps Transfer',
    });
    const project = await projectsService.create({ name: 'Roadmaps Transfer', slug: 'roadmaps-transfer' }, userId);
    projectId = project!.id;

    const [taskType] = await db.select().from(itemTypes).where(eq(itemTypes.projectId, projectId)).limit(1);
    const a = (await itemsService.create(projectId, { title: 'Sched A', typeId: taskType.id }, userId))!;
    const b = (await itemsService.create(projectId, { title: 'Sched B', typeId: taskType.id }, userId))!;
    itemSeq1 = a.sequenceNum;
    itemSeq2 = b.sequenceNum;

    const rm = await roadmapsService.create(projectId, { name: 'Q1', startDate: '2026-01-01', endDate: '2026-03-31' });
    const lane = await roadmapsService.createLane(rm!.id, projectId, { name: 'Team A' });
    await roadmapsService.scheduleItems(projectId, rm!.id, {
      itemIds: [a.id],
      laneId: lane!.id,
      startDate: '2026-01-05T00:00:00.000Z',
      dueDate: '2026-01-20T00:00:00.000Z',
    });
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('exports a roadmap with lanes and sequence-based entries', async () => {
    const all = (await service.exportAll(projectId, 'json')) as any[];
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Q1');
    expect(all[0].lanes).toHaveLength(1);
    expect(all[0].lanes[0].name).toBe('Team A');
    expect(all[0].entries).toHaveLength(1);
    expect(all[0].entries[0]).toMatchObject({ itemSeq: itemSeq1, lane: 'Team A' });
  });

  it('re-importing the export skips existing roadmaps', async () => {
    const all = (await service.exportAll(projectId, 'json')) as any[];
    const res = await service.importRoadmaps(projectId, all);
    expect(res.meta).toMatchObject({ created: 0, skipped: 1, failed: 0 });
  });

  it('imports a new roadmap, resolving entries and reporting bad ones', async () => {
    const res = await service.importRoadmaps(projectId, [
      {
        name: 'Q2',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        lanes: [{ name: 'Team B' }],
        entries: [
          { itemSeq: itemSeq2, lane: 'Team B', startDate: '2026-04-01T00:00:00.000Z' },
          { itemSeq: 99999, lane: 'Team B' },
          { itemSeq: itemSeq1, lane: 'Nope' },
        ],
      },
    ]);
    expect(res.meta).toMatchObject({ created: 1, skipped: 0, failed: 0 });
    expect(res.data[0].entries).toMatchObject({ created: 1, failed: 2 });

    const full = await roadmapsService.getRoadmapWithItems(projectId, res.data[0].id!);
    expect(full.lanes).toHaveLength(1);
    expect(full.lanes[0].items).toHaveLength(1);
  });

  it('dryRun writes nothing', async () => {
    const before = (await service.exportAll(projectId, 'json')) as any[];
    const res = await service.importRoadmaps(
      projectId,
      [{ name: 'Q9', startDate: '2026-01-01', endDate: '2026-02-01' }],
      { dryRun: true },
    );
    expect(res.meta).toMatchObject({ created: 1, dryRun: true });
    const after = (await service.exportAll(projectId, 'json')) as any[];
    expect(after.length).toBe(before.length);
  });

  it('importFile accepts a single roadmap object', async () => {
    const res = await service.importFile(projectId, {
      originalname: 'rm.json',
      buffer: Buffer.from(JSON.stringify({ name: 'Q3', startDate: '2026-07-01', endDate: '2026-09-30' })),
    });
    expect(res.meta).toMatchObject({ created: 1, format: 'json' });
  });
});
