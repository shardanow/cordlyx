import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSavedViews } from '@/hooks/use-saved-views';
import { api } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockedApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const view = {
  id: 'v1',
  name: 'My bugs',
  ownerId: 'u1',
  filters: { typeId: '', statusId: 's1', priorityId: '', assigneeId: '' },
  isShared: false,
  isDefault: false,
  createdAt: new Date().toISOString(),
};

describe('useSavedViews (server-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue([view]);
  });

  it('loads views from the API', async () => {
    const { result } = renderHook(() => useSavedViews('proj'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.savedViews).toHaveLength(1));
    expect(mockedApi.get).toHaveBeenCalledWith('/projects/proj/views');
    expect(result.current.savedViews[0]!.name).toBe('My bugs');
  });

  it('exposes the default view', async () => {
    mockedApi.get.mockResolvedValue([{ ...view, isDefault: true }]);
    const { result } = renderHook(() => useSavedViews('proj'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.defaultView).not.toBeNull());
    expect(result.current.defaultView!.id).toBe('v1');
  });

  it('save/delete/share/default call the API and invalidate', async () => {
    mockedApi.post.mockResolvedValue(view);
    const { result } = renderHook(() => useSavedViews('proj'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.savedViews).toHaveLength(1));

    await act(async () => {
      await result.current.saveView('N', { statusId: 's1' }, true);
    });
    expect(mockedApi.post).toHaveBeenCalledWith('/projects/proj/views', {
      name: 'N',
      filters: { statusId: 's1' },
      isShared: true,
    });

    await act(async () => {
      await result.current.shareView('v1', true);
    });
    expect(mockedApi.patch).toHaveBeenCalledWith('/projects/proj/views/v1', { isShared: true });

    await act(async () => {
      await result.current.setDefaultView('v1');
    });
    expect(mockedApi.post).toHaveBeenCalledWith('/projects/proj/views/v1/set-default');

    await act(async () => {
      await result.current.deleteView('v1');
    });
    expect(mockedApi.delete).toHaveBeenCalledWith('/projects/proj/views/v1');
  });

  it('loadView returns filters', async () => {
    const { result } = renderHook(() => useSavedViews('proj'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.savedViews).toHaveLength(1));
    expect(result.current.loadView(result.current.savedViews[0]!).statusId).toBe('s1');
  });
});
