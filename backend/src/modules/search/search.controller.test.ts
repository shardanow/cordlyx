import { describe, it, expect, vi } from 'vitest';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

describe('SearchController (unit)', () => {
  const mockResults = {
    data: [{ id: 'item-1', title: 'Found Item', sequenceNum: 1 }],
    meta: { cursor: null, hasMore: false, limit: 20 },
  };

  function createController(mockService: Partial<SearchService>) {
    return new SearchController(mockService as SearchService);
  }

  it('should return search results', async () => {
    const controller = createController({ search: async () => mockResults });
    const result = await controller.search({ q: 'found', limit: 20 } as any);
    expect(result).toEqual(mockResults);
  });

  it('should pass q and projectId to service', async () => {
    const spy = vi.fn(async () => mockResults);
    const controller = createController({ search: spy });
    const validProjectId = '550e8400-e29b-41d4-a716-446655440001';
    await controller.search({ q: 'test', projectId: validProjectId, limit: 10 } as any);
    expect(spy).toHaveBeenCalledWith('test', validProjectId, expect.objectContaining({ limit: 10 }));
  });

  it('should work without projectId (cross-project search)', async () => {
    const spy = vi.fn(async () => mockResults);
    const controller = createController({ search: spy });
    await controller.search({ q: 'hello' } as any);
    expect(spy).toHaveBeenCalledWith('hello', undefined, expect.any(Object));
  });

  it('should throw on validation error with missing q', async () => {
    const controller = createController({ search: async () => mockResults });
    await expect(controller.search({} as any)).rejects.toThrow();
  });

  it('should propagate service errors', async () => {
    const controller = createController({
      search: async () => { throw new Error('Search failed'); },
    });
    await expect(controller.search({ q: 'x' } as any)).rejects.toThrow('Search failed');
  });
});
