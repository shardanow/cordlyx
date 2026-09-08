const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

let accessToken: string | null = null;
// Singleton refresh promise — deduplicates concurrent refresh calls
let refreshingPromise: Promise<string | null> | null = null;

/** Called when the session is dead (refresh failed). Overridable in tests. */
let onUnauthorized: () => void = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

function storedRefreshToken(): string | null {  try {
    return (
      localStorage.getItem('refreshToken') ??
      document.cookie
        .split('; ')
        .find((c) => c.startsWith('refreshToken='))
        ?.slice('refreshToken='.length) ??
      null
    );
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return storedRefreshToken();
}

async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefreshToken() }),
    });

    if (!res.ok) {
      setAccessToken(null);
      try {
        localStorage.removeItem('refreshToken');
      } catch {
        // ignore storage errors
      }
      onUnauthorized();
      return null;
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken as string;
  } finally {
    refreshingPromise = null;
  }
}

async function refreshToken(): Promise<string | null> {
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = doRefresh();
  return refreshingPromise;
}

export async function refreshAccessToken(): Promise<string | null> {
  return refreshToken();
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!options.skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && !options.skipAuth) {
    const newToken = await refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, credentials: 'include' });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(err.message ?? 'Request failed', res.status, err.details);
  }

  // 204/empty bodies have no JSON to parse (e.g. DELETE account/project).
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// Convenience methods
export const api = {
  get: <T>(path: string, opts?: RequestOptions) => apiClient<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiClient<T>(path, { ...opts, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiClient<T>(path, { ...opts, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiClient<T>(path, { ...opts, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    apiClient<T>(path, { ...opts, method: 'DELETE' }),
};
