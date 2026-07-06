'use client';

import { useState, useEffect, useCallback } from 'react';

interface SavedView {
  id: string;
  name: string;
  filters: {
    typeId: string;
    statusId: string;
    priorityId: string;
    assigneeId: string;
  };
}

const STORAGE_KEY = 'cordlyx:saved-views:';

export function useSavedViews(projectId: string) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}${projectId}`);
      if (stored) {
        setSavedViews(JSON.parse(stored));
      }
    } catch {
      setSavedViews([]);
    }
  }, [projectId]);

  const saveView = useCallback(
    (name: string, filters: SavedView['filters']) => {
      const newView: SavedView = {
        id: crypto.randomUUID(),
        name,
        filters,
      };
      setSavedViews((prev) => {
        const updated = [...prev, newView];
        localStorage.setItem(`${STORAGE_KEY}${projectId}`, JSON.stringify(updated));
        return updated;
      });
    },
    [projectId],
  );

  const deleteView = useCallback(
    (id: string) => {
      setSavedViews((prev) => {
        const updated = prev.filter((v) => v.id !== id);
        localStorage.setItem(`${STORAGE_KEY}${projectId}`, JSON.stringify(updated));
        return updated;
      });
    },
    [projectId],
  );

  const loadView = useCallback(
    (view: SavedView) => {
      return view.filters;
    },
    [],
  );

  return { savedViews, saveView, deleteView, loadView };
}