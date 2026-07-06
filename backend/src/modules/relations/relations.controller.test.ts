import { describe, it, expect, vi } from 'vitest';
import { RelationsController } from './relations.controller.js';
import { RelationsService } from './relations.service.js';
import { BadRequestException } from '@nestjs/common';

describe('RelationsController (unit)', () => {
  const mockRelation = {
    id: 'rel-1',
    sourceItemId: 'item-a',
    targetItemId: 'item-b',
    relationType: 'blocks',
  };

  const user = { id: 'user-1' } as any;

  function createController(mockService: Partial<RelationsService>, emitter?: { emit: ReturnType<typeof vi.fn> }) {
    return new RelationsController(mockService as RelationsService, (emitter ?? { emit: vi.fn() }) as any);
  }

  const req = { projectId: 'proj-1' } as any;

  it('list should return outgoing and incoming relations', async () => {
    const expected = { outgoing: [mockRelation], incoming: [] };
    const controller = createController({ getByItem: async () => expected });
    const result = await controller.list('item-a');
    expect(result).toEqual(expected);
  });

  it('create should call service with correct args including projectId', async () => {
    const spy = vi.fn(async () => mockRelation);
    const controller = createController({ create: spy }, { emit: vi.fn() });
    const targetId = '550e8400-e29b-41d4-a716-446655440002';
    await controller.create('item-a', req, { targetItemId: targetId, relationType: 'blocks' } as any, user);
    expect(spy).toHaveBeenCalledWith('item-a', targetId, 'blocks', 'proj-1');
  });

  it('create should return the new relation', async () => {
    const controller = createController({ create: async () => mockRelation }, { emit: vi.fn() });
    const targetId = '550e8400-e29b-41d4-a716-446655440002';
    const result = await controller.create('item-a', req, { targetItemId: targetId, relationType: 'blocks' } as any, user);
    expect(result).toEqual(mockRelation);
  });

  it('create should throw on validation error (invalid relationType)', async () => {
    const controller = createController({ create: async () => mockRelation }, { emit: vi.fn() });
    const targetId = '550e8400-e29b-41d4-a716-446655440002';
    await expect(
      controller.create('item-a', req, { targetItemId: targetId, relationType: 'invalid_type' } as any, user),
    ).rejects.toThrow();
  });

  it('create should propagate cross-project BadRequestException from service', async () => {
    const controller = createController({
      create: async () => { throw new BadRequestException('Cannot create relations between items from different projects'); },
    }, { emit: vi.fn() });
    const targetId = '550e8400-e29b-41d4-a716-446655440002';
    await expect(
      controller.create('item-a', req, { targetItemId: targetId, relationType: 'blocks' } as any, user),
    ).rejects.toThrow('Cannot create relations between items from different projects');
  });

  it('delete should call service and return result', async () => {
    const spy = vi.fn(async () => ({ success: true }));
    const controller = createController({ delete: spy }, { emit: vi.fn() });
    const result = await controller.delete('rel-1', 'item-a', req, user);
    expect(spy).toHaveBeenCalledWith('rel-1');
    expect(result).toEqual({ success: true });
  });
});
