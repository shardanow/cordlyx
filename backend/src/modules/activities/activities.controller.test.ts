import { describe, it, expect, vi } from 'vitest';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';

describe('ActivitiesController (unit)', () => {
  const mockActivities = {
    data: [
      { id: 'act-1', projectId: 'proj-1', actorId: 'user-1', action: 'item.created', createdAt: new Date() },
    ],
    meta: { cursor: null, hasMore: false, limit: 50 },
  };

  function createController(mockService: Partial<ActivitiesService>) {
    return new ActivitiesController(mockService as ActivitiesService);
  }

  it('should return project activity', async () => {
    const controller = createController({
      getByProject: async () => mockActivities,
    });
    const req = { projectId: 'proj-1' } as any;
    const result = await controller.getProjectActivity(req, {});
    expect(result).toEqual(mockActivities);
  });

  it('should pass cursor and limit from query', async () => {
    const spy = vi.fn(async () => mockActivities);
    const controller = createController({ getByProject: spy });
    const req = { projectId: 'proj-1' } as any;
    await controller.getProjectActivity(req, { cursor: 'abc', limit: '10' } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', 'abc', 10, undefined, undefined, undefined, '-created_at');
  });

  it('should throw on service error', async () => {
    const controller = createController({
      getByProject: async () => { throw new Error('DB error'); },
    });
    await expect(controller.getProjectActivity({ projectId: 'proj-1' } as any, {}))
      .rejects.toThrow('DB error');
  });

  it('getItemActivity should return item-level activity', async () => {
    const spy = vi.fn(async () => mockActivities);
    const controller = createController({ getByItem: spy });
    const result = await controller.getItemActivity('item-1', {});
    expect(spy).toHaveBeenCalledWith('item-1', undefined, 50);
    expect(result).toEqual(mockActivities);
  });

  it('getItemActivity should pass cursor and limit', async () => {
    const spy = vi.fn(async () => mockActivities);
    const controller = createController({ getByItem: spy });
    await controller.getItemActivity('item-1', { cursor: 'xyz', limit: '5' } as any);
    expect(spy).toHaveBeenCalledWith('item-1', 'xyz', 5);
  });
});
