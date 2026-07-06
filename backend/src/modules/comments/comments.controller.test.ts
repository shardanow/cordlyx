import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsController } from './comments.controller.js';

describe('CommentsController', () => {
  let controller: CommentsController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;
  let mockEmitter: Record<string, ReturnType<typeof vi.fn>>;
  let mockReq: { projectId: string };

  beforeEach(() => {
    mockService = {
      getByItem: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    mockEmitter = { emit: vi.fn() };
    mockReq = { projectId: 'proj-1' };

    controller = new CommentsController(mockService as any, mockEmitter as any);
  });

  describe('list', () => {
    it('should return comments for item', async () => {
      const comments = [{ id: 'c-1', body: 'Hello' }];
      mockService.getByItem.mockResolvedValueOnce(comments);
      const result = await controller.list('item-1');
      expect(result).toEqual(comments);
      expect(mockService.getByItem).toHaveBeenCalledWith('item-1');
    });
  });

  describe('create', () => {
    it('should create comment and emit event', async () => {
      const comment = { id: 'c-1', body: 'Nice!' };
      mockService.create.mockResolvedValueOnce(comment);
      const user = { id: 'u-1' };

      const result = await controller.create(mockReq as any, 'item-1', user as any, { body: 'Nice!' });

      expect(mockService.create).toHaveBeenCalledWith('item-1', 'u-1', 'Nice!', undefined);
      expect(mockEmitter.emit).toHaveBeenCalledWith('comment.created', {
        projectId: 'proj-1', itemId: 'item-1', comment, actorId: 'u-1',
      });
      expect(result).toEqual(comment);
    });

    it('should pass parentId when provided', async () => {
      mockService.create.mockResolvedValueOnce({ id: 'c-2' });
      await controller.create(mockReq as any, 'item-1', { id: 'u-1' } as any, {
        body: 'Reply', parentId: '00000000-0000-0000-0000-000000000001',
      });
      expect(mockService.create).toHaveBeenCalledWith('item-1', 'u-1', 'Reply', '00000000-0000-0000-0000-000000000001');
    });

    it('should throw on empty body', async () => {
      await expect(
        controller.create(mockReq as any, 'item-1', { id: 'u-1' } as any, { body: '' }),
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update comment and emit event', async () => {
      mockService.update.mockResolvedValueOnce({ id: 'c-1', body: 'Edited' });

      const result = await controller.update(mockReq as any, 'item-1', 'c-1', { body: 'Edited' });

      expect(mockService.update).toHaveBeenCalledWith('c-1', 'Edited');
      expect(mockEmitter.emit).toHaveBeenCalledWith('comment.updated', {
        projectId: 'proj-1', itemId: 'item-1', commentId: 'c-1',
      });
      expect(result).toEqual({ id: 'c-1', body: 'Edited' });
    });
  });

  describe('delete', () => {
    it('should soft-delete comment and emit event', async () => {
      mockService.softDelete.mockResolvedValueOnce({ success: true });

      const result = await controller.delete(mockReq as any, 'item-1', 'c-1');

      expect(mockService.softDelete).toHaveBeenCalledWith('c-1');
      expect(mockEmitter.emit).toHaveBeenCalledWith('comment.deleted', {
        projectId: 'proj-1', itemId: 'item-1', commentId: 'c-1',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
