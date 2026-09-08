import { create } from 'zustand';
import { api, setAccessToken, getAccessToken, getRefreshToken, refreshAccessToken } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

function setRefreshCookie(token: string | null) {
  if (token) {
    document.cookie = `refreshToken=${token}; path=/; max-age=604800; samesite=lax`;
  } else {
    document.cookie = 'refreshToken=; path=/; max-age=0';
  }
}

interface AuthState {
  user: { id: string; email: string; name: string; avatarUrl: string | null } | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (login, password) => {
    const data = await api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/login',
      { login, password },
      { skipAuth: true },
    );
    setAccessToken(data.accessToken);
    setRefreshCookie(data.refreshToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    queryClient.clear();
    await useAuthStore.getState().loadUser();
  },

  register: async (username, email, password, name) => {
    const data = await api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/register',
      { username, email, password, name },
      { skipAuth: true },
    );
    setAccessToken(data.accessToken);
    setRefreshCookie(data.refreshToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    queryClient.clear();
    await useAuthStore.getState().loadUser();
  },

  logout: () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Best-effort server-side revoke; never blocks local logout.
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    setAccessToken(null);
    setRefreshCookie(null);
    try {
      localStorage.removeItem('refreshToken');
    } catch {
      // ignore storage errors
    }
    queryClient.clear();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      if (!getRefreshToken()) {
        set({ isLoading: false });
        return;
      }
      // Skip rotation when we already hold a fresh access token (e.g. right after login).
      if (!getAccessToken()) {
        await refreshAccessToken();
      }
      const user = await api.get<{ id: string; email: string; name: string; avatarUrl: string | null }>('/users/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
