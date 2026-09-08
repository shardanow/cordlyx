import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemTypes } from '../../database/schema/config.js';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../../cache/cache.service.js';
import { ProjectSnapshotService } from './project-snapshot.service.js';
import { ProjectConfigTransferService } from './project-config-transfer.service.js';
import { PlansTransferService } from '../plans/plans-transfer.service.js';
import { PlansService } from '../plans/plans.service.js';
import { ItemsImportService } from '../items/items-import.service.js';
import { ItemsService } from '../items/items.service.js';
import { RoadmapsTransferService } from '../roadmaps/roadmaps-transfer.service.js';
import { RoadmapsService } from '../roadmaps/roadmaps.service.js';
import { RelationsService } from '../relations/relations.service.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectSnapshotService', () => {
  let service: ProjectSnapshotService;
  let projectsService: ProjectsService;
  let userId: string;
  let projectA: string;
  let snapshot: any;

  beforeAll(async () => {
    const emitter = { emit: () => {} } as unknown as EventEmitter2;
    const itemsService = new ItemsService();
    projectsService = new ProjectsService();
    service = new ProjectSnapshotService(
      projectsService,
      new ProjectConfigTransferService(new CacheService()),
      new PlansTransferService(new PlansService(emitter)),
      new ItemsImportService(itemsService),
      new RoadmapsTransferService(new RoadmapsService(emitter)),
    );

    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'snapshot@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Snapshot',
    });
    const project = await projectsService.create({ name: 'Snap A', slug: 'snap-a' }, userId);
    projectA = project!.id;

    const [taskType] = await db.select().from(itemTypes).where(eq(itemTypes.projectId, projectA)).limit(1);
    const plansService = new PlansService(emitter);
    const plan = (await plansService.create(projectA, { name: 'R1', type: 'release' }))!;
    const roadmapsService = new RoadmapsService(emitter);
    const relationsService = new RelationsService();

    const a = (await itemsService.create(projectA, { title: 'Snap item 1', typeId: taskType.id, planId: plan.id, tagIds: [] }, userId))!;
    const b = (await itemsService.create(projectA, { title: 'Snap item 2', typeId: taskType.id }, userId))!;
    await relationsService.create(a.id, b.id, 'blocks', projectA);

    const rm = (await roadmapsService.create(projectA, { name: 'Snap RM', startDate: '2026-01-01', endDate: '2026-12-31' }))!;
    const lane = (await roadmapsService.createLane(rm.id, projectA, { name: 'Lane 1' }))!;
    await roadmapsService.scheduleItems(projectA, rm.id, { itemIds: [a.id], laneId: lane.id });

    snapshot = await service.exportSnapshot(projectA);
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('exports all sections', () => {
    expect(snapshot.version).toBe(1);
    expect(snapshot.project.slug).toBe('snap-a');
    expect(snapshot.config.types.length).toBeGreaterThan(0);
    expect(snapshot.plans).toHaveLength(1);
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.relations).toHaveLength(1);
    expect(snapshot.relations[0]).toMatchObject({ sourceSeq: 1, targetSeq: 2, relationType: 'blocks' });
    expect(snapshot.roadmaps).toHaveLength(1);
    expect(snapshot.roadmaps[0].entries).toHaveLength(1);
    expect(snapshot.roadmaps[0].entries[0]).toMatchObject({ itemSeq: 1, lane: 'Lane 1' });
  });

  it('imports into a new project with all sections restored', async () => {
    const { project, import: result } = (await service.importNewProject(userId, snapshot, {})) as any;
    expect(project.slug).toBe('snap-a-imported');

    const fresh = await service.exportSnapshot(project.id);
    expect(fresh.plans).toHaveLength(1);
    expect(fresh.items).toHaveLength(2);
    expect(fresh.relations).toHaveLength(1);
    expect(fresh.roadmaps).toHaveLength(1);
    expect(fresh.roadmaps[0].entries).toHaveLength(1);
    expect(fresh.config.types.length).toBe(snapshot.config.types.length);

    const meta = (result as any).meta.sections;
    expect(meta.items).toMatchObject({ created: 2, failed: 0 });
    expect(meta.relations).toMatchObject({ created: 1, failed: 0 });
    expect(meta.roadmaps).toMatchObject({ created: 1, failed: 0 });
  });

  it('merging the same snapshot again skips everything', async () => {
    const projects = await projectsService.listForUser(userId);
    const imported = projects.find((p: any) => p.slug === 'snap-a-imported')!;
    const res = (await service.importSnapshot(imported.id, snapshot, {})) as any;
    expect(res.meta.sections.items).toMatchObject({ created: 0, skipped: 2, failed: 0 });
    expect(res.meta.sections.relations).toMatchObject({ created: 0, skipped: 1, failed: 0 });
    expect(res.meta.sections.roadmaps).toMatchObject({ created: 0, skipped: 1, failed: 0 });
    expect(res.meta.sections.plans).toMatchObject({ created: 0, skipped: 1, failed: 0 });
  });

  it('dryRun merge writes nothing', async () => {
    const projects = await projectsService.listForUser(userId);
    const imported = projects.find((p: any) => p.slug === 'snap-a-imported')!;
    const before = await service.exportSnapshot(imported.id);
    const res = (await service.importSnapshot(imported.id, snapshot, { dryRun: true })) as any;
    expect(res.meta.dryRun).toBe(true);
    const after = await service.exportSnapshot(imported.id);
    expect(after.items).toHaveLength(before.items.length);
    expect(after.roadmaps).toHaveLength(before.roadmaps.length);
  });

  it('imports snapshots with empty optional sections', async () => {
    const res = (await service.importSnapshot(projectA, {
      version: 1,
      project: { name: 'Snap A', slug: 'snap-a' },
      config: { types: [], statuses: [], priorities: [], tags: [] },
      plans: [],
      items: [{ title: 'Lonely', type: 'Task' }],
      relations: [],
      roadmaps: [],
    })) as any;
    expect(res.meta.sections.plans).toMatchObject({ created: 0, failed: 0 });
    expect(res.meta.sections.roadmaps).toMatchObject({ created: 0, failed: 0 });
    expect(res.meta.sections.items).toMatchObject({ created: 1, failed: 0 });
  });

    it('rejects wrong version and oversized payloads', async () => {
    await expect(service.importSnapshot(projectA, { version: 2 })).rejects.toThrow();
    const big = { ...snapshot, items: new Array(2001).fill({ title: 'x' }) };
    await expect(service.importSnapshot(projectA, big)).rejects.toThrow(/Too many items/);
  });

  it('archives the new project when import fails midway (no orphans)', async () => {
    const badRoadmaps = new Array(101).fill({
      name: 'Too many',
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    });
    await expect(
      service.importNewProject(userId, { ...snapshot, roadmaps: badRoadmaps }, { slug: 'snap-orphan' }),
    ).rejects.toThrow(/Too many roadmaps/);
    const orphan = await projectsService.getBySlug('snap-orphan');
    expect(orphan?.isArchived).toBe(true);
  });
});
