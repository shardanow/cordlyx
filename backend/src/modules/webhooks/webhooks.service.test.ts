import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { WebhooksService } from './webhooks.service.js';
import { ProjectsService } from '../projects/projects.service.js';

describe('WebhooksService secrets + deliveries (DB)', () => {
  let service: WebhooksService;
  let projectId: string;
  let webhookId: string;

  beforeAll(async () => {
    service = new WebhooksService();
    const projectsService = new ProjectsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'webhooks@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Webhooks',
    });
    const project = await projectsService.create({ name: 'Webhooks', slug: 'webhooks-test' }, userId);
    projectId = project!.id;

    const created: any = await service.create(projectId, { url: 'https://example.com/hook', events: [] });
    webhookId = created.id;
    expect(created.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  afterAll(async () => {
    await getDb().execute(sql`TRUNCATE users CASCADE`);
  });

  it('list hides secrets but shows last delivery', async () => {
    const rows: any[] = await service.list(projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('secret');
    expect(rows[0].lastDelivery).toBeNull();

    await service.recordDelivery({ webhookId, event: 'item.created', httpStatus: 200, success: true, attempt: 1 });
    const after: any[] = await service.list(projectId);
    expect(after[0].lastDelivery).toMatchObject({ ok: true });
  });

  it('getDeliveries returns newest first', async () => {
    await service.recordDelivery({ webhookId, event: 'item.deleted', success: false, errorMessage: 'boom', attempt: 1 });
    const rows: any[] = await service.getDeliveries(webhookId, projectId, 10);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].event).toBe('item.deleted');
  });

  it('regenerateSecret rotates the secret', async () => {
    const first: any = await service.regenerateSecret(webhookId, projectId);
    const second: any = await service.regenerateSecret(webhookId, projectId);
    expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(second.secret).not.toBe(first.secret);
  });
});
