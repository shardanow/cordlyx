'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Bell, CheckCheck } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  projectId: string;
  itemId: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = {
  mention: 'mentioned you',
  assigned: 'assigned you',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [cursor, setCursor] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<Notification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPage = async (c: string | null, isFresh: boolean) => {
    setLoading(true);
    try {
      if (filter === 'unread') {
        const result = await api.get<Notification[]>('/notifications/unread');
        setAllItems(result);
        setHasMore(false);
      } else {
        const params = new URLSearchParams({ limit: '30' });
        if (c) params.set('cursor', c);
        const result = await api.get<{ data: Notification[]; meta: { cursor: string | null; hasMore: boolean } }>(`/notifications?${params.toString()}`);
        setAllItems((prev) => isFresh ? result.data : [...prev, ...result.data]);
        setCursor(result.meta?.cursor ?? null);
        setHasMore(result.meta?.hasMore ?? false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    setAllItems([]);
    setCursor(null);
    setHasMore(false);
    fetchPage(null, true);
  }, [filter]);

  const handleFilterChange = (f: 'all' | 'unread') => {
    setFilter(f);
  };

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/notifications/unread/count');
      return res.count;
    },
    refetchInterval: 30000,
  });

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`, {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all', {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const notifications = allItems;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount ?? 0} unread
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => handleFilterChange('unread')}
              className={`px-3 py-1.5 transition-colors ${filter === 'unread' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Unread
            </button>
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-3 py-1.5 transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              All
            </button>
          </div>
          {unreadCount && unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Bell className="w-10 h-10" />
          <p className="text-sm font-medium">No notifications</p>
          <p className="text-xs">
            {filter === 'unread' ? 'You\'re all caught up!' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border">
          {notifications.map((n) => {
            const slug = n.data?.projectSlug as string | undefined;
            const seq = n.data?.itemSequenceNum as number | undefined;
            const title = n.data?.itemTitle as string | undefined;
            const href = slug && seq ? `/projects/${slug}/items/${seq}` : null;

            const card = (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                  {n.actor?.name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{n.actor?.name ?? 'Someone'}</span>{' '}
                    <span className="text-muted-foreground">{TYPE_LABELS[n.type] ?? n.type}</span>
                  </p>
                  {title && (
                    <p className="text-sm text-primary mt-0.5">{title}</p>
                  )}
                  {!!n.data?.mention && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {n.data.mention as string}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {!n.readAt && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  <button
                    onClick={(e) => { e.preventDefault(); markRead(n.id); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wide"
                  >
                    {n.readAt ? 'Read' : 'Mark read'}
                  </button>
                </div>
              </div>
            );

            if (href) {
              return (
                <Link
                  key={n.id}
                  href={href}
                  className={`block transition-colors hover:bg-muted/50 ${!n.readAt ? 'bg-primary/5' : ''}`}
                >
                  {card}
                </Link>
              );
            }

            return (
              <div
                key={n.id}
                className={`transition-colors ${!n.readAt ? 'bg-primary/5' : ''}`}
              >
                {card}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => fetchPage(cursor, false)}
          disabled={loading}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-3 rounded-lg border border-border transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
