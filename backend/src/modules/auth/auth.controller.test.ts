import { describe, it, expect } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';

describe('AuthController (unit)', () => {
  function createController(mockService: Partial<AuthService>) {
    return new AuthController(mockService as AuthService);
  }

  it('register should call authService.register and return result', async () => {
    const expected = { accessToken: 'a', refreshToken: 'b', user: { id: '1', email: 't@t.com', name: 'T' } };
    const controller = createController({
      register: async () => expected,
    });
    const result = await controller.register({ username: 'tuser', email: 't@test.com', password: 'password123', name: 'T' } as any);
    expect(result).toEqual(expected);
  });

  it('register should throw if authService.register throws', async () => {
    const controller = createController({
      register: async () => { throw new Error('Already registered'); },
    });
    await expect(controller.register({ username: 'tuser', email: 't@test.com', password: 'password123', name: 'T' } as any)).rejects.toThrow('Already registered');
  });

  it('login should call authService.login and return result', async () => {
    const expected = { accessToken: 'a', refreshToken: 'b' };
    const controller = createController({
      login: async () => expected,
    });
    const result = await controller.login({ login: 'tuser', password: 'password123' } as any);
    expect(result).toEqual(expected);
  });

  it('login should throw on invalid credentials', async () => {
    const controller = createController({
      login: async () => { throw new Error('Invalid login or password'); },
    });
    await expect(controller.login({ login: 'tuser', password: 'wrongpass' } as any)).rejects.toThrow('Invalid login or password');
  });

  it('refresh should call authService.refresh and return result', async () => {
    const expected = { accessToken: 'a', refreshToken: 'b' };
    const controller = createController({
      refresh: async () => expected,
    });
    const result = await controller.refresh({ refreshToken: 'valid-token' } as any);
    expect(result).toEqual(expected);
  });

  it('refresh should throw on invalid token', async () => {
    const controller = createController({
      refresh: async () => { throw new Error('Invalid or expired refresh token'); },
    });
    await expect(controller.refresh({ refreshToken: 'bad' } as any)).rejects.toThrow('Invalid or expired refresh token');
  });
});
