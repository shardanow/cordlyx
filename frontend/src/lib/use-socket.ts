import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000';

export function useSocket(projectId?: string | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(`${SOCKET_URL}/events`, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });
    }

    const socket = socketRef.current;

    if (projectId) {
      socket.emit('join:project', projectId);
    }

    return () => {
      if (projectId) {
        socket.emit('leave:project', projectId);
      }
    };
  }, [projectId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const invalidate = (...keys: string[][]) => {
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    };

    const onItemCreated = () => invalidate(['items'], ['board']);
    const onItemUpdated = () => invalidate(['items'], ['board']);
    const onItemDeleted = () => invalidate(['items'], ['board']);
    const onCommentCreated = () => invalidate(['comments']);
    const onCommentUpdated = () => invalidate(['comments']);
    const onCommentDeleted = () => invalidate(['comments']);

    socket.on('item:created', onItemCreated);
    socket.on('item:updated', onItemUpdated);
    socket.on('item:deleted', onItemDeleted);
    socket.on('comment:created', onCommentCreated);
    socket.on('comment:updated', onCommentUpdated);
    socket.on('comment:deleted', onCommentDeleted);

    return () => {
      socket.off('item:created', onItemCreated);
      socket.off('item:updated', onItemUpdated);
      socket.off('item:deleted', onItemDeleted);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:updated', onCommentUpdated);
      socket.off('comment:deleted', onCommentDeleted);
    };
  }, [queryClient]);
}
