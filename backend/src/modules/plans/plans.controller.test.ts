import { describe, it, expect, vi } from 'vitest';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

describe('PlansController', () => {
  const mockPlan = { id: 'plan-1', projectId: 'proj-1', name: 'v1.0', type: 'release', color: '#3B82F6', status: 'active', sortOrder: 0 };

  function createController(mockService: Partial<PlansService>) {
    return new PlansController(mockService as PlansService);
  }

  const req = { projectId: 'proj-1' } as any;

  it('list should return all plans', async () => {
    const controller = createController({ list: async () => [mockPlan] });
    const result = await controller.list(req);
    expect(result).toEqual([mockPlan]);
  });

  it('create should return new plan', async () => {
    const spy = vi.fn(async () => mockPlan);
    const controller = createController({ create: spy });
    const result = await controller.create(req, { name: 'v1.0', type: 'release', color: '#3B82F6' });
    expect(spy).toHaveBeenCalledWith('proj-1', { name: 'v1.0', type: 'release', color: '#3B82F6' });
    expect(result).toEqual(mockPlan);
  });

  it('create should throw on missing name', async () => {
    const controller = createController({ create: async () => mockPlan });
    await expect(controller.create(req, { type: 'release' })).rejects.toThrow();
  });

  it('create should throw on invalid type', async () => {
    const controller = createController({ create: async () => mockPlan });
    await expect(controller.create(req, { name: 'test', type: 'invalid' })).rejects.toThrow();
  });

  it('update should call service', async () => {
    const updated = { ...mockPlan, name: 'v2.0' };
    const spy = vi.fn(async () => updated);
    const controller = createController({ update: spy });
    const result = await controller.update(req, 'plan-1', { name: 'v2.0' });
    expect(spy).toHaveBeenCalledWith('proj-1', 'plan-1', { name: 'v2.0' });
    expect(result).toEqual(updated);
  });

  it('delete should return success', async () => {
    const controller = createController({ delete: async () => ({ success: true }) });
    const result = await controller.delete(req, 'plan-1');
    expect(result).toEqual({ success: true });
  });
});
