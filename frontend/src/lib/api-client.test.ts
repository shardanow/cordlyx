import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, setAccessToken, ApiError, setOnUnauthorized } from './api-client';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  setAccessToken(null);
});

describe('apiClient', () => {
  it('should add Authorization header when token is set', async () => {
    setAccessToken('test-token');
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }));

    await apiClient('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('should not add Authorization header with skipAuth', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }));

    await apiClient('/test', { skipAuth: true });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.not.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad request' }),
    });

    await expect(apiClient('/test')).rejects.toThrow('Bad request');
  });

  it('should throw ApiError preserving statusCode and details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Forbidden thing', details: { x: 1 } }),
    });

    const err = await apiClient('/test').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(403);
    expect((err as ApiError).details).toEqual({ x: 1 });
  });

  it('should call onUnauthorized hook when refresh fails', async () => {
    const hook = vi.fn();
    setOnUnauthorized(hook);
    try {
      // First call 401s, refresh fails -> hook fires.
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
      await expect(apiClient('/test')).rejects.toThrow();
      expect(hook).toHaveBeenCalledTimes(1);
    } finally {
      setOnUnauthorized(() => {});
    }
  });

  it('should use NEXT_PUBLIC_API_URL as base', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiClient('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/test'),
      expect.any(Object),
    );
  });

  it('should resolve undefined on 204 No Content without parsing JSON', async () => {
    // Note: no `json` method on purpose — the client must not call it.
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers(), text: async () => '' });
    await expect(apiClient('/users/me', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('should resolve undefined on empty 200 bodies', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '0' }),
      text: async () => '',
    });
    await expect(apiClient('/test')).resolves.toBeUndefined();
  });
});
