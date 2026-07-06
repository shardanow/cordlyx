import { describe, it, expect, vi } from 'vitest';
import { ProjectConfigController } from './project-config.controller.js';
import { ProjectConfigService } from './project-config.service.js';

describe('ProjectConfigController (unit)', () => {
  const mockType = { id: 'type-1', projectId: 'proj-1', name: 'Task', color: '#3B82F6', isDefault: true, sortOrder: '0' };
  const mockStatus = { id: 'status-1', projectId: 'proj-1', name: 'Todo', color: '#6B7280', category: 'todo', isDefault: true, sortOrder: '0' };
  const mockPriority = { id: 'prio-1', projectId: 'proj-1', name: 'Medium', color: '#F59E0B', isDefault: true, sortOrder: '0' };

  function createController(mockService: Partial<ProjectConfigService>) {
    return new ProjectConfigController(mockService as ProjectConfigService);
  }

  const req = { projectId: 'proj-1' } as any;

  // --- Types ---
  it('getTypes should return types', async () => {
    const controller = createController({ getTypes: async () => [mockType] as any });
    const result = await controller.getTypes(req);
    expect(result).toEqual([mockType]);
  });

  it('createType should call service and return type', async () => {
    const spy = vi.fn(async () => mockType as any);
    const controller = createController({ createType: spy });
    const result = await controller.createType(req, { name: 'Task', color: '#3B82F6', isDefault: true } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'Task' }));
    expect(result).toEqual(mockType);
  });

  it('createType should throw on missing name', async () => {
    const controller = createController({ createType: async () => mockType as any });
    await expect(controller.createType(req, {} as any)).rejects.toThrow();
  });

  it('updateType should call service and return updated type', async () => {
    const spy = vi.fn(async () => ({ ...mockType, name: 'Bug' }) as any);
    const controller = createController({ updateType: spy });
    const result = await controller.updateType('type-1', { name: 'Bug' } as any);
    expect(spy).toHaveBeenCalledWith('type-1', { name: 'Bug' });
    expect(result).toMatchObject({ name: 'Bug' });
  });

  it('deleteType should return success', async () => {
    const spy = vi.fn(async () => undefined);
    const controller = createController({ deleteType: spy });
    const result = await controller.deleteType('type-1');
    expect(spy).toHaveBeenCalledWith('type-1');
    expect(result).toEqual({ success: true });
  });

  // --- Statuses ---
  it('getStatuses should return statuses', async () => {
    const controller = createController({ getStatuses: async () => [mockStatus] as any });
    const result = await controller.getStatuses(req);
    expect(result).toEqual([mockStatus]);
  });

  it('createStatus should call service', async () => {
    const spy = vi.fn(async () => mockStatus as any);
    const controller = createController({ createStatus: spy });
    await controller.createStatus(req, { name: 'Todo', color: '#6B7280', category: 'todo', isDefault: true } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'Todo' }));
  });

  it('deleteStatus should return success', async () => {
    const controller = createController({ deleteStatus: async () => undefined });
    const result = await controller.deleteStatus('status-1');
    expect(result).toEqual({ success: true });
  });

  // --- Priorities ---
  it('getPriorities should return priorities', async () => {
    const controller = createController({ getPriorities: async () => [mockPriority] as any });
    const result = await controller.getPriorities(req);
    expect(result).toEqual([mockPriority]);
  });

  it('createPriority should call service', async () => {
    const spy = vi.fn(async () => mockPriority as any);
    const controller = createController({ createPriority: spy });
    await controller.createPriority(req, { name: 'Medium', color: '#F59E0B', isDefault: true } as any);
    expect(spy).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'Medium' }));
  });

  it('deletePriority should return success', async () => {
    const controller = createController({ deletePriority: async () => undefined });
    const result = await controller.deletePriority('prio-1');
    expect(result).toEqual({ success: true });
  });
});
