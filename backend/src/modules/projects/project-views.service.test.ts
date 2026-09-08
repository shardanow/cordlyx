import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { ProjectViewsService } from './project-views.service.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectViewsService', () => {
  let service: ProjectViewsService;
  let projectId: string;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    service = new ProjectViewsService();
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    alice = randomUUID();
    bob = randomUUID();
    for (const [id, email, name] of [
      [alice, 'views-alice@test.com', 'Alice'],
      [bob, 'views-bob@test.com', 'Bob'],
    ] as const) {
      await db.insert(users).values({ id, email, passwordHash: await bcrypt.hash('password123', 12), name });
    }
    const project = await projectsService.create({ name: 'Views', slug: 'views-proj' }, alice);
    projectId = project!.id;

    const { projectMembers } = await import('../../database/schema/members.js');
    await db.insert(projectMembers).values({ id: randomUUID(), projectId, userId: bob, role: 'member' });
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('creates personal views and lists own + shared', async () => {
    const mine: any = await service.create(projectId, alice, { name: 'Mine', filters: { typeId: '' } });
    expect(mine.isShared).toBe(false);

    // Bob sees nothing (not shared, not owner)
    expect(await service.list(projectId, bob)).toHaveLength(0);
    // Alice sees her own
    expect(await service.list(projectId, alice)).toHaveLength(1);

    await service.update(mine.id, projectId, alice, false, { isShared: true });
    expect(await service.list(projectId, bob)).toHaveLength(1);
  });

  it('forbids edits by non-owners', async () => {
    const mine: any = await service.create(projectId, alice, { name: 'Private', filters: {} });
    await expect(service.update(mine.id, projectId, bob, false, { name: 'Hijack' })).rejects.toThrow(/owner or a project admin/);
    await expect(service.remove(mine.id, projectId, bob, false)).rejects.toThrow(/owner or a project admin/);
    // ...but admins may manage
    await service.update(mine.id, projectId, alice, true, { name: 'Renamed' });
  });

  it('keeps exactly one default per project', async () => {
    const a: any = await service.create(projectId, alice, { name: 'A', filters: {} });
    const b: any = await service.create(projectId, alice, { name: 'B', filters: {} });
    await service.setDefault(a.id, projectId);
    await service.setDefault(b.id, projectId);
    const rows: any[] = await service.list(projectId, alice);
    expect(rows.filter((r) => r.isDefault)).toHaveLength(1);
    expect(rows.find((r) => r.isDefault).id).toBe(b.id);
  });

  it('validates filters', async () => {
    const { createViewSchema } = await import('./project-views.service.js');
    expect(() => createViewSchema.parse({ name: 'x', filters: { typeId: 'nope' } })).toThrow();
    expect(createViewSchema.parse({ name: 'x', filters: { typeId: '', search: 'bug' } }).filters.search).toBe('bug');
  });
});
