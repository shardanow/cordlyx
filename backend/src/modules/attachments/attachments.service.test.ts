import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AttachmentsService } from './attachments.service.js';
import { StorageService } from '../../storage/storage.service.js';
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

describe('AttachmentsService', () => {
  let attachmentsService: AttachmentsService;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    process.env.STORAGE_LOCAL_PATH = '/tmp/cordlyx-test-uploads';

    const storage = new StorageService();
    attachmentsService = new AttachmentsService(storage);

    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);

    userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'attachments-test@test.com',
      passwordHash: await bcrypt.hash('password123', 12),
      name: 'Attachments Test',
    });

    const projectId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Attachments Test Project',
      slug: 'attachments-test-project',
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

    itemId = randomUUID();
    await db.insert(items).values({
      id: itemId,
      projectId,
      sequenceNum: 1,
      typeId: type.id,
      statusId: status.id,
      priorityId: priority.id,
      assigneeId: userId,
      reporterId: userId,
      title: 'Test Item',
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE users CASCADE`);
  });

  it('should list attachments (empty)', async () => {
    const result = await attachmentsService.getByItem(itemId);
    expect(result).toEqual([]);
  });

  it('should upload an attachment', async () => {
    const file = {
      buffer: Buffer.from('hello world'),
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 11,
    };
    const att = await attachmentsService.upload(itemId, userId, file);
    expect(att.originalFilename).toBe('test.txt');
    expect(att.mimeType).toBe('text/plain');
    expect(att.sizeBytes).toBe(11);
    expect(att.storageProvider).toBe('local');
  });

  it('should reject disallowed file type', async () => {
    const file = {
      buffer: Buffer.from('x'),
      originalname: 'evil.exe',
      mimetype: 'application/x-msdownload',
      size: 1,
    };
    await expect(
      attachmentsService.upload(itemId, userId, file),
    ).rejects.toThrow(/File type.*not allowed/);
  });

  it('should reject oversized file', async () => {
    const file = {
      buffer: Buffer.alloc(11 * 1024 * 1024),
      originalname: 'huge.txt',
      mimetype: 'text/plain',
      size: 11 * 1024 * 1024,
    };
    await expect(
      attachmentsService.upload(itemId, userId, file),
    ).rejects.toThrow(/exceeds 10MB/);
  });

  it('should list attachments after upload', async () => {
    const result = await attachmentsService.getByItem(itemId);
    expect(result.length).toBe(1);
    expect(result[0]!.originalFilename).toBe('test.txt');
  });

  it('should delete an attachment', async () => {
    const result = await attachmentsService.getByItem(itemId);
    const att = result[0]!;
    const deleteResult = await attachmentsService.delete(att.id, itemId);
    expect(deleteResult).toEqual({ success: true });

    const remaining = await attachmentsService.getByItem(itemId);
    expect(remaining.find((a) => a.id === att.id)).toBeUndefined();
  });

  it('should throw on delete for non-existent attachment', async () => {
    await expect(
      attachmentsService.delete(randomUUID(), itemId),
    ).rejects.toThrow('Attachment not found');
  });
});
