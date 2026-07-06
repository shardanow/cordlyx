'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCorners, useDroppable, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QuickCreateModal from '@/components/QuickCreateModal';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { icons } from 'lucide-react';
import {
  Search, Flag, User, Plus, MoreHorizontal, RotateCcw,
  CircleDot, ListTodo, Layout, Target,
} from 'lucide-react';

interface BoardColumn {
  id: string;
  name: string;
  color: string;
  category: string;
  items: BoardItem[];
}

interface BoardItem {
  id: string;
  sequenceNum: number;
  title: string;
  description: string | null;
  statusId: string;
  priorityId: string;
  typeId: string;
  assigneeId: string | null;
  planId: string | null;
  tags?: { id: string; name: string; color: string | null }[];
}

interface ItemType {
  id: string; name: string; color: string; icon: string | null;
}

interface ItemPriority {
  id: string; name: string; color: string | null; icon: string | null;
}

interface MemberInfo {
  id: string; userId: string; role: string; name: string; avatarUrl: string | null;
}

interface Project {
  id: string; name: string; slug: string;
}

function kebabToPascal(str: string): string {
  return str.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const ICON_ALIASES: Record<string, string> = {
  'check-square': 'SquareCheckBig',
};

function TypeIcon({ name, className }: { name: string | null; className?: string }) {
  if (!name) return null;
  const m = icons as unknown as Record<string, React.ComponentType<{ className?: string }> | undefined>;
  const key = ICON_ALIASES[name] ?? kebabToPascal(name);
  const LucideIcon = m[key];
  if (LucideIcon) return <LucideIcon className={className ?? 'w-4 h-4'} />;
  return <span className="w-4 h-4 flex items-center justify-center text-xs">{name}</span>;
}

function AvatarCircle({ name, className }: { name: string; className?: string }) {
  return (
    <div className={`w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium shrink-0 border border-border/60 ${className ?? ''}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SortableItem({
  item, priority, typeItem, assignee, plan, slug, statusColor,
}: {
  item: BoardItem; priority: ItemPriority | undefined; typeItem: ItemType | undefined;
  assignee: MemberInfo | undefined; plan: { id: string; name: string; color: string | null } | undefined; slug: string; statusColor?: string;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { item },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => router.push(`/projects/${slug}/items/${item.sequenceNum}`)}
      className="flex flex-col bg-card border border-border rounded-[12px] shadow-[0_12px_28px_rgba(0,0,0,0.25)] min-h-[200px] overflow-hidden cursor-pointer"
    >
      <div
        className="flex-1 p-4 pb-0"
        style={statusColor ? { borderLeft: `3px solid ${statusColor}`, paddingLeft: '13px' } : undefined}
      >
        <div className="flex items-center gap-1 mb-4">
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground px-0.5 py-0.5 text-lg leading-none tracking-[-3px] rotate-90"
            {...attributes} {...listeners}
            onClick={(e) => { e.stopPropagation(); }}
          >
            ⠿
          </button>
          {typeItem && (
            <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: typeItem.color ?? undefined }}>
              <TypeIcon name={typeItem.icon ?? null} className="w-4 h-4 shrink-0" />
              {typeItem.name}
            </span>
          )}
        </div>

        <div className="text-md font-[900] tracking-tight mb-3">{item.title}</div>
        {item.description && (
          <div className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-snug">
            {item.description.replace(/<[^>]+>/g, '').substring(0, 120)}
          </div>
        )}

        {(item.tags ?? []).length > 0 && (
          <div className="flex gap-1.5 flex-wrap pb-0">
            {(item.tags ?? []).map((tag) => (
              <span
                key={tag.id}
                className="h-6 px-2.5 rounded-full bg-muted/20 text-muted-foreground text-xs font-bold inline-flex items-center"
                style={tag.color ? { color: tag.color, backgroundColor: `${tag.color}18` } : undefined}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        {plan && (
          <div className="flex items-center gap-1.5 pb-0 px-4 mt-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: plan.color ?? '#6B7280' }} />
            <span className="text-xs text-muted-foreground">{plan.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 text-sm text-muted-foreground min-h-[52px] mt-auto">
        <div className="flex items-center gap-1.5">
          <Flag className="w-4 h-4" style={priority?.color ? { color: priority.color } : undefined} />
          <span className="font-semibold" style={priority?.color ? { color: priority.color } : undefined}>
            {priority?.name ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee ? (
            <>
              <AvatarCircle name={assignee.name} />
              <span className="truncate text-xs font-semibold">{assignee.name}</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold">Unassigned</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ column, children }: { column: BoardColumn; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { statusId: column.id, type: 'column' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-[16px] border border-border bg-muted/30 p-4 min-h-[200px] transition-colors ${isOver ? 'ring-2 ring-primary/30' : ''}`}
      style={{ minHeight: 'calc(100vh - 310px)' }}
    >
      {children}
    </div>
  );
}

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPlan, setFilterPlan] = useState('');

  const storageKey = `board:hidden:${slug}`;
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...hiddenColumns]));
    } catch { /* ignore */ }
  }, [hiddenColumns, storageKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const { data: project } = useQuery<Project>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data: columns, isLoading } = useQuery<BoardColumn[]>({
    queryKey: ['board', slug],
    queryFn: () => api.get(`/projects/${slug}/board`),
  });

  const { data: priorities } = useQuery<ItemPriority[]>({
    queryKey: ['priorities', slug],
    queryFn: () => api.get(`/projects/${slug}/priorities`),
  });

  const { data: types } = useQuery<ItemType[]>({
    queryKey: ['types', slug],
    queryFn: () => api.get(`/projects/${slug}/types`),
  });

  const { data: members } = useQuery<MemberInfo[]>({
    queryKey: ['members', slug],
    queryFn: () => api.get(`/projects/${slug}/members`),
  });

  interface Plan { id: string; name: string; color: string | null; }
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans', slug],
    queryFn: () => api.get(`/projects/${slug}/plans`),
  });

  const hasFilters = debouncedSearch || filterType || filterPriority || filterAssignee || filterPlan;

  const filteredColumns = useMemo(() => {
    if (!columns) return [];
    return columns.map((col) => ({
      ...col,
      items: col.items.filter((item) => {
        if (filterType && item.typeId !== filterType) return false;
        if (filterPriority && item.priorityId !== filterPriority) return false;
        if (filterAssignee && item.assigneeId !== filterAssignee) return false;
        if (filterPlan && item.planId !== filterPlan) return false;
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          const titleMatch = item.title.toLowerCase().includes(q);
          const descMatch = item.description?.toLowerCase().includes(q);
          if (!titleMatch && !descMatch) return false;
        }
        return true;
      }),
    }));
  }, [columns, filterType, filterPriority, filterAssignee, filterPlan, debouncedSearch]);

  const visibleColumns = useMemo(() =>
    filteredColumns.filter((col) => !hiddenColumns.has(col.id)),
    [filteredColumns, hiddenColumns],
  );

  const toggleColumn = (id: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilterType('');
    setFilterPriority('');
    setFilterAssignee('');
  };

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as BoardItem | undefined;
    setActiveItem(item ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = active.data.current?.item as BoardItem | undefined;
    if (!activeItem) return;

    let targetStatusId: string | undefined;

    if (over.data.current?.type === 'column') {
      targetStatusId = over.data.current.statusId as string;
    } else {
      const overItem = (columns ?? [])
        .flatMap((col) => col.items)
        .find((i) => i.id === over.id);
      targetStatusId = overItem?.statusId;
    }

    if (!targetStatusId || targetStatusId === activeItem.statusId) return;

    try {
      await api.patch(`/projects/${slug}/items/${activeItem.id}`, {
        statusId: targetStatusId,
        sortOrder: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: ['board', slug] });
      queryClient.invalidateQueries({ queryKey: ['items', slug] });
      toast.success('Item moved');
    } catch {
      toast.error('Failed to move item');
    } finally {
      setActiveItem(null);
    }
  };

  const totalItems = columns?.reduce((sum, c) => sum + c.items.length, 0) ?? 0;

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-4 w-48 rounded bg-muted animate-pulse" />
      <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
      <div className="h-4 w-36 rounded bg-muted animate-pulse" />
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <div className="h-6 w-32 rounded bg-muted animate-pulse" />
            <div className="h-64 rounded-lg bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
          <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <span className="text-muted-foreground">/</span>
          <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">Board</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project?.name ?? slug}</h1>
            <p className="text-base md:text-lg text-muted-foreground">Board view · {totalItems} items</p>
          </div>
          <div className="flex items-center gap-2.5">
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

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-[14px] mb-5 md:mb-6">
        <div className="flex items-center gap-2.5 p-3 overflow-x-auto">
          <label className="h-[50px] w-[220px] shrink-0 flex items-center gap-2.5 px-3.5 rounded-[10px] border border-border bg-muted/50 cursor-text transition-colors focus-within:ring-1 focus-within:ring-ring">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-0 min-w-0"
            />
            {debouncedSearch && (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="text-muted-foreground hover:text-foreground shrink-0">✕</button>
            )}
          </label>

          <Select value={filterType} onChange={setFilterType}>
            <SelectTrigger className="h-[50px] shrink-0 min-w-[150px] inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border border-border bg-muted/50">
              <ListTodo className="w-4 h-4 shrink-0" />
              <span className="truncate">{filterType ? types?.find((t) => t.id === filterType)?.name ?? 'All' : 'Type: All'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectOption value=""><ListTodo className="w-4 h-4" />All types</SelectOption>
              {(types ?? []).map((t) => (
                <SelectOption key={t.id} value={t.id}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  {t.name}
                </SelectOption>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onChange={setFilterPriority}>
            <SelectTrigger className="h-[50px] shrink-0 min-w-[150px] inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border border-border bg-muted/50">
              <Flag className="w-4 h-4 shrink-0" />
              <span className="truncate">{filterPriority ? priorities?.find((p) => p.id === filterPriority)?.name ?? 'All' : 'Priority: All'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectOption value=""><Flag className="w-4 h-4" />All priorities</SelectOption>
              {(priorities ?? []).map((p) => (
                <SelectOption key={p.id} value={p.id}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#888' }} />
                  {p.name}
                </SelectOption>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAssignee} onChange={setFilterAssignee}>
            <SelectTrigger className="h-[50px] shrink-0 min-w-[150px] inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border border-border bg-muted/50">
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">{filterAssignee ? members?.find((m) => m.userId === filterAssignee)?.name ?? 'All' : 'Assignee: All'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectOption value=""><User className="w-4 h-4" />All assignees</SelectOption>
              {(members ?? []).map((m) => (
                <SelectOption key={m.userId} value={m.userId}>
                  <AvatarCircle name={m.name} />
                  {m.name}
                </SelectOption>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPlan} onChange={setFilterPlan}>
            <SelectTrigger className="h-[50px] shrink-0 min-w-[150px] inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border border-border bg-muted/50">
              <Target className="w-4 h-4 shrink-0" />
              <span className="truncate">{filterPlan ? plans?.find((p) => p.id === filterPlan)?.name ?? 'All' : 'Plan: All'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectOption value=""><Target className="w-4 h-4" />All plans</SelectOption>
              {(plans ?? []).map((p) => (
                <SelectOption key={p.id} value={p.id}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#6B7280' }} />
                  {p.name}
                </SelectOption>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-4" />

          {/* Columns visibility */}
          <Select value="" onChange={() => { }}>
            <SelectTrigger className="h-[50px] shrink-0 inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border border-border bg-muted/50">
              <Layout className="w-4 h-4 shrink-0" />
              <span>Columns</span>
            </SelectTrigger>
            <SelectContent>
              {filteredColumns.map((col) => (
                <button
                  key={col.id}
                  onClick={(e) => { e.stopPropagation(); toggleColumn(col.id); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                >
                  <span className="w-4 h-4 rounded border border-muted-foreground flex items-center justify-center shrink-0">
                    {!hiddenColumns.has(col.id) && <span className="text-primary text-[10px] font-bold">✓</span>}
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  {col.name}
                </button>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-[48px] inline-flex items-center gap-1.5 px-3 rounded-[10px] text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners} sensors={sensors}>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex gap-3 min-w-[1100px]" style={{ minHeight: 'calc(100vh - 310px)' }}>
            {visibleColumns.map((column) => (
              <div key={column.id} className="flex-1 min-w-[210px] max-w-[280px]">
                <DroppableColumn column={column}>
                  {/* Column header */}
                  <div className="flex items-center gap-1.5 px-1 pb-4">
                    <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_0_4px_rgba(255,255,255,0.03)]" style={{ backgroundColor: column.color }} />
                    <span className="text-lg font-[850] truncate">{column.name}</span>
                    <span className="h-[22px] px-1.5 rounded-full bg-muted/30 text-muted-foreground text-xs font-[850] inline-flex items-center justify-center">{column.items.length}</span>
                  </div>

                  {/* Cards */}
                  <SortableContext items={column.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3">
                      {column.items.map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          priority={priorities?.find((p) => p.id === item.priorityId)}
                          typeItem={types?.find((t) => t.id === item.typeId)}
                          assignee={members?.find((m) => m.userId === item.assigneeId)}
                          plan={plans?.find((p) => p.id === item.planId)}
                          slug={slug}
                          statusColor={column.color}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  {/* Empty state */}
                  {column.items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-center py-6">
                      <div>
                        <div className="text-muted-foreground opacity-55 mb-4">
                          <svg className="w-[72px] h-[72px] mx-auto" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M20 34 48 18l28 16-28 16L20 34Z" /><path d="M20 34v28l28 16V50" /><path d="M76 34v28L48 78" /><path d="M34 26l28 16" /><path d="M62 26 34 42" />
                          </svg>
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-2">No items here</h3>
                        <p className="text-sm text-muted-foreground mb-4">Drag items here<br />or create a new one</p>
                        <button
                          onClick={() => setQuickCreateOpen(true)}
                          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Create item
                        </button>
                      </div>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem && (() => {
            const activePriority = priorities?.find((p) => p.id === activeItem.priorityId);
            const activeAssignee = members?.find((m) => m.userId === activeItem.assigneeId);
            const activeTypeItem = types?.find((t) => t.id === activeItem.typeId);
            return (
              <div className="flex flex-col bg-card border border-border rounded-[12px] shadow-[0_12px_28px_rgba(0,0,0,0.25)] min-h-[200px] overflow-hidden cursor-grabbing rotate-[4deg] scale-105">
                <div className="flex-1 p-4 pb-0">
                  <div className="flex items-center gap-1 mb-4">
                    {activeTypeItem && (
                      <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: activeTypeItem.color ?? undefined }}>
                        <TypeIcon name={activeTypeItem.icon ?? null} className="w-4 h-4 shrink-0" />
                        {activeTypeItem.name}
                      </span>
                    )}
                  </div>
                  <div className="text-md font-[900] tracking-tight mb-3">{activeItem.title}</div>
                  {activeItem.description && (
                    <div className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-snug">
                      {activeItem.description.replace(/<[^>]+>/g, '').substring(0, 120)}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 text-sm text-muted-foreground min-h-[52px] mt-auto">
                  <div className="flex items-center gap-1.5">
                    <Flag className="w-4 h-4" style={activePriority?.color ? { color: activePriority.color } : undefined} />
                    <span className="font-semibold" style={activePriority?.color ? { color: activePriority.color } : undefined}>
                      {activePriority?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {activeAssignee ? (
                      <>
                        <AvatarCircle name={activeAssignee.name} />
                        <span className="truncate text-xs font-semibold">{activeAssignee.name}</span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold">Unassigned</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      <QuickCreateModal open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
    </div>
  );
}
