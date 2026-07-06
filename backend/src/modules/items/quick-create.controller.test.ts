import { describe, it, expect, vi } from 'vitest';
import { QuickCreateController } from './quick-create.controller.js';
import { ItemsService } from './items.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('QuickCreateController (unit)', () => {
  const mockItem = { id: 'item-1', projectId: 'proj-1', title: 'Quick Item', sequenceNum: 1 };

  function createController(mockService: Partial<ItemsService>) {
    const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
    const controller = new QuickCreateController(mockService as ItemsService, emitter);
    return { controller, emitter };
  }

  const user = { id: 'user-1', email: 'u@t.com' };

  it('quickCreate should throw if projectSlug is missing', async () => {
    const { controller } = createController({ create: async () => mockItem as any });
    const req = { headers: {} } as any;
    await expect(
      controller.quickCreate(user, { title: 'Test', typeId: '550e8400-e29b-41d4-a716-446655440001' } as any, req),
    ).rejects.toThrow(/Project slug is required|projectSlug/i);
  });

  it('quickCreate should throw if project not found', async () => {
    const { controller } = createController({ create: async () => mockItem as any });
    const req = { headers: { 'x-project-slug': 'nonexistent' } } as any;
    await expect(
      controller.quickCreate(user, { title: 'Test', typeId: '550e8400-e29b-41d4-a716-446655440001', projectSlug: 'nonexistent' } as any, req),
    ).rejects.toThrow(/Project not found/);
  });

  it('quickCreate should throw on validation error (missing title)', async () => {
    const { controller } = createController({ create: async () => mockItem as any });
    const req = { headers: {} } as any;
    await expect(
      controller.quickCreate(user, { typeId: '550e8400-e29b-41d4-a716-446655440001' } as any, req),
    ).rejects.toThrow();
  });
});
