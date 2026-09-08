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
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { TypeBadge } from '@/components/features/TypeBadge';
import { StatusDot } from '@/components/features/StatusDot';
import { AssigneePicker } from '@/components/features/AssigneePicker';
import { FilterBar } from '@/components/features/FilterBar';
import { useProjectData } from '@/lib/project-data';
import { AvatarCircle } from '@/components/features/AvatarCircle';
import { TypeIcon } from '@/components/features/TypeIcon';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { Target } from 'lucide-react';
import {
  Search, Flag, User, Calendar, Plus,
  RotateCcw, Bookmark, ChevronLeft, ChevronRight,
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
  const [sort, setSort] = useState<SortValue>('-created_at');
  const [activeTab, setActiveTab] = useState('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // Reset cursor when filters change
  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
  }, [debouncedSearch, filterType, filterStatus, filterPriority, filterAssignee, filterPlan, sort]);

  const currentFilters = {
    search: debouncedSearch,
    typeId: filterType,
    statusId: filterStatus,
    priorityId: filterPriority,
    assigneeId: filterAssignee,
    planId: filterPlan,
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
      setFilterType(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee('');
    } else if (tab === 'my') {
      setFilterType(''); setFilterStatus(''); setFilterPriority('');
      setFilterAssignee(currentUser?.id ?? '');
    }
  };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setFilterType(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setFilterPlan('');
    setActiveTab('all');
    searchRef.current?.focus();
  };

  const hasFilters = search || filterType || filterStatus || filterPriority || filterAssignee || filterPlan;

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: '50', sort });
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (filterType) p.set('typeId', filterType);
    if (filterStatus) p.set('statusId', filterStatus);
    if (filterPriority) p.set('priorityId', filterPriority);
    if (filterAssignee) p.set('assigneeId', filterAssignee);
    if (filterPlan) p.set('planId', filterPlan);
    if (cursor) p.set('cursor', cursor);
    return p;
  }, [debouncedSearch, filterType, filterStatus, filterPriority, filterAssignee, filterPlan, sort, cursor]);

  const { data: project } = useQuery<Project>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data, isLoading } = useQuery<{ data: Item[]; meta: { cursor: string | null; hasMore: boolean } }>({
    queryKey: ['items', slug, params.toString()],
    queryFn: () => api.get(`/projects/${slug}/items?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });

  const { types, statuses, priorities, members, plans } = useProjectData(slug);

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
            <p className="text-base md:text-lg text-muted-foreground">{items.length} items in this project</p>
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
        values={{ search, debouncedSearch, typeId: filterType, statusId: filterStatus, priorityId: filterPriority, assigneeId: filterAssignee, planId: filterPlan }}
        onSearch={setSearch}
        onClearSearch={() => { setSearch(''); setDebouncedSearch(''); searchRef.current?.focus(); }}
        onChange={(patch) => {
          if (patch.typeId !== undefined) setFilterType(patch.typeId);
          if (patch.statusId !== undefined) setFilterStatus(patch.statusId);
          if (patch.priorityId !== undefined) setFilterPriority(patch.priorityId);
          if (patch.assigneeId !== undefined) setFilterAssignee(patch.assigneeId);
          if (patch.planId !== undefined) setFilterPlan(patch.planId);
        }}
        data={{ types, statuses, priorities, members, plans }}
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
      <div className="space-y-3">
        {items.map((item) => {
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
                      {item.description.replace(/<[^>]+>/g, '').substring(0, 80) + (item.description.length > 80 ? '...' : '')}
                    </div>
                  )}
                  {(item.tags ?? []).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {(item.tags ?? []).map((tag) => (
                        <span
                          key={tag.id}
                          className="h-6 px-2.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold inline-flex items-center"
                          style={tag.color ? { color: tag.color, backgroundColor: `${tag.color}18` } : undefined}
                        >
                          {tag.name}
                        </span>
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
                      <div className="text-xs text-muted-foreground truncate">{item.description.replace(/<[^>]+>/g, '').substring(0, 60)}</div>
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
      {items.length > 0 && Boolean((data?.meta?.cursor && data?.meta?.hasMore) || cursorStack.length > 0) && (
        <div className="flex items-center justify-between gap-4 mt-6 text-base text-muted-foreground">
          <span>{items.length} items</span>
          <div className="flex items-center gap-2">
            <button
              disabled={cursorStack.length === 0}
              onClick={() => {
                const prev = cursorStack.pop()!;
                setCursorStack([...cursorStack]);
                setCursor(prev || null);
              }}
              className="w-[46px] h-[46px] rounded-[10px] border border-border bg-card text-muted-foreground grid place-items-center disabled:opacity-50 disabled:cursor-default hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Boolean(data?.meta?.cursor && data?.meta?.hasMore) && (
              <button
                onClick={() => {
                  setCursorStack((s) => [...s, cursor ?? '']);
                  if (data?.meta?.cursor) setCursor(data.meta.cursor);
                }}
                className="w-[46px] h-[46px] rounded-[10px] border border-border bg-card text-muted-foreground grid place-items-center hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
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
