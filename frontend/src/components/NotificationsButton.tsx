'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    mention: '🔔 mentioned you',
    assigned: '📋 assigned you',
};

export default function NotificationsButton({ collapsed }: { collapsed?: boolean }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    const { data: unread } = useQuery({
        queryKey: ['notifications', 'count'],
        queryFn: async () => {
            const res = await api.get<{ count: number }>('/notifications/unread/count');
            return res.count;
        },
        refetchInterval: 30000,
    });

    const { data: notifications } = useQuery({
        queryKey: ['notifications', 'unread'],
        queryFn: async () => {
            const res = await api.get<Notification[]>('/notifications/unread');
            return res;
        },
        enabled: open,
    });

    const markRead = async (id: string) => {
        await api.patch(`/notifications/${id}/read`, {});
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const markAllRead = async () => {
        await api.patch('/notifications/read-all', {});
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const count = unread ?? 0;

    return (
        <div ref={ref} className="relative">
            {/* Badge dot when collapsed — shown outside the button itself */}
            {collapsed && count > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive z-10" />
            )}
            <button
                onClick={() => setOpen((o) => !o)}
                title={collapsed ? `Notifications${count > 0 ? ` (${count} unread)` : ''}` : undefined}
                className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                    collapsed && 'justify-center px-2',
                )}
                aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
            >
                <Bell className="w-4 h-4 shrink-0" />
                <span className={cn('flex-1 text-left', collapsed && 'hidden')}>Notifications</span>
                {count > 0 && !collapsed && (
                    <span className="text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 font-bold leading-none">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute left-0 bottom-full mb-1 w-80 bg-card border border-border rounded-lg shadow-lg z-[100] overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-border">
                        <Link
                            href="/notifications"
                            onClick={() => setOpen(false)}
                            className="text-sm font-medium hover:text-primary transition-colors"
                        >
                            Notifications
                        </Link>
                        {count > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {!notifications || notifications.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-6">
                                No unread notifications
                            </div>
                        ) : (
                            notifications.map((n) => {
                                const slug = n.data?.projectSlug as string | undefined;
                                const seq = n.data?.itemSequenceNum as number | undefined;
                                const title = n.data?.itemTitle as string | undefined;
                                const href = slug && seq ? `/projects/${slug}/items/${seq}` : null;

                                const card = (
                                    <div className="flex items-start gap-2">
                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">
                                            {n.actor?.name?.charAt(0) ?? '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium">
                                                <span>{n.actor?.name ?? 'Someone'}</span>{' '}
                                                <span className="text-muted-foreground">{TYPE_LABELS[n.type] ?? n.type}</span>
                                            </p>
                                            {title && (
                                                <p className="text-xs text-primary hover:underline mt-0.5 truncate">{title}</p>
                                            )}
                                            {!!n.data?.mention && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {n.data.mention as string}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {new Date(n.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                    </div>
                                );

                                if (href) {
                                    return (
                                        <Link
                                            key={n.id}
                                            href={href}
                                            onClick={() => {
                                                markRead(n.id);
                                                setOpen(false);
                                            }}
                                            className="block w-full text-left px-3 py-2.5 bg-background hover:bg-muted/50 border-b border-border last:border-0 transition"
                                        >
                                            {card}
                                        </Link>
                                    );
                                }

                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => markRead(n.id)}
                                        className="w-full text-left px-3 py-2.5 bg-background hover:bg-muted/50 border-b border-border last:border-0 transition"
                                    >
                                        {card}
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <Link
                        href="/notifications"
                        onClick={() => setOpen(false)}
                        className="block text-center text-xs text-muted-foreground hover:text-foreground py-2 border-t border-border transition-colors"
                    >
                        View all notifications
                    </Link>
                </div>
            )}
        </div>
    );
}
