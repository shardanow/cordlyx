import { describe, it, expect, vi } from 'vitest';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import { NotFoundException } from '@nestjs/common';

describe('ApiKeysController (unit)', () => {
  const mockKey = {
    id: 'key-1',
    name: 'CI Key',
    keyPrefix: 'clx_abc123de',
    projectId: null,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
  };
  const user = { id: 'user-1', email: 'u@t.com' };

  function createController(mockService: Partial<ApiKeysService>) {
    return new ApiKeysController(mockService as ApiKeysService);
  }

  it('list should return user api keys', async () => {
    const controller = createController({ list: async () => [mockKey as any] });
    const result = await controller.list(user);
    expect(result).toEqual([mockKey]);
  });

  it('create should return new key with raw value', async () => {
    const withKey = { ...mockKey, key: 'clx_rawsecret123' };
    const spy = vi.fn(async () => withKey as any);
    const controller = createController({ create: spy });
    const result = await controller.create(user, { name: 'CI Key' });
      expect(spy).toHaveBeenCalledWith('user-1', { name: 'CI Key', rateLimitPerMin: 120 });
    expect(result).toEqual(withKey);
  });

  it('create should throw on validation error (empty name)', async () => {
    const controller = createController({ create: async () => mockKey as any });
    await expect(controller.create(user, { name: '' } as any)).rejects.toThrow();
  });

  it('revoke should return success', async () => {
    const spy = vi.fn(async () => ({ success: true }));
    const controller = createController({ revoke: spy });
    const result = await controller.revoke(user, 'key-1');
    expect(spy).toHaveBeenCalledWith('user-1', 'key-1');
    expect(result).toEqual({ success: true });
  });

  it('revoke should throw NotFoundException for unknown key', async () => {
    const controller = createController({
      revoke: async () => { throw new NotFoundException('API key not found'); },
    });
    await expect(controller.revoke(user, 'bad-id')).rejects.toThrow('API key not found');
  });

  it('update should pass name and rate limit', async () => {
    const spy = vi.fn(async () => ({ ...mockKey, rateLimitPerMin: 10 }) as any);
    const controller = createController({ update: spy });
    const result = await controller.update(user, 'key-1', { name: 'Renamed', rateLimitPerMin: 10 });
    expect(spy).toHaveBeenCalledWith('user-1', 'key-1', { name: 'Renamed', rateLimitPerMin: 10 });
    expect(result).toMatchObject({ rateLimitPerMin: 10 });
  });

  it('update should throw on out-of-range limit', async () => {
    const controller = createController({ update: async () => mockKey as any });
    await expect(controller.update(user, 'key-1', { rateLimitPerMin: 0 })).rejects.toThrow();
  });
});
