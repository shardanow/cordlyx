'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useSavedViews } from '@/hooks/use-saved-views';
import { useEscToClose } from '@/hooks/use-esc-to-close';
import { getAccessToken } from '@/lib/api-client';
import { toast } from 'sonner';
import QuickCreateModal from '@/components/QuickCreateModal';
import ImportItemsModal from '@/components/ImportItemsModal';
import Spinner from '@/components/Spinner';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { TypeBadge } from '@/components/features/TypeBadge';
import { StatusDot } from '@/components/features/StatusDot';
import { AssigneePicker } from '@/components/features/AssigneePicker';
import { FilterBar } from '@/components/features/FilterBar';
import { Pagination } from '@/components/features/Pagination';
import { TagChip } from '@/components/features/Chips';
import { TreeChildren } from '@/components/features/TreeChildren';
import { bodyExcerpt } from '@/lib/markdown';
import { useProjectData } from '@/lib/project-data';
import { AvatarCircle } from '@/components/features/AvatarCircle';
import { TypeIcon } from '@/components/features/TypeIcon';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { Target } from 'lucide-react';
import {
  Search, Flag, User, Calendar, Plus,
  RotateCcw, Bookmark, ChevronDown, ChevronRight as ChevronRightIcon,
  CircleDot, ListTodo, Trash2, ArrowUp, ArrowDown,
} from 'lucide-react';

interface Tag {
  id: string; name: string; color: string | null;
}

interface Item {
  id: string;
  sequenceNum: number;
  title: string;
  typeId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  parentId: string | null;
  planId: string | null;
  description: string | null;
  createdAt: string;
  tags?: Tag[];
}

interface Project {
  id: string; name: string; slug: string;
}

type EditField = { itemId: string; field: 'statusId' | 'priorityId' | 'assigneeId' } | null;
type SortValue = '-created_at' | 'created_at' | '-priority' | 'priority' | '-updated_at' | 'updated_at' | '-status' | 'status' | '-assignee' | 'assignee';

