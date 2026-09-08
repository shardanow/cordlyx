import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlansService } from './plans.service.js';
import { PlansTransferService } from './plans-transfer.service.js';
import { ProjectsService } from '../projects/projects.service.js';

describe('PlansTransferService', () => {
  let service: PlansTransferService;
  let projectId: string;

  beforeAll(async () => {
    const emitter = { emit: () => {} } as unknown as EventEmitter2;
    service = new PlansTransferService(new PlansService(emitter));
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'plans-transfer@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Plans Transfer',
    });
    const project = await projectsService.create({ name: 'Plans Transfer', slug: 'plans-transfer' }, userId);
    projectId = project!.id;
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('bulk creates plans and skips duplicates by name', async () => {
    const first = await service.bulkCreate(projectId, [
      { name: 'v1.0', type: 'release' },
      { name: 'M1', type: 'milestone', status: 'active' },
    ]);
    expect(first.meta).toMatchObject({ created: 2, skipped: 0, failed: 0 });

    const second = await service.bulkCreate(projectId, [
      { name: '  V1.0 ', type: 'release' },
      { name: 'M1', type: 'milestone' },
    ]);
    expect(second.meta).toMatchObject({ created: 0, skipped: 2, failed: 0 });
  });

  it('reports invalid rows without blocking others', async () => {
    const res = await service.bulkCreate(projectId, [
      { name: 'Good', type: 'goal' },
      { name: 'Bad', type: 'nope' },
      { type: 'release' },
    ]);
    expect(res.meta).toMatchObject({ created: 1, skipped: 0, failed: 2 });
  });

  it('dryRun does not write', async () => {
    const before = await service.exportAll(projectId, 'json');
    const res = await service.bulkCreate(projectId, [{ name: 'Dry', type: 'release' }], { dryRun: true });
    expect(res.meta.dryRun).toBe(true);
    expect(res.meta.created).toBe(1);
    const after = await service.exportAll(projectId, 'json');
    expect((after as unknown[]).length).toBe((before as unknown[]).length);
  });

  it('CSV export round-trips through import as skipped', async () => {
    const csv = await service.exportAll(projectId, 'csv');
    expect(csv as string).toContain('v1.0');
    const res = await service.importFile(projectId, { originalname: 'plans.csv', buffer: Buffer.from(csv as string) });
    expect(res.meta.failed).toBe(0);
    expect(res.meta.created).toBe(0);
    expect(res.meta.skipped).toBeGreaterThan(0);
  });
});
