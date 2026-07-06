import { create } from 'zustand';
import { api, setAccessToken, refreshAccessToken } from '@/lib/api-client';
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
    setAccessToken(null);
    setRefreshCookie(null);
    localStorage.removeItem('refreshToken');
    queryClient.clear();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem('refreshToken');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Try to get a fresh access token before hitting /users/me
      await refreshAccessToken();
      const user = await api.get<{ id: string; email: string; name: string; avatarUrl: string | null }>('/users/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
