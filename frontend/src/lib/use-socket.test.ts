import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockEmit = vi.fn();
const mockIo = vi.fn(() => ({
  on: mockOn,
  off: mockOff,
  emit: mockEmit,
}));

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

const mockQueryClient = { invalidateQueries: vi.fn() };

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

const { useSocket } = await import('./use-socket');

describe('useSocket', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockOff.mockClear();
    mockEmit.mockClear();
    mockQueryClient.invalidateQueries.mockClear();
    mockIo.mockClear();
  });

  it('should connect to socket on mount', () => {
    renderHook(() => useSocket());
    expect(mockIo).toHaveBeenCalledWith(
      expect.stringContaining('/events'),
      expect.objectContaining({ withCredentials: true }),
    );
  });

  it('should join project room when projectId is provided', () => {
    renderHook(() => useSocket('proj-1'));
    expect(mockEmit).toHaveBeenCalledWith('join:project', 'proj-1');
  });

  it('should not join when projectId is null', () => {
    renderHook(() => useSocket(null));
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should register event listeners on mount', () => {
    renderHook(() => useSocket('proj-1'));
    expect(mockOn).toHaveBeenCalledWith('item:created', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('item:updated', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('item:deleted', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('comment:created', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('comment:updated', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('comment:deleted', expect.any(Function));
  });

  it('should invalidate queries on item event', () => {
    renderHook(() => useSocket('proj-1'));

    // Find the handler for item:created and call it
    const createdHandler = mockOn.mock.calls.find((c) => c[0] === 'item:created')![1];
    createdHandler();
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items'] });
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['board'] });
  });

  it('should invalidate queries on comment event', () => {
    renderHook(() => useSocket('proj-1'));

    const createdHandler = mockOn.mock.calls.find((c) => c[0] === 'comment:created')![1];
    createdHandler();
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['comments'] });
  });

  it('should leave project room on unmount when projectId provided', () => {
    const { unmount } = renderHook(() => useSocket('proj-1'));
    unmount();
    expect(mockEmit).toHaveBeenCalledWith('leave:project', 'proj-1');
  });

  it('should not leave project room on unmount when no projectId', () => {
    const { unmount } = renderHook(() => useSocket());
    unmount();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
