import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { itemTypes } from '../../database/schema/config.js';
import { tags as tagsTable } from '../../database/schema/tags.js';
import { sql, eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { CacheService } from '../../cache/cache.service.js';
import { ProjectConfigTransferService } from './project-config-transfer.service.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectConfigTransferService', () => {
  let service: ProjectConfigTransferService;
  let projectId: string;

  beforeAll(async () => {
    service = new ProjectConfigTransferService(new CacheService());
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'config-transfer@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Config Transfer',
    });
    const project = await projectsService.create({ name: 'Config Transfer', slug: 'config-transfer' }, userId);
    projectId = project!.id;
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('exports seeded config', async () => {
    const cfg = await service.exportConfig(projectId);
    expect(cfg.version).toBe(1);
    expect(cfg.types.length).toBeGreaterThan(0);
    expect(cfg.statuses.length).toBeGreaterThan(0);
    expect(cfg.priorities.length).toBeGreaterThan(0);
  });

  it('re-importing the export is a no-op', async () => {
    const cfg = await service.exportConfig(projectId);
    const res = await service.importConfig(projectId, cfg);
    expect(res.meta).toMatchObject({ created: 0, updated: 0, failed: 0 });
    expect(res.meta.unchanged).toBeGreaterThan(0);
  });

  it('creates new entries, updates changed ones, fails invalid rows', async () => {
    const res = await service.importConfig(projectId, {
      types: [{ name: 'Task', color: '#000000' }],
      statuses: [{ name: 'NoCategory', color: '#ffffff' }],
      priorities: [],
      tags: [{ name: 'fresh-tag', color: '#123456' }],
    });
    expect(res.meta).toMatchObject({ created: 1, updated: 1, failed: 1 });

    const db = getDb();
    const [task] = await db
      .select()
      .from(itemTypes)
      .where(and(eq(itemTypes.projectId, projectId), eq(itemTypes.name, 'Task')))
      .limit(1);
    expect(task.color).toBe('#000000');
    const [tag] = await db
      .select()
      .from(tagsTable)
      .where(and(eq(tagsTable.projectId, projectId), eq(tagsTable.name, 'fresh-tag')))
      .limit(1);
    expect(tag.color).toBe('#123456');
  });

  it('dryRun does not write', async () => {
    const res = await service.importConfig(
      projectId,
      { tags: [{ name: 'dry-tag', color: '#ffffff' }] },
      { dryRun: true },
    );
    expect(res.meta).toMatchObject({ created: 1, dryRun: true });
    const db = getDb();
    const rows = await db
      .select()
      .from(tagsTable)
      .where(and(eq(tagsTable.projectId, projectId), eq(tagsTable.name, 'dry-tag')));
    expect(rows).toHaveLength(0);
  });

  it('importFile round-trips JSON export', async () => {
    const cfg = await service.exportConfig(projectId);
    const res = await service.importFile(projectId, {
      originalname: 'config.json',
      buffer: Buffer.from(JSON.stringify(cfg)),
    });
    expect(res.meta.failed).toBe(0);
    expect(res.meta.created).toBe(0);
  });

  it('importFile rejects CSV', async () => {
    await expect(
      service.importFile(projectId, { originalname: 'config.csv', buffer: Buffer.from('a,b') }),
    ).rejects.toThrow(/JSON only/);
  });
});
