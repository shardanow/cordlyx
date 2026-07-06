import { describe, it, expect } from 'vitest';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController (unit)', () => {
  const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User', avatarUrl: null };

  function createController(mockService: Partial<UsersService>) {
    return new UsersController(mockService as UsersService);
  }

  it('getProfile should return user profile', async () => {
    const controller = createController({
      getProfile: async () => mockUser,
    });
    const result = await controller.getProfile({ id: 'user-1', email: 'test@example.com' });
    expect(result).toEqual(mockUser);
  });

  it('getProfile should throw if user not found', async () => {
    const controller = createController({
      getProfile: async () => { throw new Error('User not found'); },
    });
    await expect(controller.getProfile({ id: 'user-1', email: 'test@example.com' }))
      .rejects.toThrow('User not found');
  });

  it('updateProfile should return updated profile', async () => {
    const updated = { ...mockUser, name: 'Updated Name' };
    const controller = createController({
      updateProfile: async () => updated,
    });
    const result = await controller.updateProfile(
      { id: 'user-1', email: 'test@example.com' },
      { name: 'Updated Name' } as any,
    );
    expect(result).toEqual(updated);
  });

  it('updateProfile should throw on validation error', async () => {
    const controller = createController({ updateProfile: async () => ({}) as any });
    await expect(
      controller.updateProfile({ id: 'user-1', email: 'test@example.com' }, { name: 1234 } as any),
    ).rejects.toThrow();
  });
});
