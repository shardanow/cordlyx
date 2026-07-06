import { describe, it, expect, vi } from 'vitest';
import { BoardController } from './board.controller.js';
import { ItemsService } from './items.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('BoardController (unit)', () => {
  const mockItem = {
    id: '00000000-0000-0000-0000-000000000001',
    projectId: '00000000-0000-0000-0000-000000000002',
    statusId: '00000000-0000-0000-0000-000000000010',
    sortOrder: 1.5,
    title: 'Board Item',
  };

  function createController(mockService: Partial<ItemsService>, emitter?: Partial<EventEmitter2>) {
    const mockEmitter = { emit: vi.fn(), ...(emitter ?? {}) } as unknown as EventEmitter2;
    return { controller: new BoardController(mockService as ItemsService, mockEmitter), emitter: mockEmitter };
  }

  const req = { projectId: '00000000-0000-0000-0000-000000000002' } as any;
  const user = { id: 'user-1', email: 'u@t.com' };

  it('moveItem should call itemsService.moveItem with correct args', async () => {
    const spy = vi.fn(async () => mockItem as any);
    const { controller } = createController({ moveItem: spy });
    await controller.moveItem(req, '00000000-0000-0000-0000-000000000001', { statusId: '550e8400-e29b-41d4-a716-446655440002', sortOrder: 2.5 } as any, user);
    expect(spy).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', { statusId: '550e8400-e29b-41d4-a716-446655440002', sortOrder: 2.5 });
  });

  it('moveItem should emit item.status_changed event', async () => {
    const { controller, emitter } = createController({ moveItem: async () => mockItem as any });
    await controller.moveItem(req, '00000000-0000-0000-0000-000000000001', { statusId: '550e8400-e29b-41d4-a716-446655440002' } as any, user);
    expect((emitter as any).emit).toHaveBeenCalledWith('item.status_changed', expect.objectContaining({
      projectId: '00000000-0000-0000-0000-000000000002',
      actorId: 'user-1',
    }));
  });

  it('moveItem should return updated item', async () => {
    const { controller } = createController({ moveItem: async () => ({ ...mockItem, statusId: '550e8400-e29b-41d4-a716-446655440002' }) as any });
    const result = await controller.moveItem(req, '00000000-0000-0000-0000-000000000001', { statusId: '550e8400-e29b-41d4-a716-446655440002' } as any, user);
    expect(result).toMatchObject({ statusId: '550e8400-e29b-41d4-a716-446655440002' });
  });

  it('moveItem should throw on validation error (invalid statusId)', async () => {
    const { controller } = createController({ moveItem: async () => mockItem as any });
    await expect(
      controller.moveItem(req, '00000000-0000-0000-0000-000000000001', { statusId: 'not-a-uuid' } as any, user),
    ).rejects.toThrow();
  });

  it('moveItem should propagate service errors', async () => {
    const { controller } = createController({
      moveItem: async () => { throw new Error('Item not found'); },
    });
    await expect(
      controller.moveItem(req, '00000000-0000-0000-0000-000000000001', { statusId: '550e8400-e29b-41d4-a716-446655440000' } as any, user),
    ).rejects.toThrow('Item not found');
  });
});
