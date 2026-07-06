import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RelationsService } from './relations.service.js';
import { getDb } from '../../database/client.js';
import { users } from '../../database/schema/users.js';
import { projects } from '../../database/schema/projects.js';
import { projectMembers } from '../../database/schema/members.js';
import { items } from '../../database/schema/items.js';
import { itemTypes, itemStatuses, itemPriorities } from '../../database/schema/config.js';
import { issueSequences } from '../../database/schema/sequences.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';

describe('RelationsService', () => {
  let relationsService: RelationsService;
  let userId: string;
  let itemAId: string;
  let itemBId: string;
  let projectId: string;

  beforeAll(async () => {
    relationsService = new RelationsService();
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'relations-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Relations Test',
    });

    projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Relations Test Project',
      slug: 'relations-test-project',
      description: null,
      ownerId: userId,
      isArchived: false,
      settings: {},
    });

    await db.insert(issueSequences).values({ projectId, lastValue: 0 });

    const [type] = await db.insert(itemTypes).values({
      id: randomUUID(), projectId, name: 'Task', color: '#3B82F6', isDefault: true, sortOrder: '0',
    }).returning({ id: itemTypes.id });
    const [status] = await db.insert(itemStatuses).values({
      id: randomUUID(), projectId, name: 'Todo', color: '#6B7280', category: 'todo', isDefault: true, sortOrder: '0',
    }).returning({ id: itemStatuses.id });
    const [priority] = await db.insert(itemPriorities).values({
      id: randomUUID(), projectId, name: 'Medium', color: '#F59E0B', isDefault: true, sortOrder: '0',
    }).returning({ id: itemPriorities.id });

    await db.insert(projectMembers).values({
      id: randomUUID(), projectId, userId, role: 'member',
    });

    itemAId = randomUUID();
    itemBId = randomUUID();
    await db.insert(items).values([
      { id: itemAId, projectId, sequenceNum: 1, typeId: type.id, statusId: status.id, priorityId: priority.id, assigneeId: userId, reporterId: userId, title: 'Item A' },
      { id: itemBId, projectId, sequenceNum: 2, typeId: type.id, statusId: status.id, priorityId: priority.id, assigneeId: userId, reporterId: userId, title: 'Item B' },
    ]);
    // expose projectId for tests
    (relationsService as any).__testProjectId = projectId;
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should list relations (empty)', async () => {
    const result = await relationsService.getByItem(itemAId);
    expect(result.outgoing).toEqual([]);
    expect(result.incoming).toEqual([]);
  });

  it('should create a blocks relation', async () => {
    const rel = await relationsService.create(itemAId, itemBId, 'blocks', projectId);
    expect(rel.sourceItemId).toBe(itemAId);
    expect(rel.targetItemId).toBe(itemBId);
    expect(rel.relationType).toBe('blocks');
  });

  it('should reject duplicate relation', async () => {
    await expect(
      relationsService.create(itemAId, itemBId, 'blocks', projectId),
    ).rejects.toThrow('Relation already exists');
  });

  it('should show outgoing relations', async () => {
    const result = await relationsService.getByItem(itemAId);
    expect(result.outgoing.length).toBe(1);
    expect(result.outgoing[0]!.relationType).toBe('blocks');
    expect(result.incoming.length).toBe(0);
  });

  it('should show incoming relations', async () => {
    const result = await relationsService.getByItem(itemBId);
    expect(result.incoming.length).toBe(1);
    expect(result.incoming[0]!.relationType).toBe('blocks');
    expect(result.outgoing.length).toBe(0);
  });

  it('should create multiple relation types', async () => {
    const rel = await relationsService.create(itemAId, itemBId, 'relates_to', projectId);
    expect(rel.relationType).toBe('relates_to');
  });

  it('should delete a relation', async () => {
    const result = await relationsService.getByItem(itemAId);
    const rel = result.outgoing[0]!;
    const deleteResult = await relationsService.delete(rel.id);
    expect(deleteResult).toEqual({ success: true });

    const after = await relationsService.getByItem(itemAId);
    expect(after.outgoing.find((r) => r.id === rel.id)).toBeUndefined();
  });
});
