import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemsController } from './items.controller.js';

describe('ItemsController', () => {
  let controller: ItemsController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;
  let mockImportService: Record<string, ReturnType<typeof vi.fn>>;
  let mockEmitter: Record<string, ReturnType<typeof vi.fn>>;
  let mockReq: { projectId: string };

  beforeEach(() => {
    mockService = {
      list: vi.fn(),
      getBySequence: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      exportAll: vi.fn(),
    };
    mockImportService = {
      bulkCreate: vi.fn(),
      importFile: vi.fn(),
    };
    mockEmitter = { emit: vi.fn() };
    mockReq = { projectId: 'proj-1' };

    controller = new ItemsController(mockService as any, {} as any, mockEmitter as any, mockImportService as any);
  });

  describe('list', () => {
    it('should call service with parsed filters', async () => {
      mockService.list.mockResolvedValueOnce({ data: [], meta: {} });
      await controller.list(mockReq as any, {});
      expect(mockService.list).toHaveBeenCalledWith('proj-1', {
        limit: 50, sort: '-created_at',
      });
    });

    it('should pass cursor and limit from query', async () => {
      mockService.list.mockResolvedValueOnce({ data: [], meta: {} });
      await controller.list(mockReq as any, { cursor: 'abc', limit: '10' });
      expect(mockService.list).toHaveBeenCalledWith('proj-1', {
        cursor: 'abc', limit: 10, sort: '-created_at',
      });
    });
  });

  describe('getBySequence', () => {
    it('should return item when found', async () => {
      const item = { id: 'i-1', sequenceNum: 1, title: 'Test' };
      mockService.getBySequence.mockResolvedValueOnce(item);
      const result = await controller.getBySequence(mockReq as any, 1);
      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      mockService.getBySequence.mockResolvedValueOnce(null);
      await expect(controller.getBySequence(mockReq as any, 999)).rejects.toThrow('Item not found');
    });
  });

  describe('create', () => {
    it('should create item and emit event', async () => {
      const item = { id: 'i-1', title: 'New item' };
      mockService.create.mockResolvedValueOnce(item);
      const user = { id: 'u-1' };

      const result = await controller.create(mockReq as any, user as any, {
        title: 'New item', typeId: '00000000-0000-0000-0000-000000000001',
      });

      expect(mockService.create).toHaveBeenCalledWith('proj-1', { title: 'New item', typeId: '00000000-0000-0000-0000-000000000001' }, 'u-1');
      expect(mockEmitter.emit).toHaveBeenCalledWith('item.created', { projectId: 'proj-1', item, actorId: 'u-1' });
      expect(result).toEqual(item);
    });

    it('should throw on invalid input', async () => {
      await expect(
        controller.create(mockReq as any, { id: 'u-1' } as any, { title: '' }),
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update item and emit events for changed fields', async () => {
      const item = { id: 'i-1', title: 'Updated' };
      const oldValues = { assigneeId: null, statusId: null, title: 'Old Title', priorityId: null, description: null };
      mockService.update.mockResolvedValueOnce({ item, oldValues });
      const user = { id: 'u-1' };

      const result = await controller.update(mockReq as any, 'i-1', { title: 'Updated' }, user as any);

      expect(mockService.update).toHaveBeenCalledWith('proj-1', 'i-1', { title: 'Updated' });
      expect(mockEmitter.emit).toHaveBeenCalledWith('item.updated', {
        projectId: 'proj-1', item, fieldName: 'title', oldValue: 'Old Title', newValue: 'Updated', actorId: 'u-1',
      });
      expect(result).toEqual(item);
    });
  });

  describe('delete', () => {
    it('should soft-delete item and emit event with title', async () => {
      mockService.softDelete.mockResolvedValueOnce({ success: true, title: 'My Item' });
      const user = { id: 'u-1' };

      const result = await controller.delete('i-1', mockReq as any, user as any);

      expect(mockService.softDelete).toHaveBeenCalledWith('proj-1', 'i-1');
      expect(mockEmitter.emit).toHaveBeenCalledWith('item.deleted', { projectId: 'proj-1', itemId: 'i-1', title: 'My Item', actorId: 'u-1' });
      expect(result).toEqual({ success: true, title: 'My Item' });
    });
  });

  describe('export', () => {
    it('should set CSV headers and return body as-is', async () => {
      mockService.exportAll.mockResolvedValueOnce('a,b');
      const res: any = { set: vi.fn() };
      const result = await controller.export('demo', mockReq as any, 'csv', res);
      expect(mockService.exportAll).toHaveBeenCalledWith('proj-1', 'csv');
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': expect.stringContaining('text/csv'),
        'Content-Disposition': expect.stringContaining('demo-items.csv'),
      }));
      expect(result).toBe('a,b');
    });

    it('should default to csv and stringify JSON payloads', async () => {
      mockService.exportAll.mockResolvedValueOnce([{ id: '1' }]);
      const res: any = { set: vi.fn() };
      const result = await controller.export('demo', mockReq as any, undefined as any, res);
      expect(mockService.exportAll).toHaveBeenCalledWith('proj-1', 'csv');
      expect(typeof result).toBe('string');
    });
  });

  describe('bulk', () => {
    it('should call importService, emit events and strip internal items', async () => {
      const item = { id: 'i-1', title: 'A' };
      mockImportService.bulkCreate.mockResolvedValueOnce({
        data: [
          { index: 0, status: 'created', id: 'i-1', sequenceNum: 1, title: 'A', item },
          { index: 1, status: 'skipped', title: 'B' },
        ],
        meta: { created: 1, skipped: 1, failed: 0, dryRun: false, dedupe: true },
      });
      const user = { id: 'u-1' };
      const result = await controller.bulk(
        mockReq as any, user as any,
        { items: [{ title: 'A', typeId: '00000000-0000-0000-0000-000000000001' }] },
        undefined, undefined,
      );
      expect(mockImportService.bulkCreate).toHaveBeenCalledWith(
        'proj-1', 'u-1',
        [{ title: 'A', typeId: '00000000-0000-0000-0000-000000000001' }],
        { dedupe: true, dryRun: false },
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith('item.created', { projectId: 'proj-1', item, actorId: 'u-1' });
      expect(result.data[0]).not.toHaveProperty('item');
      expect(result.meta).toMatchObject({ created: 1, skipped: 1 });
    });

    it('should not emit events on dryRun', async () => {
      mockImportService.bulkCreate.mockResolvedValueOnce({
        data: [{ index: 0, status: 'created', title: 'A', sequenceNum: null }],
        meta: { created: 1, skipped: 0, failed: 0, dryRun: true, dedupe: true },
      });
      await controller.bulk(mockReq as any, { id: 'u-1' } as any, { items: [{ title: 'A' }] }, undefined, 'true');
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });

    it('should honor dedupe=false query flag', async () => {
      mockImportService.bulkCreate.mockResolvedValueOnce({ data: [], meta: {} });
      await controller.bulk(mockReq as any, { id: 'u-1' } as any, { items: [{ title: 'A' }] }, 'false', undefined);
      expect(mockImportService.bulkCreate).toHaveBeenCalledWith('proj-1', 'u-1', [{ title: 'A' }], { dedupe: false, dryRun: false });
    });

    it('should throw on invalid body', async () => {
      await expect(controller.bulk(mockReq as any, { id: 'u-1' } as any, { items: [] }, undefined, undefined)).rejects.toThrow();
    });
  });

  describe('import', () => {
    it('should throw when no file is uploaded', async () => {
      await expect(
        controller.import(mockReq as any, { id: 'u-1' } as any, undefined, undefined, undefined),
      ).rejects.toThrow(/No file uploaded/);
    });

    it('should call importFile and emit events for created items', async () => {
      const item = { id: 'i-2', title: 'C' };
      mockImportService.importFile.mockResolvedValueOnce({
        data: [{ index: 0, status: 'created', id: 'i-2', sequenceNum: 5, title: 'C', item }],
        meta: { created: 1, skipped: 0, failed: 0, dryRun: false, dedupe: true, format: 'csv' },
      });
      const file = { originalname: 'items.csv', buffer: Buffer.from('Title\nC') } as any;
      const result = await controller.import(mockReq as any, { id: 'u-1' } as any, file, undefined, undefined);
      expect(mockImportService.importFile).toHaveBeenCalledWith(
        'proj-1', 'u-1',
        { originalname: 'items.csv', buffer: file.buffer },
        { dedupe: true, dryRun: false },
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith('item.created', { projectId: 'proj-1', item, actorId: 'u-1' });
      expect(result.meta).toMatchObject({ format: 'csv' });
    });
  });
});
