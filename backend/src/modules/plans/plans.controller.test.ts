import { describe, it, expect, vi } from 'vitest';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

describe('PlansController', () => {
  const mockPlan = { id: 'plan-1', projectId: 'proj-1', name: 'v1.0', type: 'release', color: '#3B82F6', status: 'active', sortOrder: 0 };

  function createController(mockService: Partial<PlansService>, mockTransfer?: Record<string, ReturnType<typeof vi.fn>>) {
    return new PlansController(
      mockService as PlansService,
      (mockTransfer ?? { exportAll: vi.fn(), bulkCreate: vi.fn(), importFile: vi.fn() }) as any,
    );
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

  it('export should set headers and return body', async () => {
    const transfer = { exportAll: vi.fn(async () => 'a,b'), bulkCreate: vi.fn(), importFile: vi.fn() };
    const controller = createController({}, transfer);
    const res: any = { set: vi.fn() };
    const result = await controller.export('demo', req, 'csv', res);
    expect(transfer.exportAll).toHaveBeenCalledWith('proj-1', 'csv');
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Disposition': expect.stringContaining('demo-plans.csv'),
    }));
    expect(result).toBe('a,b');
  });

  it('bulk should delegate to transfer service and strip internals', async () => {
    const item = { id: 'p-1', name: 'v1.0' };
    const transfer = {
      exportAll: vi.fn(),
      bulkCreate: vi.fn(async () => ({
        data: [{ index: 0, status: 'created', id: 'p-1', title: 'v1.0', item }],
        meta: { created: 1, skipped: 0, failed: 0, dryRun: false, dedupe: true },
      })),
      importFile: vi.fn(),
    };
    const controller = createController({}, transfer);
    const result = await controller.bulk(req, { items: [{ name: 'v1.0', type: 'release' }] }, undefined, undefined);
    expect(transfer.bulkCreate).toHaveBeenCalledWith(
      'proj-1', [{ name: 'v1.0', type: 'release' }], { dedupe: true, dryRun: false },
    );
    expect(result.data[0]).not.toHaveProperty('item');
  });

  it('import should throw without a file', async () => {
    const controller = createController({});
    await expect(controller.import(req, undefined, undefined, undefined)).rejects.toThrow(/No file uploaded/);
  });

  it('import should delegate to transfer service', async () => {
    const transfer = {
      exportAll: vi.fn(),
      bulkCreate: vi.fn(),
      importFile: vi.fn(async () => ({
        data: [{ index: 0, status: 'skipped', title: 'v1.0' }],
        meta: { created: 0, skipped: 1, failed: 0, dryRun: false, dedupe: true, format: 'csv' },
      })),
    };
    const controller = createController({}, transfer);
    const file = { originalname: 'plans.csv', buffer: Buffer.from('Name\nv1.0') } as any;
    const result = await controller.import(req, file, undefined, undefined);
    expect(transfer.importFile).toHaveBeenCalledWith(
      'proj-1', { originalname: 'plans.csv', buffer: file.buffer }, { dedupe: true, dryRun: false },
    );
    expect(result.meta).toMatchObject({ skipped: 1 });
  });
});
