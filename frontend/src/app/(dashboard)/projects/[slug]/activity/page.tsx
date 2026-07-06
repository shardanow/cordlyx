'use client';

import Link from 'next/link';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface ActivityItem {
  id: string;
  actorId: string;
  itemId: string | null;
  action: string;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  itemTitle: string | null;
  itemSequenceNum: number | null;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

interface ActivityMeta {
  cursor: string | null;
  hasMore: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  'item.created': 'created this item',
  'item.updated': 'updated',
  'item.deleted': 'deleted this item',
  'item.status_changed': 'changed status to',
  'item.assigned': 'assigned',
  'comment.created': 'commented',
  'comment.updated': 'updated a comment',
  'comment.deleted': 'deleted a comment',
  'attachment.created': 'uploaded an attachment',
  'attachment.deleted': 'removed an attachment',
  'relation.created': 'linked',
  'relation.deleted': 'unlinked an item',
  'plan.created': 'created plan',
  'plan.updated': 'updated plan',
  'plan.deleted': 'deleted plan',
  'plan.status_changed': 'changed plan status to',
  'item.vote_added': 'voted for',
  'item.vote_removed': 'removed vote from',
};

const ACTION_OPTIONS = ['', ...Object.keys(ACTION_LABELS)];

type SortOrder = '-created_at' | 'created_at';

export default function ActivityPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: project } = useQuery<{ id: string; name: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sort, setSort] = useState<SortOrder>('-created_at');
  const [cursor, setCursor] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [hasMoreState, setHasMoreState] = useState(true);

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: '20', sort });
    if (filterAction) p.set('action', filterAction);
    if (filterDateFrom) p.set('dateFrom', filterDateFrom);
    if (filterDateTo) p.set('dateTo', filterDateTo);
    return p;
  }, [filterAction, filterDateFrom, filterDateTo, sort]);

  const { isLoading, isFetching, data } = useQuery<{ data: ActivityItem[]; meta: ActivityMeta }>({
    queryKey: ['activity', slug, params.toString()],
    queryFn: () => api.get(`/projects/${slug}/activity?${params.toString()}`),
  });

  const currentActivities = data?.data ?? [];
  const meta = data?.meta;

  const loadMore = useCallback(async () => {
    const cursorVal = cursor || meta?.cursor;
    if (!cursorVal) return;
    const p = new URLSearchParams({ limit: '20', sort, cursor: cursorVal });
    if (filterAction) p.set('action', filterAction);
    if (filterDateFrom) p.set('dateFrom', filterDateFrom);
    if (filterDateTo) p.set('dateTo', filterDateTo);
    try {
      const res = await api.get<{ data: ActivityItem[]; meta: ActivityMeta }>(`/projects/${slug}/activity?${p.toString()}`);
      setActivities((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...res.data.filter((a) => !seen.has(a.id))];
      });
      setCursor(res.meta?.cursor ?? null);
      setHasMoreState(!!res.meta?.cursor);
    } catch {
      // swallow
    }
  }, [slug, meta, sort, filterAction, filterDateFrom, filterDateTo, cursor]);

  const allActivities = (cursor ? activities : currentActivities)
    .filter((item, index, self) => self.findIndex((i) => i.id === item.id) === index);
  const hasMore = cursor || !allActivities.length ? hasMoreState : (meta?.hasMore ?? false);
  const loadingMore = !!(cursor && isFetching);

  const toggleSort = () => {
    setSort((s) => (s === '-created_at' ? 'created_at' : '-created_at'));
    setCursor(null);
    setActivities([]);
    setHasMoreState(true);
  };

  const hasFilters = filterAction || filterDateFrom || filterDateTo || sort !== '-created_at';

  const clearFilters = () => {
    setFilterAction('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSort('-created_at');
    setCursor(null);
    setActivities([]);
    setHasMoreState(true);
  };

  if (isLoading && !data) {
    return <div className="text-muted-foreground">Loading activity...</div>;
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">Activity</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <button
          onClick={toggleSort}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 p-0 cursor-pointer"
        >
          {sort === '-created_at' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {sort === '-created_at' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="w-44">
          <Select value={filterAction} onChange={(v) => { setFilterAction(v); setCursor(null); setActivities([]); }}>
            <SelectTrigger className="h-9 w-full rounded-md text-sm bg-muted/50 border border-border text-muted-foreground">
              {filterAction ? (ACTION_LABELS[filterAction] ?? filterAction) : 'All actions'}
            </SelectTrigger>
            <SelectContent>
              <SelectOption value="">All actions</SelectOption>
              {ACTION_OPTIONS.filter(Boolean).map((a) => (
                <SelectOption key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectOption>
              ))}
            </SelectContent>
          </Select>
        </div>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => { setFilterDateFrom(e.target.value); setCursor(null); setActivities([]); }}
          className="h-9 rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-foreground"
          placeholder="From date"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => { setFilterDateTo(e.target.value); setCursor(null); setActivities([]); }}
          className="h-9 rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-foreground"
          placeholder="To date"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className={`space-y-0 transition-opacity duration-200 ${isFetching && data ? 'opacity-50' : ''}`}>
        {allActivities.map((activity, i) => (
          <div key={activity.id} className="flex gap-3 pb-4 relative">
            {i < allActivities.length - 1 && (
              <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />
            )}

            <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium mt-0.5 z-10">
              {activity.actor?.name?.charAt(0) ?? '?'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <span className="font-medium">{activity.actor?.name ?? 'Unknown'}</span>{' '}
                <span className="text-muted-foreground">
                  {ACTION_LABELS[activity.action] ?? activity.action}
                </span>
                {activity.fieldName && (
                  <span className="text-muted-foreground"> {activity.fieldName.replace(/_/g, ' ')}</span>
                )}
                {activity.oldValue != null && typeof activity.oldValue !== 'object' && (
                  <span className="text-muted-foreground line-through"> {String(activity.oldValue)}</span>
                )}
                {activity.newValue != null && typeof activity.newValue !== 'object' && (
                  activity.action === 'relation.created' && activity.metadata?.targetItemSequenceNum != null
                    ? (
                      <Link
                        href={`/projects/${slug}/items/${activity.metadata.targetItemSequenceNum}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {' '}{String(activity.newValue)}
                      </Link>
                    )
                    : (
                      <span className="font-medium"> {String(activity.newValue)}</span>
                    )
                )}
                {activity.itemTitle && activity.itemSequenceNum != null && (
                  <>
                    <span className="text-muted-foreground"> — </span>
                    <Link
                      href={`/projects/${slug}/items/${activity.itemSequenceNum}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {activity.itemTitle}
                    </Link>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(activity.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {allActivities.length === 0 && (
          <div className="text-sm text-muted-foreground">No activity found.</div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="h-9 px-4 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
