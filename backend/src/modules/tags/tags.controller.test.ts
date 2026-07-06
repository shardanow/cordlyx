import { describe, it, expect, vi } from 'vitest';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

describe('TagsController (unit)', () => {
  const mockTag = { id: 'tag-1', projectId: 'proj-1', name: 'bug', color: '#ef4444' };

  function createController(mockService: Partial<TagsService>) {
    return new TagsController(mockService as TagsService);
  }

  const req = { projectId: 'proj-1' } as any;

  it('list should return all tags for project', async () => {
    const controller = createController({ list: async () => [mockTag] });
    const result = await controller.list(req);
    expect(result).toEqual([mockTag]);
  });

  it('create should return new tag', async () => {
    const spy = vi.fn(async () => mockTag);
    const controller = createController({ create: spy });
    const result = await controller.create(req, { name: 'bug', color: '#ef4444' } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', 'bug', '#ef4444');
    expect(result).toEqual(mockTag);
  });

  it('create should throw on validation error (missing name)', async () => {
    const controller = createController({ create: async () => mockTag });
    await expect(controller.create(req, {} as any)).rejects.toThrow();
  });

  it('delete should return success', async () => {
    const controller = createController({ delete: async () => ({ success: true }) });
    const result = await controller.delete('tag-1');
    expect(result).toEqual({ success: true });
  });

  it('update should call service and return updated tag', async () => {
    const updated = { ...mockTag, name: 'feature', color: '#3b82f6' };
    const spy = vi.fn(async () => updated);
    const controller = createController({ update: spy });
    const result = await controller.update('tag-1', { name: 'feature', color: '#3b82f6' } as any);
    expect(spy).toHaveBeenCalledWith('tag-1', { name: 'feature', color: '#3b82f6' });
    expect(result).toEqual(updated);
  });

  it('list should propagate service errors', async () => {
    const controller = createController({
      list: async () => { throw new Error('Not found'); },
    });
    await expect(controller.list(req)).rejects.toThrow('Not found');
  });
});
