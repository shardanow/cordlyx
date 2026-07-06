import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemsController } from './items.controller.js';

describe('ItemsController', () => {
  let controller: ItemsController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;
  let mockEmitter: Record<string, ReturnType<typeof vi.fn>>;
  let mockReq: { projectId: string };

  beforeEach(() => {
    mockService = {
      list: vi.fn(),
      getBySequence: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    mockEmitter = { emit: vi.fn() };
    mockReq = { projectId: 'proj-1' };

    controller = new ItemsController(mockService as any, {} as any, mockEmitter as any);
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
});
