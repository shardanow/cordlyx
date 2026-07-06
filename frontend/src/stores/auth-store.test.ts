import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockSetAccessToken = vi.fn();
const mockRefreshAccessToken = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/api-client', () => ({
  api: { post: mockPost, get: mockGet },
  setAccessToken: mockSetAccessToken,
  refreshAccessToken: mockRefreshAccessToken,
}));

const { useAuthStore } = await import('./auth-store');

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true, isAuthenticated: false });
    mockPost.mockReset();
    mockGet.mockReset();
    mockSetAccessToken.mockReset();
    mockRefreshAccessToken.mockResolvedValue(undefined);
    localStorage.clear();
    document.cookie = '';
  });

  it('login should set token and load user', async () => {
    mockPost.mockResolvedValueOnce({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    mockGet.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com', name: 'Alice', avatarUrl: null });

    await useAuthStore.getState().login('alice', 'pass');

    expect(mockPost).toHaveBeenCalledWith('/auth/login', { login: 'alice', password: 'pass' }, { skipAuth: true });
    expect(mockSetAccessToken).toHaveBeenCalledWith('access-1');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-1');
    expect(document.cookie).toContain('refreshToken=refresh-1');
    expect(useAuthStore.getState().user?.email).toBe('a@b.com');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('register should set token and load user', async () => {
    mockPost.mockResolvedValueOnce({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    mockGet.mockResolvedValueOnce({ id: 'u2', email: 'b@c.com', name: 'Bob', avatarUrl: null });

    await useAuthStore.getState().register('bob', 'b@c.com', 'pass', 'Bob');

    expect(mockPost).toHaveBeenCalledWith('/auth/register', { username: 'bob', email: 'b@c.com', password: 'pass', name: 'Bob' }, { skipAuth: true });
    expect(useAuthStore.getState().user?.name).toBe('Bob');
  });

  it('logout should clear state and tokens', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.com', name: 'A', avatarUrl: null }, isAuthenticated: true, isLoading: false });

    useAuthStore.getState().logout();

    expect(mockSetAccessToken).toHaveBeenCalledWith(null);
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('loadUser should fetch user when refreshToken exists', async () => {
    localStorage.setItem('refreshToken', 'refresh-1');
    mockGet.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com', name: 'Alice', avatarUrl: null });

    await useAuthStore.getState().loadUser();

    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(useAuthStore.getState().user?.email).toBe('a@b.com');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('loadUser should set isLoading false when no token', async () => {
    await useAuthStore.getState().loadUser();

    expect(mockGet).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('loadUser should handle API error gracefully', async () => {
    localStorage.setItem('refreshToken', 'refresh-1');
    mockGet.mockRejectedValueOnce(new Error('API Error'));

    await useAuthStore.getState().loadUser();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