export default function ProjectItemsPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [edit, setEdit] = useState<EditField>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEscToClose(() => setShowSaveModal(false), showSaveModal);

  const { savedViews, defaultView, saveView, deleteView, shareView, setDefaultView, loadView } = useSavedViews(slug!);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortValue>('-created_at');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [viewMode, setViewMode] = useState<'flat' | 'tree' | 'group'>('flat');
  const [groupBy, setGroupBy] = useState<'status' | 'type' | 'assignee' | 'plan' | 'tag'>('status');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setExpanded(new Set());
  }, [debouncedSearch, filterType, filterStatus, filterPriority, filterAssignee, filterPlan, filterTags, sort, viewMode, groupBy]);

  const currentFilters = {
    search: debouncedSearch,
    typeId: filterType,
    statusId: filterStatus,
    priorityId: filterPriority,
    assigneeId: filterAssignee,
    planId: filterPlan,
    tagIds: filterTags,
    sort,
  };

  const handleSaveView = async () => {
    if (!saveViewName.trim()) return;
    try {
      await saveView(saveViewName.trim(), currentFilters);
      setSaveViewName('');
      setShowSaveModal(false);
      toast.success('View saved');
    } catch {
      toast.error('Failed to save view');
    }
  };

  const handleLoadView = (view: typeof savedViews[0]) => {
    const f = loadView(view);
    setFilterType(f.typeId ?? '');
    setFilterStatus(f.statusId ?? '');
    setFilterPriority(f.priorityId ?? '');
    setFilterAssignee(f.assigneeId ?? '');
    setFilterPlan(f.planId ?? '');
    setFilterTags(f.tagIds ?? []);
    if (f.sort) setSort(f.sort as SortValue);
    setSearch(f.search ?? '');
    setDebouncedSearch(f.search ?? '');
    setActiveTab(view.id);
  };

  // Apply the project default view once (unless the user already filtered).
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (defaultApplied.current || !defaultView) return;
    defaultApplied.current = true;
    if (!hasFilters) handleLoadView(defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView]);

  const handleDeleteView = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteView(id);
      if (activeTab === id) setActiveTab('all');
    } catch {
      toast.error('Failed to delete view');
    }
  };

  const handleShareView = async (e: React.MouseEvent, view: typeof savedViews[0]) => {
    e.stopPropagation();
    try {
      await shareView(view.id, !view.isShared);
      toast.success(view.isShared ? 'View is now private' : 'View shared with the project');
    } catch {
      toast.error('Failed to update view');
    }
  };

  const handleDefaultView = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await setDefaultView(id);
      toast.success('Default view updated');
    } catch {
      toast.error('Only project admins can set the default view');
    }
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'all') {
      setFilterType(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setFilterPlan(''); setFilterTags([]);
    } else if (tab === 'my') {
      setFilterType(''); setFilterStatus(''); setFilterPriority('');
      setFilterAssignee(currentUser?.id ?? '');
    }
  };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setFilterType(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setFilterPlan(''); setFilterTags([]);
    setActiveTab('all');
    searchRef.current?.focus();
  };

  const hasFilters = Boolean(search || filterType || filterStatus || filterPriority || filterAssignee || filterPlan || filterTags.length);

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: String(limit), page: String(page), sort });
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (filterType) p.set('typeId', filterType);
    if (filterStatus) p.set('statusId', filterStatus);
    if (filterPriority) p.set('priorityId', filterPriority);
    if (filterAssignee) p.set('assigneeId', filterAssignee);
    if (filterPlan) p.set('planId', filterPlan);
    if (filterTags.length) p.set('tagIds', filterTags.join(','));
    return p;
  }, [debouncedSearch, filterType, filterStatus, filterPriority, filterAssignee, filterPlan, filterTags, sort, page, limit]);

  const { data: project } = useQuery<Project>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data, isLoading, isFetching } = useQuery<{ data: Item[]; meta: { cursor: string | null; hasMore: boolean; total?: number; page?: number; totalPages?: number; limit: number } }>({
    queryKey: ['items', slug, params.toString()],
    queryFn: () => api.get(`/projects/${slug}/items?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });
  // Background refetch (filter/search/page change) keeps stale rows visible —
  // dim them + show "Updating" so the wait has visible feedback.
  const refreshing = isFetching && !!data;

  const { types, statuses, priorities, members, plans, tags } = useProjectData(slug);
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const currentPage = data?.meta?.page ?? page;

  const handleUpdate = async (itemId: string, field: string, value: string | null) => {
    try {
      await api.patch(`/projects/${slug}/items/${itemId}`, { [field]: value });
      queryClient.invalidateQueries({ queryKey: ['items', slug] });
    } catch {
      toast.error('Update failed');
    }
    setEdit(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await api.delete(`/projects/${slug}/items/${itemId}`);
      queryClient.invalidateQueries({ queryKey: ['items', slug] });
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleSort = (field: SortValue) => {
    if (sort === field) {
      const opposite: Record<string, SortValue> = {
        '-created_at': 'created_at',
        'created_at': '-created_at',
        '-priority': 'priority',
        'priority': '-priority',
        '-status': 'status',
        'status': '-status',
        '-assignee': 'assignee',
        'assignee': '-assignee',
      };
      setSort(opposite[field]);
    } else {
      setSort(field);
    }
  };

  const items = data?.data ?? [];

  // Children counts for Tree expand chevrons (single batched request per page).
  const visibleIds = useMemo(() => items.map((i) => i.id), [data]);
  const { data: childrenCountsData } = useQuery<{ data: Record<string, number> }>({
    queryKey: ['children-counts', slug, visibleIds.join(',')],
    queryFn: () =>
      visibleIds.length
        ? api.get(`/projects/${slug}/items/meta/children-counts?ids=${visibleIds.join(',')}`)
        : Promise.resolve({ data: {} }),
    enabled: viewMode === 'tree' && visibleIds.length > 0,
    placeholderData: (prev) => prev,
  });
  const childrenCounts: Record<string, number> = childrenCountsData?.data ?? {};

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayGroups = useMemo(() => {
    if (viewMode !== 'group') return null;
    const groups = new Map<string, { label: string; color?: string | null; items: typeof items }>();
    const keyOf = (item: (typeof items)[0]) => {
      if (groupBy === 'status') {
        const s = statuses.find((x) => x.id === item.statusId);
        return { key: item.statusId, label: s?.name ?? 'No status', color: s?.color };
      }
      if (groupBy === 'type') {
        const t = types.find((x) => x.id === item.typeId);
        return { key: item.typeId, label: t?.name ?? 'No type', color: t?.color };
      }
      if (groupBy === 'assignee') {
        const m = members.find((x) => x.userId === item.assigneeId);
        return { key: item.assigneeId ?? 'unassigned', label: m?.name ?? 'Unassigned' };
      }
      if (groupBy === 'plan') {
        const p = plans.find((x) => x.id === item.planId);
        return { key: item.planId ?? 'no-plan', label: p?.name ?? 'No plan / sprint', color: p?.color };
      }
      const firstTag = (item.tags ?? [])[0];
      return { key: firstTag?.id ?? 'untagged', label: firstTag?.name ?? 'Untagged', color: firstTag?.color };
    };
    for (const it of items) {
      const g = keyOf(it);
      if (!groups.has(g.key)) groups.set(g.key, { label: g.label, color: g.color, items: [] });
      groups.get(g.key)!.items.push(it);
    }
    return [...groups.entries()];
  }, [viewMode, groupBy, items, statuses, types, members, plans]);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-4 w-48 rounded bg-muted animate-pulse" />
      <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
      <div className="h-4 w-36 rounded bg-muted animate-pulse" />
      <div className="h-14 rounded-lg bg-muted animate-pulse" />
      <div className="h-12 rounded-lg bg-muted animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );

  const sortArrow = (active: boolean, asc: boolean) => {
    if (!active) return null;
    return asc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
  };

  return (
    <div>
      {/* Breadcrumbs + Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
          <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">{project?.name ?? slug}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project?.name ?? slug}</h1>
            <p className="text-base md:text-lg text-muted-foreground inline-flex items-center gap-2">
              {total} items in this project
              {hasFilters && items.length !== total && (
                <span> · showing {items.length} on this page</span>
              )}
              {refreshing && (
                <span className="inline-flex items-center gap-1.5 text-sm" role="status">
                  <Spinner size="sm" />
                  Updating…
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSaveModal(true)}
              className="h-[46px] md:h-[50px] px-4 md:px-5 rounded-[10px] border border-border bg-card text-sm font-bold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2.5"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">Save view</span>
            </button>
            <button
              onClick={async () => {
                try {
                  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
                  const token = getAccessToken();
                  const res = await fetch(`${baseUrl}/projects/${slug}/items/export?format=csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                  if (!res.ok) throw new Error('Export failed');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${slug}-items.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch { toast.error('Export failed'); }
              }}
              className="h-[46px] md:h-[50px] px-4 md:px-5 rounded-[10px] border border-border bg-card text-sm font-bold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2.5"
            >
              Export CSV
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="h-[46px] md:h-[50px] px-4 md:px-5 rounded-[10px] border border-border bg-card text-sm font-bold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2.5"
            >
              Import
            </button>
            <button
              onClick={() => setQuickCreateOpen(true)}
              className="h-[46px] md:h-[50px] px-5 md:px-6 rounded-[10px] bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2.5"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Create item</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save View Modal */}
      {showSaveModal && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onPointerDown={() => setShowSaveModal(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-3">Save current filter view</h3>
            <input
              type="text"
              placeholder="View name (e.g., 'My bugs')"
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              autoFocus
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mb-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={() => setShowSaveModal(false)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => void handleSaveView()} disabled={!saveViewName.trim()} className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50">Save</button>
            </div>
            {savedViews.length > 0 && (
              <>
                <h4 className="text-xs font-bold text-muted-foreground mb-2">Saved views</h4>
                <div className="space-y-1">
                  {savedViews.map((view) => (
                    <div key={view.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                      <span className="flex-1 truncate font-medium">{view.name}</span>
                      {view.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">default</span>
                      )}
                      {view.isShared && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">shared</span>
                      )}
                      <button
                        onClick={(e) => void handleShareView(e, view)}
                        title={view.isShared ? 'Make private' : 'Share with project'}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {view.isShared ? 'Unshare' : 'Share'}
                      </button>
                      {!view.isDefault && (
                        <button
                          onClick={(e) => void handleDefaultView(e, view.id)}
                          title="Set as project default (admin)"
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Default
                        </button>
                      )}
                      <button
                        onClick={(e) => void handleDeleteView(e, view.id)}
                        className="text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* View tabs */}
      <div className="bg-card border border-border rounded-[14px] mb-4 md:mb-5">
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
          <button
            onClick={() => handleTabClick('all')}
            className={`h-10 px-4 rounded-[10px] text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
          >
            All Items
          </button>
          {currentUser && (
            <button
              onClick={() => handleTabClick('my')}
              className={`h-10 px-4 rounded-[10px] text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'my' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              My items
            </button>
          )}
          {savedViews.map((view) => (
            <button
              key={view.id}
              onClick={() => handleLoadView(view)}
              className={`h-10 px-4 rounded-[10px] text-sm font-bold whitespace-nowrap transition-colors inline-flex items-center gap-2 ${activeTab === view.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              {view.name}
              {view.isShared && <span className="text-[9px] px-1 rounded bg-muted font-bold">shared</span>}
              <span
                onClick={(e) => void handleDeleteView(e, view.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleDeleteView(e as any, view.id); }}
                role="button"
                tabIndex={0}
                className="text-muted-foreground hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
              >✕</span>
            </button>
          ))}
          <div className="flex-1" />
        </div>
      </div>

      <FilterBar
        values={{ search, debouncedSearch, typeId: filterType, statusId: filterStatus, priorityId: filterPriority, assigneeId: filterAssignee, planId: filterPlan, tagIds: filterTags }}
        onSearch={setSearch}
        onClearSearch={() => { setSearch(''); setDebouncedSearch(''); searchRef.current?.focus(); }}
        onChange={(patch) => {
          if (patch.typeId !== undefined) setFilterType(patch.typeId);
          if (patch.statusId !== undefined) setFilterStatus(patch.statusId);
          if (patch.priorityId !== undefined) setFilterPriority(patch.priorityId);
          if (patch.assigneeId !== undefined) setFilterAssignee(patch.assigneeId);
          if (patch.planId !== undefined) setFilterPlan(patch.planId);
          if (patch.tagIds !== undefined) setFilterTags(patch.tagIds);
        }}
        data={{ types, statuses, priorities, members, plans, tags }}
        layout="grid"
        searchRef={searchRef}
        trailing={hasFilters ? (
          <button
            onClick={clearFilters}
            className="h-[50px] inline-flex items-center gap-2 px-3 rounded-[10px] text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Reset</span>
          </button>
        ) : undefined}
      />

      {/* View mode: flat list, hierarchy tree (parentId), or grouping */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-[10px] border border-border bg-card p-1">
          {(['flat', 'tree', 'group'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`h-9 px-4 rounded-lg text-sm font-bold capitalize transition-colors ${viewMode === m ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {m === 'flat' ? 'List' : m === 'tree' ? 'Tree' : 'Group'}
            </button>
          ))}
        </div>
        {viewMode === 'group' && (
          <Select value={groupBy} onChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm font-bold">
              Group by: {groupBy}
            </SelectTrigger>
            <SelectContent>
              <SelectOption value="status">Status</SelectOption>
              <SelectOption value="type">Type</SelectOption>
              <SelectOption value="assignee">Assignee</SelectOption>
              <SelectOption value="plan">Plan / Sprint</SelectOption>
              <SelectOption value="tag">Tag</SelectOption>
            </SelectContent>
          </Select>
        )}
        {viewMode === 'tree' && (
          <span className="text-sm text-muted-foreground">Nested by parent — expand rows to load children.</span>
        )}
      </div>

      <div className="overflow-x-auto">
        {/* List header (desktop only) — sortable */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(280px,1fr)_130px_130px_160px_120px_42px] xl:grid-cols-[minmax(360px,1fr)_150px_150px_190px_150px_42px] gap-3 xl:gap-4 px-4 xl:px-5 pb-2 text-base text-muted-foreground font-medium">
        <div>Item</div>
        <div>
          <button
            onClick={() => toggleSort('-status')}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0 font-medium text-muted-foreground"
          >
            Status
            {sortArrow(sort === '-status' || sort === 'status', sort === 'status')}
          </button>
        </div>
        <div>
          <button
            onClick={() => toggleSort('-priority')}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0 font-medium text-muted-foreground"
          >
            Priority
            {sortArrow(sort === '-priority' || sort === 'priority', sort === 'priority')}
          </button>
        </div>
        <div>
          <button
            onClick={() => toggleSort('-assignee')}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0 font-medium text-muted-foreground"
          >
            Assignee
            {sortArrow(sort === '-assignee' || sort === 'assignee', sort === 'assignee')}
          </button>
        </div>
        <div>
          <button
            onClick={() => toggleSort('-created_at')}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0 font-medium text-muted-foreground"
          >
            Created
            {sortArrow(sort === '-created_at' || sort === 'created_at', sort === 'created_at')}
          </button>
        </div>
        <div />
      </div>

      {/* Items list */}
      <div
        className={`space-y-3 transition-opacity duration-200 ${refreshing ? 'opacity-60' : ''}`}
        aria-busy={refreshing}
      >
        {(viewMode === 'group' ? (displayGroups?.flatMap(([, g]) => g.items) ?? items) : items).map((item, idx, arr) => {
          const groupHeader = (() => {
            if (viewMode !== 'group' || !displayGroups) return null;
            const labelOf = (it: typeof item) => {
              if (groupBy === 'status') return statuses.find((x) => x.id === it.statusId)?.name ?? 'No status';
              if (groupBy === 'type') return types.find((x) => x.id === it.typeId)?.name ?? 'No type';
              if (groupBy === 'assignee') return members.find((x) => x.userId === it.assigneeId)?.name ?? 'Unassigned';
              if (groupBy === 'plan') return plans.find((x) => x.id === it.planId)?.name ?? 'No plan / sprint';
              return (it.tags ?? [])[0]?.name ?? 'Untagged';
            };
            const prev = idx > 0 ? labelOf(arr[idx - 1]) : null;
            const cur = labelOf(item);
            if (prev === cur) return null;
            const count = arr.filter((x) => labelOf(x) === cur).length;
            return (
              <div className="flex items-center gap-2 pt-2 first:pt-0">
                <span className="text-sm font-bold">{cur}</span>
                <span className="text-xs text-muted-foreground">· {count} on this page</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          })();
          const row = (() => {
          const type = types?.find((t) => t.id === item.typeId);
          const status = statuses?.find((s) => s.id === item.statusId);
          const priority = priorities?.find((p) => p.id === item.priorityId);
          const assignee = members?.find((m) => m.userId === item.assigneeId);
          const plan = plans?.find((p) => p.id === item.planId);

          const rowContent = (content: React.ReactNode) => (
            <div
              className="bg-card border border-border rounded-[11px] transition-all hover:bg-muted/20 hover:border-border"
              style={type?.color ? {
                borderLeft: `3px solid ${type.color}`,
                paddingLeft: '0',
              } : undefined}
            >
              {content}
            </div>
          );

          return (
            <div key={item.id}>
              {/* Desktop layout */}
              <div
                className="hidden lg:grid lg:grid-cols-[minmax(280px,1fr)_130px_130px_160px_120px_42px] xl:grid-cols-[minmax(360px,1fr)_150px_150px_190px_150px_42px] gap-3 xl:gap-4 items-center px-4 xl:px-5 py-3 min-h-[80px] xl:min-h-[90px] bg-card border border-border rounded-[11px] transition-all group hover:bg-muted/20 hover:border-border"
                style={type?.color ? { borderLeft: `3px solid ${type.color}` } : undefined}
              >
                {/* COL 1: Item info — clickable row link */}
                <Link href={`/projects/${slug}/items/${item.sequenceNum}`} className="min-w-0 block">
                    <div className="flex items-center gap-2 mb-1">
                      {type && (
                        <TypeBadge icon={type.icon} color={type.color} name={type.name} />
                      )}
                    <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                  </div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate max-w-[680px] mb-1.5">
                      {bodyExcerpt(item.description, 80)}
                    </div>
                  )}
                  {(item.tags ?? []).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {(item.tags ?? []).map((tag) => (
                        <TagChip key={tag.id} tag={tag} small />
                      ))}
                    </div>
                  )}
                  {plan && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StatusDot color={plan.color ?? '#6B7280'} className="w-2 h-2" />
                      <span className="text-xs text-muted-foreground">{plan.name}</span>
                    </div>
                  )}
                </Link>

                {/* COL 2: Status (inline edit) */}
                <div className="relative">
                  {edit?.itemId === item.id && edit?.field === 'statusId' ? (
                    <Select
                      value={item.statusId}
                      onChange={(v) => handleUpdate(item.id, 'statusId', v)}
                      autoOpen
                      onClose={() => setEdit(null)}
                    >
                      <SelectTrigger className="h-8 w-full rounded-[10px] border border-border bg-card text-sm font-bold text-foreground px-2.5">
                        {status && <StatusDot color={status.color} className="w-2 h-2" />}
                        {status?.name ?? 'Select'}
                      </SelectTrigger>
                      <SelectContent>
                        {(statuses ?? []).map((s) => (
                          <SelectOption key={s.id} value={s.id}>
                            <StatusDot color={s.color} />
                            {s.name}
                          </SelectOption>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <button
                      onClick={() => setEdit({ itemId: item.id, field: 'statusId' })}
                      className="h-8 inline-flex items-center gap-2 px-3 rounded-[10px] border border-border text-sm font-bold whitespace-nowrap transition-colors"
                      style={status ? {
                        borderColor: `${status.color}52`,
                        backgroundColor: `${status.color}14`,
                        color: status.color,
                      } : {
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      <StatusDot color={status?.color} className="w-2 h-2" />
                      {status?.name ?? 'Set status'}
                    </button>
                  )}
                </div>

                {/* COL 3: Priority (inline edit) */}
                <div className="relative">
                  {edit?.itemId === item.id && edit?.field === 'priorityId' ? (
                    <Select
                      value={item.priorityId}
                      onChange={(v) => handleUpdate(item.id, 'priorityId', v)}
                      autoOpen
                      onClose={() => setEdit(null)}
                    >
                      <SelectTrigger className="h-8 w-full rounded-[10px] border border-border bg-card text-sm font-bold text-foreground px-2.5">
                        {priority && <StatusDot color={priority.color ?? '#888'} className="w-2 h-2" />}
                        {priority?.name ?? 'Select'}
                      </SelectTrigger>
                      <SelectContent>
                        {(priorities ?? []).map((p) => (
                          <SelectOption key={p.id} value={p.id}>
                            <StatusDot color={p.color ?? '#888'} />
                            {p.name}
                          </SelectOption>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <button
                      onClick={() => setEdit({ itemId: item.id, field: 'priorityId' })}
                      className="h-8 inline-flex items-center gap-2 px-3 rounded-[10px] border border-border bg-card text-sm font-bold whitespace-nowrap transition-colors hover:bg-muted"
                      style={priority?.color ? { borderColor: `${priority.color}52`, color: priority.color } : undefined}
                    >
                      <StatusDot color={priority?.color} className="w-2 h-2" />
                      {priority?.name ?? 'Set priority'}
                    </button>
                  )}
                </div>

                {/* COL 4: Assignee (inline edit) */}
                <div className="relative">
                  {edit?.itemId === item.id && edit?.field === 'assigneeId' ? (
                    <AssigneePicker
                      value={item.assigneeId ?? ''}
                      members={members}
                      onChange={(v) => handleUpdate(item.id, 'assigneeId', v || null)}
                      autoOpen
                      onClose={() => setEdit(null)}
                      triggerClassName="h-8 w-full rounded-[10px] border border-border bg-card text-sm font-bold text-foreground px-2.5"
                    />
                  ) : (
                    <button
                      onClick={() => setEdit({ itemId: item.id, field: 'assigneeId' })}
                      className="h-8 inline-flex items-center gap-2.5 text-sm font-bold whitespace-nowrap transition-colors hover:text-foreground"
                    >
                      {assignee ? (
                        <AvatarCircle name={assignee.name} avatarUrl={assignee.avatarUrl} />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className={assignee ? 'text-foreground' : 'text-muted-foreground'}>
                        {assignee?.name ?? 'Unassigned'}
                      </span>
                    </button>
                  )}
                </div>

                {/* COL 5: Created */}
                <div className="text-sm font-semibold text-foreground whitespace-nowrap leading-snug">
                  {new Date(item.createdAt).toLocaleDateString()}
                  <br />
                  <span className="text-muted-foreground font-normal">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* COL 6: Delete */}
                <button
                  onClick={() => setDeleteTarget(item.id)}
                  className="w-9 h-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  aria-label="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile layout */}
              <Link href={`/projects/${slug}/items/${item.sequenceNum}`} className="lg:hidden block">
                {rowContent(
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {type && (
                        <TypeBadge icon={type.icon} color={type.color} name={type.name} iconClassName="w-3 h-3" className="text-xs gap-1" />
                      )}
                      <span className="text-sm font-bold truncate text-foreground">{item.title}</span>
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">{bodyExcerpt(item.description, 60)}</div>
                    )}
                    {plan && (
                      <div className="flex items-center gap-1.5">
                        <StatusDot color={plan.color ?? '#6B7280'} className="w-1.5 h-1.5" />
                        <span className="text-xs text-muted-foreground">{plan.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 h-6 rounded border border-border" style={status?.color ? { borderColor: `${status.color}52`, color: status.color } : undefined}>
                        <StatusDot color={status?.color} className="w-1.5 h-1.5" />
                        {status?.name ?? '—'}
                      </span>
                      <span style={priority?.color ? { color: priority.color } : undefined}>
                        <StatusDot color={priority?.color} className="w-1.5 h-1.5 inline-block" />
                        {' '}{priority?.name ?? '—'}
                      </span>
                      <span className="ml-auto text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>,
                )}
              </Link>
            </div>
          );
          })();
          return (
            <div key={`${item.id}-${idx}`}>
              {groupHeader}
              {row}
              {viewMode === 'tree' && (childrenCounts[item.id] ?? 0) > 0 && (
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="mt-1 ml-1 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  {expanded.has(item.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                  {expanded.has(item.id) ? 'Hide subtasks' : `Subtasks (${childrenCounts[item.id]})`}
                </button>
              )}
              {viewMode === 'tree' && expanded.has(item.id) && (
                <TreeChildren
                  slug={slug as string}
                  parentId={item.id}
                  depth={1}
                  types={types}
                  statuses={statuses}
                  priorities={priorities}
                  members={members}
                  plans={plans}
                />
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm mt-1">Try adjusting your filters or create a new item.</p>
          </div>
        )}
      </div>
      </div>

      {/* Bottom line + pagination */}
      {items.length > 0 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPage={(p) => setPage(p)}
          onLimit={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      )}

      <QuickCreateModal open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete this item?"
        message="This will permanently remove the item and its attachments."
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && void handleDeleteItem(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
      <ImportItemsModal
        slug={slug}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['items', slug] })}
      />
    </div>
  );
}
