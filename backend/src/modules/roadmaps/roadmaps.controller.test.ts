import { describe, it, expect, vi } from 'vitest';
import { RoadmapsController } from './roadmaps.controller.js';
import { RoadmapsService } from './roadmaps.service.js';

describe('RoadmapsController', () => {
  const mockRoadmap = { id: 'rm-1', projectId: 'proj-1', name: 'Q1', startDate: '2025-01-01', endDate: '2025-03-31', color: '#3B82F6', sortOrder: 0 };

  function createController(mockService: Partial<RoadmapsService>) {
    return new RoadmapsController(mockService as RoadmapsService);
  }

  const req = { projectId: 'proj-1' } as any;

  it('list should return all roadmaps', async () => {
    const controller = createController({ list: async () => [mockRoadmap] });
    const result = await controller.list(req, {});
    expect(result).toEqual([mockRoadmap]);
  });

  it('create should return new roadmap', async () => {
    const spy = vi.fn(async () => mockRoadmap);
    const controller = createController({ create: spy });
    const result = await controller.create(req, { name: 'Q1', startDate: '2025-01-01', endDate: '2025-03-31', color: '#3B82F6' } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', { name: 'Q1', startDate: '2025-01-01', endDate: '2025-03-31', color: '#3B82F6' });
    expect(result).toEqual(mockRoadmap);
  });

  it('create should throw on missing name', async () => {
    const controller = createController({ create: async () => mockRoadmap });
    await expect(controller.create(req, { startDate: '2025-01-01', endDate: '2025-03-31' } as any)).rejects.toThrow();
  });

  it('create should throw on invalid date format', async () => {
    const controller = createController({ create: async () => mockRoadmap });
    await expect(controller.create(req, { name: 'Q1', startDate: 'invalid', endDate: '2025-03-31' } as any)).rejects.toThrow();
  });

  it('getById should return roadmap', async () => {
    const controller = createController({ getById: async () => mockRoadmap });
    const result = await controller.getById(req, 'rm-1');
    expect(result).toEqual(mockRoadmap);
  });

  it('getById should throw on not found', async () => {
    const controller = createController({ getById: async () => null });
    await expect(controller.getById(req, 'unknown')).rejects.toThrow('Roadmap not found');
  });

  it('update should call service', async () => {
    const updated = { ...mockRoadmap, name: 'Q2' };
    const spy = vi.fn(async () => updated);
    const controller = createController({ update: spy });
    const result = await controller.update(req, 'rm-1', { name: 'Q2' } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', 'rm-1', { name: 'Q2' });
    expect(result).toEqual(updated);
  });

  it('delete should return success', async () => {
    const controller = createController({ delete: async () => ({ success: true }) });
    const result = await controller.delete(req, 'rm-1');
    expect(result).toEqual({ success: true });
  });
});
