import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { NotificationPrefsService } from './notification-prefs.service.js';
import { ProjectsService } from '../projects/projects.service.js';

describe('NotificationPrefsService', () => {
  let service: NotificationPrefsService;
  let projectId: string;
  let userId: string;

  beforeAll(async () => {
    service = new NotificationPrefsService();
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'prefs@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Prefs',
    });
    const project = await projectsService.create({ name: 'Prefs', slug: 'prefs-proj' }, userId);
    projectId = project!.id;
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('defaults to unmuted, then upserts', async () => {
    expect(await service.isMuted(userId, projectId)).toBe(false);

    const row: any = await service.upsert(userId, projectId, { muted: true, emailDigest: true, digestHour: 9 });
    expect(row).toMatchObject({ muted: true, emailDigest: true, digestHour: 9 });
    expect(await service.isMuted(userId, projectId)).toBe(true);

    await service.upsert(userId, projectId, { muted: false });
    expect(await service.isMuted(userId, projectId)).toBe(false);
  });

  it('rejects invalid digest hours', async () => {
    await expect(service.upsert(userId, projectId, { digestHour: 24 })).rejects.toThrow(/0-23/);
  });

  it('lists mine and finds digest subscribers', async () => {
    await service.upsert(userId, projectId, { muted: false, emailDigest: true, digestHour: 9 });
    const mine = await service.getMine(userId);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ projectId, emailDigest: true });

    const subs = await service.digestSubscribers(9);
    expect(subs.find((s) => s.userId === userId)?.email).toBe('prefs@test.com');
    expect(await service.digestSubscribers(10)).toHaveLength(0);
  });
});
