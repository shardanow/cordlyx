'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface SavedView {
  id: string;
  name: string;
  ownerId: string;
  filters: {
    typeId?: string;
    statusId?: string;
    priorityId?: string;
    assigneeId?: string;
    planId?: string;
    search?: string;
  };
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Server-backed saved views (personal + shared with the project).
 * Same action names as the old localStorage hook; data now lives in the API.
 */
export function useSavedViews(slug: string | undefined) {
  const queryClient = useQueryClient();
  const { data } = useQuery<SavedView[]>({
    queryKey: ['views', slug],
    queryFn: () => api.get(`/projects/${slug}/views`),
    enabled: !!slug,
  });
  const savedViews = data ?? [];
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['views', slug] }),
    [queryClient, slug],
  );

  const saveView = useCallback(
    async (name: string, filters: SavedView['filters'], isShared = false) => {
      const created = await api.post<SavedView>(`/projects/${slug}/views`, { name, filters, isShared });
      await invalidate();
      return created;
    },
    [slug, invalidate],
  );

  const deleteView = useCallback(
    async (id: string) => {
      await api.delete(`/projects/${slug}/views/${id}`);
      await invalidate();
    },
    [slug, invalidate],
  );

  const shareView = useCallback(
    async (id: string, isShared: boolean) => {
      await api.patch(`/projects/${slug}/views/${id}`, { isShared });
      await invalidate();
    },
    [slug, invalidate],
  );

  const setDefaultView = useCallback(
    async (id: string) => {
      await api.post(`/projects/${slug}/views/${id}/set-default`);
      await invalidate();
    },
    [slug, invalidate],
  );

  const loadView = useCallback((view: SavedView) => view.filters, []);

  const defaultView = savedViews.find((v) => v.isDefault) ?? null;

  return { savedViews, defaultView, saveView, deleteView, shareView, setDefaultView, loadView };
}
