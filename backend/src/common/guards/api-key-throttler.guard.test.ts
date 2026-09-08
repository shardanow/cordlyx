import { describe, it, expect, vi } from 'vitest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiKeyThrottlerGuard, apiKeyLimit, apiKeyTracker } from './api-key-throttler.guard.js';

describe('apiKeyLimit', () => {
  const ctx = (req: Record<string, unknown>) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

  it('uses the key budget when resolved', () => {
    expect(apiKeyLimit(ctx({ apiKeyRateLimit: 5 }))).toBe(5);
  });

  it('falls back to the default budget', () => {
    expect(apiKeyLimit(ctx({}))).toBe(60);
  });
});

describe('apiKeyTracker', () => {
  it('tracks keys by key id', () => {
    expect(apiKeyTracker({ apiKeyId: 'k-1', ip: '1.2.3.4' })).toBe('apikey-k-1');
  });

  it('tracks others by ip', () => {
    expect(apiKeyTracker({ ip: '1.2.3.4' })).toBe('1.2.3.4');
  });

  it('prefers first forwarded ip', () => {
    expect(apiKeyTracker({ ips: ['9.9.9.9', '1.2.3.4'], ip: '1.2.3.4' })).toBe('9.9.9.9');
  });
});

describe('ApiKeyThrottlerGuard', () => {
  function createGuard(validateKey: (raw: string) => Promise<any>) {
    const apiKeysService = { validateKey } as any;
    return new ApiKeyThrottlerGuard({ throttlers: [] } as any, {} as any, {} as any, apiKeysService);
  }

  const ctx = () => {
    const req: Record<string, any> = { headers: {} };
    return { req, context: { switchToHttp: () => ({ getRequest: () => req }) } as any };
  };

  it('resolves a valid key onto the request before throttling', async () => {
    const superSpy = vi.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    try {
      const guard = createGuard(async () => ({ keyId: 'k-1', rateLimitPerMin: 7 }));
      const { req, context } = ctx();
      req.headers = { 'x-api-key': 'clx_abc' };
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(req.apiKeyId).toBe('k-1');
      expect(req.apiKeyRateLimit).toBe(7);
      expect(superSpy).toHaveBeenCalled();
    } finally {
      superSpy.mockRestore();
    }
  });

  it('passes through without a key header', async () => {
    const superSpy = vi.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    try {
      const guard = createGuard(async () => null);
      const { req, context } = ctx();
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(req.apiKeyId).toBeUndefined();
    } finally {
      superSpy.mockRestore();
    }
  });

  it('survives validation errors (auth guard rejects later)', async () => {
    const superSpy = vi.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    try {
      const guard = createGuard(async () => {
        throw new Error('redis down');
      });
      const { req, context } = ctx();
      req.headers = { 'x-api-key': 'clx_abc' };
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(superSpy).toHaveBeenCalled();
    } finally {
      superSpy.mockRestore();
    }
  });
});
