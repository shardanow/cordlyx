import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';

/** Matches EventsGateway namespace + join/leave protocol on the backend. */
export const SOCKET_NAMESPACE = '/events';

function resolveSocketUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const base = api.replace(/\/api\/v1\/?$/, '');
  if (base && /^https?:\/\//.test(base)) return base;
  if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
    return window.location.origin;
  }
  return 'http://localhost:4000';
}

export function useSocket(projectId?: string | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(`${resolveSocketUrl()}${SOCKET_NAMESPACE}`, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });
    }

    const socket = socketRef.current;

    if (projectId) {
      socket.emit('join', { projectId, userId });
    }

    return () => {
      if (projectId) {
        socket.emit('leave', { projectId });
      }
    };
  }, [projectId, userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const invalidate = (...keys: string[][]) => {
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    };

    const onItemChanged = () =>
      invalidate(['items'], ['item'], ['board'], ['stats'], ['activity'], ['item-activity']);
    const onCommentChanged = () => invalidate(['comments']);

    socket.on('item:created', onItemChanged);
    socket.on('item:updated', onItemChanged);
    socket.on('item:deleted', onItemChanged);
    socket.on('comment:created', onCommentChanged);
    socket.on('comment:updated', onCommentChanged);
    socket.on('comment:deleted', onCommentChanged);

    return () => {
      socket.off('item:created', onItemChanged);
      socket.off('item:updated', onItemChanged);
      socket.off('item:deleted', onItemChanged);
      socket.off('comment:created', onCommentChanged);
      socket.off('comment:updated', onCommentChanged);
      socket.off('comment:deleted', onCommentChanged);
    };
  }, [queryClient]);
}
