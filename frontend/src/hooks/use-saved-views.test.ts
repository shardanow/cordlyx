import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSavedViews } from '@/hooks/use-saved-views';

const projectId = 'test-project';

describe('useSavedViews', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return empty array when no views saved', () => {
    const { result } = renderHook(() => useSavedViews(projectId));
    expect(result.current.savedViews).toEqual([]);
  });

  it('should save a view and persist to localStorage', () => {
    const { result } = renderHook(() => useSavedViews(projectId));

    act(() => {
      result.current.saveView('My bugs', {
        typeId: '',
        statusId: 'status-1',
        priorityId: '',
        assigneeId: '',
      });
    });

    expect(result.current.savedViews.length).toBe(1);
    expect(result.current.savedViews[0]!.name).toBe('My bugs');
    expect(result.current.savedViews[0]!.filters.statusId).toBe('status-1');

    // Check localStorage
    const stored = localStorage.getItem(`cordlyx:saved-views:${projectId}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBe(1);
  });

  it('should delete a view', () => {
    const { result } = renderHook(() => useSavedViews(projectId));

    // First save
    act(() => {
      result.current.saveView('Test', { typeId: '', statusId: '', priorityId: '', assigneeId: '' });
    });

    const viewId = result.current.savedViews[0]!.id;

    // Then delete
    act(() => {
      result.current.deleteView(viewId);
    });

    expect(result.current.savedViews.length).toBe(0);
  });

  it('should load a view and return filters', () => {
    const { result } = renderHook(() => useSavedViews(projectId));

    act(() => {
      result.current.saveView('Loaded view', { typeId: 'type-1', statusId: 'status-2', priorityId: '', assigneeId: '' });
    });

    const view = result.current.savedViews[0]!;
    const filters = result.current.loadView(view);

    expect(filters.typeId).toBe('type-1');
    expect(filters.statusId).toBe('status-2');
  });

  it('should persist views across hook instances', () => {
    // First instance saves
    const { result: result1 } = renderHook(() => useSavedViews(projectId));

    act(() => {
      result1.current.saveView('Persisted', { typeId: '', statusId: 's1', priorityId: '', assigneeId: '' });
    });

    // New instance should see the saved view
    const { result: result2 } = renderHook(() => useSavedViews(projectId));
    expect(result2.current.savedViews.length).toBe(1);
    expect(result2.current.savedViews[0]!.name).toBe('Persisted');
  });

  it('should not share views between different projects', () => {
    const { result: r1 } = renderHook(() => useSavedViews('proj-1'));
    const { result: r2 } = renderHook(() => useSavedViews('proj-2'));

    act(() => {
      r1.current.saveView('Proj1 view', { typeId: '', statusId: '', priorityId: '', assigneeId: '' });
      r2.current.saveView('Proj2 view', { typeId: '', statusId: '', priorityId: '', assigneeId: '' });
    });

    expect(r1.current.savedViews.length).toBe(1);
    expect(r1.current.savedViews[0]!.name).toBe('Proj1 view');
    expect(r2.current.savedViews.length).toBe(1);
    expect(r2.current.savedViews[0]!.name).toBe('Proj2 view');
  });
});