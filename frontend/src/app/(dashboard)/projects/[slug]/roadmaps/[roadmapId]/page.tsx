'use client';

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragStartEvent, useDroppable, useDraggable, DragOverlay } from '@dnd-kit/core';
import {
  Search, Plus, X, ZoomIn, ZoomOut, Maximize2, GripVertical, GripHorizontal,
  ChevronDown, ChevronRight, Link as LinkIcon,
  Calendar, ExternalLink, icons,
} from 'lucide-react';

type TimeMode = 'day' | 'week' | 'month' | 'quarter';

interface Roadmap {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  color: string | null;
}

interface ItemStatus {
  id: string; name: string; color: string; category: string;
}

interface ItemType {
  id: string; name: string; color: string; icon: string | null;
}

interface Item {
  id: string;
  sequenceNum: number;
  title: string;
  description: string | null;
  typeId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  tags: { id: string; name: string; color: string | null }[];
  roadmapLaneId: string | null;
  roadmapStartDate: string | null;
  roadmapDueDate: string | null;
}

interface RoadmapLaneData {
  id: string;
  roadmapId: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  items: Item[];
}

interface RoadmapData {
  roadmap: Roadmap;
  lanes: RoadmapLaneData[];
  unscheduledItems: Item[];
}

interface RoadmapRelation {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  relationType: string;
  sourceItem: { id: string; sequenceNum: number; title: string } | null;
  targetItem: { id: string; sequenceNum: number; title: string } | null;
}

// --- Date helpers ---

function toUTCDate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toUTCDate(date);
}

function formatRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatMonth(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatQuarter(d: Date) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

const LANE_PRESET_COLORS = ['#6366f1', '#16a34a', '#2563eb', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];
const LANE_PRESET_ICONS = ['◈', '⚙', '✧', '◉', '⭐', '⬡', '♢', '✓', '⚡', '⊞', '♻', '⌗', '⧫', '◎', '✦'];

const TYPE_ICON_MAP: Record<string, string> = {
  Bug: '◈', Feature: '▧', Improvement: '▤',
  Task: '▰', Plan: '✦', Milestone: '◆',
  Epic: '◷', Story: '▣',
};

const ICON_ALIASES: Record<string, string> = { 'check-square': 'SquareCheckBig' };

function kebabToPascal(str: string): string {
  return str.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// --- Sub-components ---

function DraggableUnscheduledItem({ item, statusColor }: { item: Item; statusColor: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled-${item.id}`,
    data: { item, source: 'unscheduled' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={item.title}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm ${isDragging ? 'opacity-0' : ''}`}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
      <span className="text-xs text-muted-foreground font-mono shrink-0">#{item.sequenceNum}</span>
      <span className="text-sm font-semibold truncate flex-1">{item.title}</span>
    </div>
  );
}

function DragOverlayItem({ item, statusColor }: { item: Item; statusColor: string }) {
  return (
    <div title={item.title} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card shadow-xl opacity-90 rotate-[3deg]">
      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
      <span className="text-xs text-muted-foreground font-mono shrink-0">#{item.sequenceNum}</span>
      <span className="text-sm font-semibold truncate flex-1">{item.title}</span>
    </div>
  );
}

function DroppableLane({ laneId, children }: { laneId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane-${laneId}`, data: { laneId, type: 'lane' } });
  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[60px] transition-colors ${isOver ? 'bg-primary/5 rounded-lg' : ''}`}
    >
      {children}
    </div>
  );
}

function DateEditPopover({
  item, laneColor, onSave, onClose,
}: {
  item: Item; laneColor: string; onSave: (data: { startDate?: string | null; dueDate?: string | null }) => void; onClose: () => void;
}) {
  const [start, setStart] = useState(item.roadmapStartDate?.split('T')[0] ?? '');
  const [end, setEnd] = useState(item.roadmapDueDate?.split('T')[0] ?? '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (start && end && new Date(end) < new Date(start)) {
      setError('Due date must be after start date');
      return;
    }
    setError('');
    onSave({ startDate: start ? new Date(start).toISOString() : null, dueDate: end ? new Date(end).toISOString() : null });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onPointerDown={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: laneColor }} />
          <span className="text-sm font-bold truncate">{item.title}</span>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Start Date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full h-8 px-2 rounded-md border border-border bg-muted/30 text-xs mt-0.5 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Due Date</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full h-8 px-2 rounded-md border border-border bg-muted/30 text-xs mt-0.5 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleSave}
            className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
          <button onClick={onClose} className="h-8 px-3 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// --- Main component ---

export default function RoadmapEditorPage() {
  const { slug, roadmapId } = useParams<{ slug: string; roadmapId: string }>();
  const queryClient = useQueryClient();
  const timelineRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(28);
  const [newLaneName, setNewLaneName] = useState('');
  const [timeMode, setTimeMode] = useState<TimeMode>('day');
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [linkingMode, setLinkingMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ item: Item; laneColor: string } | null>(null);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [viewSettings, setViewSettings] = useState({
    showWeekends: true,
    showDependencies: true,
    showMilestones: true,
  });

  const [activeDragItem, setActiveDragItem] = useState<{ item: Item; statusColor: string } | null>(null);
  const [lanePopup, setLanePopup] = useState<{ laneId: string; field: 'color' | 'icon'; rect: DOMRect } | null>(null);

  // Drag-to-move/rezise state (ref to avoid re-renders)
  const dragStateRef = useRef<{
    itemId: string; type: 'move' | 'resize'; startDate: Date; dueDate: Date; startX: number; laneColor: string;
  } | null>(null);
  const didDragRef = useRef(false);

  const { data: project } = useQuery<{ id: string; name: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data: statuses } = useQuery<ItemStatus[]>({
    queryKey: ['statuses', slug],
    queryFn: () => api.get(`/projects/${slug}/statuses`),
  });

  const { data: itemTypes } = useQuery<ItemType[]>({
    queryKey: ['types', slug],
    queryFn: () => api.get(`/projects/${slug}/types`),
  });

  const { data: priorities } = useQuery<{ id: string; name: string; color: string | null }[]>({
    queryKey: ['priorities', slug],
    queryFn: () => api.get(`/projects/${slug}/priorities`),
  });

  const { data: roadmapData, isLoading } = useQuery<RoadmapData>({
    queryKey: ['roadmap-items', slug, roadmapId],
    queryFn: () => api.get(`/projects/${slug}/roadmaps/${roadmapId}/items`),
  });

  const { data: relationsData } = useQuery<RoadmapRelation[]>({
    queryKey: ['roadmap-relations', slug, roadmapId],
    queryFn: () => api.get(`/projects/${slug}/roadmaps/${roadmapId}/relations`),
    enabled: !!roadmapData?.roadmap,
  });

  const roadmap = roadmapData?.roadmap;
  const lanes = roadmapData?.lanes ?? [];
  const unscheduledItems = roadmapData?.unscheduledItems ?? [];
  const relations = relationsData ?? [];

  const roadmapStart = useMemo(() => {
    if (!roadmap?.startDate) return new Date();
    return toUTCDate(new Date(roadmap.startDate));
  }, [roadmap?.startDate]);

  const roadmapEnd = useMemo(() => {
    if (!roadmap?.endDate) return new Date();
    return toUTCDate(new Date(roadmap.endDate));
  }, [roadmap?.endDate]);

  const totalDays = useMemo(() =>
    Math.max(1, diffDays(roadmapStart, roadmapEnd)),
    [roadmapStart, roadmapEnd]);

  const today = new Date();

  const filteredUnscheduled = useMemo(() => {
    if (!search) return unscheduledItems;
    const q = search.toLowerCase();
    return unscheduledItems.filter((item) =>
      item.title.toLowerCase().includes(q) || `#${item.sequenceNum}`.includes(q),
    );
  }, [unscheduledItems, search]);

  // --- Time mode computation ---

  const days = useMemo(() => {
    const items = [];
    for (let i = 0; i <= totalDays; i++) {
      items.push(addDays(roadmapStart, i));
    }
    return items;
  }, [roadmapStart, totalDays]);

  const weeks = useMemo(() => {
    const map = new Map<string, { label: string; start: Date; end: Date; days: number }>();
    days.forEach((d) => {
      const monday = getMonday(d);
      const key = monday.toISOString();
      if (!map.has(key)) {
        map.set(key, {
          label: formatRange(monday, addDays(monday, 6)),
          start: monday,
          end: addDays(monday, 6),
          days: 0,
        });
      }
      map.get(key)!.days++;
    });
    return Array.from(map.values());
  }, [days]);

  const months = useMemo(() => {
    const map = new Map<string, { label: string; startIdx: number; days: number }>();
    days.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) {
        map.set(key, { label: formatMonth(d), startIdx: i, days: 0 });
      }
      map.get(key)!.days++;
    });
    return Array.from(map.values());
  }, [days]);

  const quarters = useMemo(() => {
    const map = new Map<string, { label: string; startIdx: number; days: number }>();
    days.forEach((d, i) => {
      const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      if (!map.has(key)) {
        map.set(key, { label: formatQuarter(d), startIdx: i, days: 0 });
      }
      map.get(key)!.days++;
    });
    return Array.from(map.values());
  }, [days]);

  const zoomLimits = useMemo(() => {
    switch (timeMode) {
      case 'day': return { min: 15, max: 60 };
      case 'week': return { min: 60, max: 200 };
      case 'month': return { min: 120, max: 400 };
      case 'quarter': return { min: 200, max: 600 };
    }
  }, [timeMode]);

  // Clamp zoom when switching time modes
  useEffect(() => {
    setZoom((prev) => Math.max(zoomLimits.min, Math.min(zoomLimits.max, prev)));
  }, [timeMode]);

  const dayWidth = zoom;

  // --- Position / width — always based on days (headers change only) ---

  const getItemOffset = useCallback((date: Date): number => {
    return diffDays(roadmapStart, toUTCDate(date));
  }, [roadmapStart]);

  const getItemDuration = useCallback((start: Date, end: Date): number => {
    return Math.max(1, diffDays(start, end));
  }, []);

  const totalUnits = totalDays;

  const getItemPosition = useCallback((item: Item): number | null => {
    if (!item.roadmapStartDate) return null;
    const start = new Date(item.roadmapStartDate);
    const maxUnits = totalUnits || 1;
    return Math.max(0, Math.min(100, (getItemOffset(start) / maxUnits) * 100));
  }, [getItemOffset, totalUnits]);

  const getItemWidth = useCallback((item: Item): number => {
    if (!item.roadmapStartDate || !item.roadmapDueDate) return 15;
    const start = new Date(item.roadmapStartDate);
    const end = new Date(item.roadmapDueDate);
    const maxUnits = totalUnits || 1;
    return Math.min(100, Math.max(0.5, (getItemDuration(start, end) / maxUnits) * 100));
  }, [getItemDuration, totalUnits]);

  const todayPct = useMemo(() => {
    const maxUnits = totalUnits || 1;
    return Math.max(0, Math.min(100, (getItemOffset(today) / maxUnits) * 100));
  }, [getItemOffset, totalUnits]);

  const timelineInnerRef = useRef<HTMLDivElement>(null);
  const [barRects, setBarRects] = useState<Map<string, { left: number; top: number; width: number; height: number }>>(new Map());

  // Measure bar positions from DOM after every render that affects layout
  const measureBars = useCallback(() => {
    const container = timelineInnerRef.current;
    if (!container) return new Map();
    const containerRect = container.getBoundingClientRect();
    const rects = new Map<string, { left: number; top: number; width: number; height: number }>();
    const els = container.querySelectorAll<HTMLElement>('[data-bar-id]');
    for (const el of els) {
      const id = el.getAttribute('data-bar-id');
      if (!id) continue;
      const r = el.getBoundingClientRect();
      rects.set(id, {
        left: r.left - containerRect.left,
        top: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      });
    }
    return rects;
  }, []);

  // Re-measure whenever layout-affecting state changes
  useEffect(() => {
    setBarRects(measureBars());
  }, [measureBars, lanes, timeMode, zoom, totalDays]);

  // Also measure on every animation frame while scrolling (keep positions in sync)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => setBarRects(measureBars()));
    if (timelineInnerRef.current) ro.observe(timelineInnerRef.current);
    const onScroll = () => setBarRects(measureBars());
    window.addEventListener('scroll', onScroll, true);
    return () => { ro.disconnect(); window.removeEventListener('scroll', onScroll, true); };
  }, [measureBars]);

  // --- Dependency SVG calculation from DOM positions ---

  const dependencyPaths = useMemo(() => {
    if (!relations.length || !viewSettings.showDependencies || barRects.size === 0) return [];

    return relations
      .map((rel) => {
        const srcRect = barRects.get(rel.sourceItemId);
        const tgtRect = barRects.get(rel.targetItemId);
        if (!srcRect || !tgtRect) return null;

        // Right center of source → left center of target
        const x1 = srcRect.left + srcRect.width;
        const y1 = srcRect.top + srcRect.height / 2;
        const x2 = tgtRect.left;
        const y2 = tgtRect.top + tgtRect.height / 2;

        const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
        const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        return { id: rel.id, path, y1, xMid: (x1 + x2) / 2, yMid: (y1 + y2) / 2 };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [relations, barRects, viewSettings.showDependencies]);

  // --- Handlers ---

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = event.active.data.current?.item as Item | undefined;
    if (!item) { setActiveDragItem(null); return; }
    const status = statuses?.find((s) => s.id === item.statusId);
    setActiveDragItem({ item, statusColor: status?.color ?? '#888' });
  }, [statuses]);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    const item = active.data.current?.item as Item | undefined;
    if (!item) return;

    let laneId: string | null = null;
    if (over.data.current?.type === 'lane') {
      laneId = over.data.current.laneId as string;
    }

    // Robust rect extraction: @dnd-kit v6 can expose rects at different paths
    const getLayoutRect = (src: any): { left: number; top: number; width: number; height: number } | null => {
      if (!src) return null;
      if (src.left !== undefined) return src;
      if (src.current?.translated?.left !== undefined) return src.current.translated;
      if (src.current?.left !== undefined) return src.current;
      if (src.translated?.left !== undefined) return src.translated;
      return null;
    };

    // Calculate drop position — fallback to today if we can't determine position
    let startDate = new Date();
    try {
      const activeLayout = getLayoutRect(active.rect);
      const overLayout = getLayoutRect(over.rect);
      const timelineEl = timelineRef.current;
      if (activeLayout && overLayout && timelineEl) {
        const scrollLeft = timelineEl.scrollLeft;
        const dropX = activeLayout.left + scrollLeft;
        const dropPct = (dropX - overLayout.left) / overLayout.width;
        const dropUnit = Math.max(0, Math.round(dropPct * totalUnits));

        if (timeMode === 'day') {
          startDate = addDays(roadmapStart, Math.min(dropUnit, totalDays));
        } else if (timeMode === 'week') {
          const w = weeks[Math.min(dropUnit, weeks.length - 1)];
          startDate = w ? new Date(w.start) : new Date(roadmapStart);
        } else if (timeMode === 'month') {
          const m = months[Math.min(dropUnit, months.length - 1)];
          startDate = m ? addDays(roadmapStart, m.startIdx) : new Date(roadmapStart);
        } else {
          const q = quarters[Math.min(dropUnit, quarters.length - 1)];
          startDate = q ? addDays(roadmapStart, q.startIdx) : new Date(roadmapStart);
        }
      }
    } catch {
      startDate = new Date();
    }
    const endDate = addDays(startDate, 14);

    try {
      await api.post(`/projects/${slug}/roadmaps/${roadmapId}/schedule`, {
        itemIds: [item.id],
        laneId,
        startDate: startDate.toISOString(),
        dueDate: endDate.toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
      toast.success('Item added to roadmap');
    } catch {
      toast.error('Failed to add item');
    }
  };

  const handleItemDateUpdate = async (itemId: string, data: { startDate?: string | null; dueDate?: string | null; laneId?: string }) => {
    try {
      await api.patch(`/projects/${slug}/roadmaps/${roadmapId}/items/${itemId}`, data);
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
    } catch {
      toast.error('Failed to update item');
    }
  };

  const handleUnscheduleItem = async (itemId: string) => {
    try {
      await api.delete(`/projects/${slug}/roadmaps/${roadmapId}/items/${itemId}`);
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
      toast.success('Item removed from roadmap');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const handleAddLane = async () => {
    if (!newLaneName.trim()) return;
    try {
      await api.post(`/projects/${slug}/roadmaps/${roadmapId}/lanes`, {
        name: newLaneName.trim(),
        sortOrder: lanes.length,
      });
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
      setNewLaneName('');
      toast.success('Lane added');
    } catch {
      toast.error('Failed to add lane');
    }
  };

  const handleDeleteLane = async (laneId: string) => {
    try {
      await api.delete(`/projects/${slug}/roadmaps/${roadmapId}/lanes/${laneId}`);
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
      toast.success('Lane deleted');
    } catch {
      toast.error('Failed to delete lane');
    }
  };

  const handleMoveLane = async (laneId: string, direction: 'up' | 'down') => {
    const idx = lanes.findIndex((l) => l.id === laneId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= lanes.length) return;

    try {
      await api.patch(`/projects/${slug}/roadmaps/${roadmapId}/lanes/${laneId}`, { sortOrder: lanes[newIdx].sortOrder });
      await api.patch(`/projects/${slug}/roadmaps/${roadmapId}/lanes/${lanes[newIdx].id}`, { sortOrder: lanes[idx].sortOrder });
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
    } catch {
      toast.error('Failed to reorder lanes');
    }
  };

  const handleLaneUpdate = async (laneId: string, data: { name?: string; color?: string | null; icon?: string | null; sortOrder?: number }) => {
    try {
      await api.patch(`/projects/${slug}/roadmaps/${roadmapId}/lanes/${laneId}`, data);
      queryClient.invalidateQueries({ queryKey: ['roadmap-items', slug, roadmapId] });
    } catch {
      toast.error('Failed to update lane');
    }
  };

  const toggleCollapseLane = (laneId: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  };

  // --- Bar drag move/resize (commits on mouse up) ---

  const handleBarMouseDown = (e: React.MouseEvent, item: Item, type: 'move' | 'resize', laneColor: string) => {
    e.stopPropagation();
    if (linkingMode) return;

    // Find the bar wrapper element for DOM manipulation
    const wrapper = (e.currentTarget as HTMLElement).closest('.bar-wrapper') as HTMLElement | null;
    if (!wrapper) return;

    const origWidth = wrapper.style.width;
    const origTransform = wrapper.style.transform;

    didDragRef.current = false;

    dragStateRef.current = {
      itemId: item.id,
      type,
      startDate: new Date(item.roadmapStartDate!),
      dueDate: new Date(item.roadmapDueDate!),
      startX: e.clientX,
      laneColor,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      if (Math.abs(ev.clientX - dragStateRef.current.startX) > 2) {
        didDragRef.current = true;
      }
      const dx = ev.clientX - dragStateRef.current.startX;

      if (type === 'move') {
        wrapper.style.transform = `translateX(${dx}px)`;
        wrapper.style.zIndex = '50';
      } else {
        const daysDelta = dx / (dayWidth || zoom);
        const pctWidth = parseFloat(origWidth) || 15;
        const newWidthPct = Math.max(5, pctWidth + (daysDelta / (totalDays || 1)) * 100);
        wrapper.style.width = `${Math.min(newWidthPct, 95)}%`;
      }
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      // Reset visual state
      wrapper.style.transform = origTransform || '';
      wrapper.style.zIndex = '';
      if (type === 'resize') wrapper.style.width = origWidth;

      const state = dragStateRef.current;
      dragStateRef.current = null;
      if (!state) return;

      const dx = ev.clientX - state.startX;
      const daysDelta = Math.round(dx / (dayWidth || zoom));
      if (daysDelta === 0) return;

      if (type === 'move') {
        const newStart = new Date(state.startDate);
        newStart.setDate(newStart.getDate() + daysDelta);
        const newDue = new Date(state.dueDate);
        newDue.setDate(newDue.getDate() + daysDelta);
        handleItemDateUpdate(state.itemId, {
          startDate: newStart.toISOString(),
          dueDate: newDue.toISOString(),
        }).then(() => toast.success('Item moved'));
      } else {
        const newDue = new Date(state.dueDate);
        newDue.setDate(newDue.getDate() + daysDelta);
        if (newDue < state.startDate) {
          toast.error('Due date cannot be before start date');
          return;
        }
        handleItemDateUpdate(state.itemId, {
          dueDate: newDue.toISOString(),
        }).then(() => toast.success('Item resized'));
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleBarClick = (item: Item, laneColor: string) => {
    // Ignore click if it was preceded by a drag
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (linkingMode) {
      if (!linkSource) {
        setLinkSource(item.id);
        toast.info(`Source: ${item.title} — click target item`);
      } else if (linkSource !== item.id) {
        createRelation(linkSource, item.id);
        setLinkSource(null);
        setLinkingMode(false);
      }
      return;
    }
    setEditingItem({ item, laneColor });
  };

  const handleConnectStart = (e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    if (linkingMode && linkSource === item.id) {
      exitLinkingMode();
      return;
    }
    setLinkingMode(true);
    setLinkSource(item.id);
    toast.info(`Source: ${item.title} — click target bar to connect`);
  };

  const createRelation = async (sourceId: string, targetId: string) => {
    try {
      await api.post(`/projects/${slug}/items/${sourceId}/relations`, {
        targetItemId: targetId,
        relationType: 'next_action',
      });
      queryClient.invalidateQueries({ queryKey: ['roadmap-relations', slug, roadmapId] });
      toast.success('Dependency created');
    } catch {
      toast.error('Failed to create dependency');
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    try {
      const rel = relations.find((r) => r.id === relationId);
      if (!rel) return;
      await api.delete(`/projects/${slug}/items/${rel.sourceItemId}/relations/${relationId}`);
      queryClient.invalidateQueries({ queryKey: ['roadmap-relations', slug, roadmapId] });
      toast.success('Dependency removed');
    } catch {
      toast.error('Failed to remove dependency');
    }
  };

  const exitLinkingMode = () => {
    setLinkingMode(false);
    setLinkSource(null);
  };

  // --- Grid columns ---

  const gridColumns = useMemo(() => {
    if (timeMode === 'day') {
      return days.map((d) => ({
        key: d.toISOString(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        width: dayWidth,
      }));
    }
    if (timeMode === 'week') {
      return weeks.map((w) => ({
        key: w.label,
        isWeekend: false,
        width: w.days * dayWidth,
      }));
    }
    if (timeMode === 'month') {
      return months.map((m) => ({
        key: m.label,
        isWeekend: false,
        width: m.days * dayWidth,
      }));
    }
    return quarters.map((q) => ({
      key: q.label,
      isWeekend: false,
      width: q.days * dayWidth,
    }));
  }, [timeMode, days, weeks, months, quarters, dayWidth]);

  // --- Render ---

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        <div className="h-10 w-96 rounded-lg bg-muted animate-pulse" />
        <div className="flex gap-4">
          <div className="w-[330px] h-[400px] rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 h-[400px] rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!roadmap) {
    return <div className="text-center py-12 text-muted-foreground">Roadmap not found</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] lg:h-[calc(100vh-64px)]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}/roadmaps`} className="hover:text-foreground transition-colors">Roadmaps</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">{roadmap.name}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: roadmap.color ?? '#6366f1' }} />
          <h1 className="text-2xl font-bold tracking-tight">{roadmap.name}</h1>
          <span className="text-base text-muted-foreground font-medium">
            {roadmap.startDate} — {roadmap.endDate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all inline-flex items-center gap-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>
        </div>
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left panel */}
          <div className="w-[330px] shrink-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-3 border-b border-border">
              <h2 className="text-sm font-bold mb-2">Unscheduled items</h2>
              <label className="h-9 w-full flex items-center gap-2 px-2.5 rounded-lg border border-border bg-muted/30 text-sm">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-0 min-w-0"
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredUnscheduled.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {search ? 'No matching items' : 'All items are scheduled'}
                </div>
              )}
              {filteredUnscheduled.map((item) => {
                const status = statuses?.find((s) => s.id === item.statusId);
                return (
                  <DraggableUnscheduledItem
                    key={item.id}
                    item={item}
                    statusColor={status?.color ?? '#888'}
                  />
                );
              })}
              <div className="text-center pt-2 pb-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Drag items to timeline</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col flex-1">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-wrap">
                {/* Time mode toggle */}
                <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/60">
                  {(['day', 'week', 'month', 'quarter'] as TimeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTimeMode(mode)}
                      className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors ${timeMode === mode
                        ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {mode === 'day' ? 'Days' : mode === 'week' ? 'Weeks' : mode === 'month' ? 'Months' : 'Quarters'}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 bg-border mx-1" />

                {/* Zoom */}
                <button onClick={() => setZoom((z) => Math.max(zoomLimits.min, z - (timeMode === 'day' ? 3 : 10)))} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={zoomLimits.min}
                  max={zoomLimits.max}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-20 h-1.5 accent-primary cursor-pointer"
                />
                <button onClick={() => setZoom((z) => Math.min(zoomLimits.max, z + (timeMode === 'day' ? 3 : 10)))} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors">
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="w-px h-5 bg-border mx-1" />

                <button
                  onClick={() => {
                    if (timelineRef.current) {
                      const todayUnit = (todayPct / 100) * totalUnits;
                      timelineRef.current.scrollLeft = todayUnit * dayWidth - timelineRef.current.clientWidth / 2;
                    }
                  }}
                  className="h-7 px-2.5 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Today
                </button>

                <div className="flex-1" />

                {/* View settings */}
                <div className="relative">
                  <button
                    onClick={() => setViewSettingsOpen(!viewSettingsOpen)}
                    className="h-7 px-2.5 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" />
                    View
                  </button>
                  {viewSettingsOpen && (
                    <>
                      <div className="fixed inset-0 z-50" onPointerDown={() => setViewSettingsOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-lg shadow-lg p-2 space-y-1">
                        {([
                          { key: 'showWeekends' as const, label: 'Show weekends' },
                          { key: 'showDependencies' as const, label: 'Show dependencies' },
                          { key: 'showMilestones' as const, label: 'Show milestones' },
                        ]).map((opt) => (
                          <label key={opt.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={viewSettings[opt.key]}
                              onChange={() => setViewSettings((s) => ({ ...s, [opt.key]: !s[opt.key] }))}
                              className="accent-primary"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Scrollable timeline area */}
              <div
                ref={timelineRef}
                className="overflow-x-auto flex-1"
                style={{ scrollbarWidth: 'thin' }}
              >
                <div
                  ref={timelineInnerRef}
                  className="relative"
                  style={{ width: `${totalUnits * dayWidth}px`, minWidth: '100%' }}
                >
                  {/* Month reference header (not in month mode) */}
                  {timeMode !== 'month' && (
                    <div className="flex sticky top-0 z-10 bg-card">
                      {months.map((m) => (
                        <div
                          key={m.label}
                          className="text-[10px] font-medium text-muted-foreground/60 px-2 py-0.5 border-b border-border"
                          style={{ width: `${m.days * dayWidth}px`, minWidth: `${m.days * dayWidth}px` }}
                        >
                          {m.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Primary headers */}
                  <div className="flex sticky top-0 z-10 bg-card">
                    {timeMode === 'month' && months.map((m) => (
                      <div
                        key={m.label}
                        className="text-[11px] font-semibold text-muted-foreground px-2 py-1.5 border-b border-border"
                        style={{ width: `${m.days * dayWidth}px`, minWidth: `${m.days * dayWidth}px` }}
                      >
                        {m.label}
                      </div>
                    ))}
                    {timeMode === 'week' && weeks.map((w) => (
                      <div
                        key={w.label}
                        className="text-[11px] font-semibold text-muted-foreground px-2 py-1.5 border-b border-border shrink-0"
                        style={{ width: `${w.days * dayWidth}px`, minWidth: `${w.days * dayWidth}px` }}
                      >
                        {w.label}
                      </div>
                    ))}
                    {timeMode === 'quarter' && quarters.map((q) => (
                      <div
                        key={q.label}
                        className="text-[11px] font-semibold text-muted-foreground px-2 py-1.5 border-b border-border"
                        style={{ width: `${q.days * dayWidth}px`, minWidth: `${q.days * dayWidth}px` }}
                      >
                        {q.label}
                      </div>
                    ))}
                  </div>

                  {/* Day number headers (day mode only) */}
                  {timeMode === 'day' && (
                    <div className="flex sticky top-0 z-10 bg-card">
                      {days.map((d, i) => {
                        const isToday = d.toDateString() === today.toDateString();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        if (!viewSettings.showWeekends && isWeekend) return null;
                        return (
                          <div
                            key={i}
                            className={`text-[10px] font-medium text-center py-1 border-b border-border shrink-0 ${isToday ? 'bg-primary/10 text-primary font-bold' : isWeekend ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}
                            style={{ width: `${dayWidth}px` }}
                          >
                            {d.getDate()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Today line — under everything */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/15 z-0 pointer-events-none"
                    style={{ left: `${(todayPct / 100) * totalUnits * dayWidth + dayWidth / 2}px` }}
                  />
                  {/* Today label — above everything */}
                  <div
                    className="absolute z-30 pointer-events-none"
                    style={{ left: `${(todayPct / 100) * totalUnits * dayWidth + dayWidth / 2}px`, top: 0 }}
                  >
                    <div className="relative -left-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-b-md shadow-sm whitespace-nowrap">
                      Today
                    </div>
                  </div>

                  {/* Dependency arrows */}
                  {viewSettings.showDependencies && dependencyPaths.length > 0 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ overflow: 'visible' }}
                    >
                      <defs>
                        <marker id="roadmap-arrow" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                          <path d="M0 0 L6 3 L0 6 Q1.5 3 0 0" fill="#94a3b8" />
                        </marker>
                      </defs>
                      {dependencyPaths.map((dep) => (
                        <g key={dep.id} className="pointer-events-auto">
                          <path
                            d={dep.path}
                            stroke="#94a3b8"
                            strokeWidth="2"
                            fill="none"
                            markerEnd="url(#roadmap-arrow)"
                            className="hover:stroke-destructive transition-colors cursor-pointer"
                          />
                          <path
                            d={dep.path}
                            stroke="transparent"
                            strokeWidth="14"
                            fill="none"
                            onClick={() => handleDeleteRelation(dep.id)}
                          />
                          <title>Click to remove dependency</title>
                        </g>
                      ))}
                    </svg>
                  )}

                  {/* Lanes */}
                  {lanes.map((lane, laneIdx) => {
                    const isCollapsed = collapsedLanes.has(lane.id);
                    const laneItems = lane.items;
                    const datedItems = laneItems.filter((item) => item.roadmapStartDate);
                    const undatedItems = laneItems.filter((item) => !item.roadmapStartDate);
                    const laneIcon = lane.icon || '▦';
                    return (
                      <DroppableLane key={lane.id} laneId={lane.id}>
                        <div className="border-b border-border last:border-b-0">
                          {/* Lane header */}
                          <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/10 sticky left-0 z-10 group">
                            <button
                              onClick={() => toggleCollapseLane(lane.id)}
                              className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                            >
                              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {/* Color dot — click to edit */}
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer hover:ring-2 hover:ring-ring transition-all"
                              style={{ backgroundColor: lane.color ?? '#6366f1' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (lanePopup?.laneId === lane.id && lanePopup?.field === 'color') {
                                  setLanePopup(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setLanePopup({ laneId: lane.id, field: 'color', rect });
                                }
                              }}
                            />

                            {/* Icon — click to edit */}
                            <span
                              className="text-base cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (lanePopup?.laneId === lane.id && lanePopup?.field === 'icon') {
                                  setLanePopup(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setLanePopup({ laneId: lane.id, field: 'icon', rect });
                                }
                              }}
                            >
                              {laneIcon}
                            </span>

                            <span className="text-xs font-bold truncate">{lane.name}</span>
                            <span className="text-[11px] text-muted-foreground shrink-0">{datedItems.length}{undatedItems.length > 0 ? <span className="text-muted-foreground/40">+{undatedItems.length}</span> : ''}</span>
                            <div className="flex-1 min-w-[4px]" />

                            <button
                              onClick={() => handleMoveLane(lane.id, 'up')}
                              disabled={laneIdx === 0}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground disabled:opacity-0 p-0.5 rounded transition-all"
                            >
                              <ChevronDown className="w-3 h-3 rotate-180" />
                            </button>
                            <button
                              onClick={() => handleMoveLane(lane.id, 'down')}
                              disabled={laneIdx === lanes.length - 1}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground disabled:opacity-0 p-0.5 rounded transition-all"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => handleDeleteLane(lane.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 rounded transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {!isCollapsed && (
                            <div className="relative" style={{ minHeight: '44px' }}>
                              {/* Background grid */}
                              <div className="flex absolute inset-0 pointer-events-none">
                                {gridColumns.map((col) => (
                                  <div
                                    key={col.key}
                                    className={`h-full shrink-0 ${col.isWeekend && viewSettings.showWeekends ? 'bg-muted/8' : ''} ${timeMode !== 'day' ? 'border-r border-border/30' : ''}`}
                                    style={{ width: `${col.width}px` }}
                                  />
                                ))}
                              </div>

                              <div className="relative" style={{ paddingBottom: '4px', height: `${Math.max(datedItems.length * 50 + 8, undatedItems.length * 50 + 8, 54)}px` }}>
                                {datedItems.map((item, itemIdx) => {
                                  const left = getItemPosition(item);
                                  const width = getItemWidth(item);
                                  if (left === null) return null;

                                  const isMilestone = viewSettings.showMilestones && (item.title.includes('🚀') || item.title.includes('Milestone') || item.title.includes('Release'));
                                  const barColor = lane.color ?? '#6366f1';
                                  const priorityColor = priorities?.find((p) => p.id === item.priorityId)?.color ?? barColor;
                                  const isLinkingSource = linkingMode && linkSource === item.id;
                                  const type = itemTypes?.find((t) => t.id === item.typeId);
                                  const dateStr = item.roadmapStartDate && item.roadmapDueDate
                                    ? formatRange(new Date(item.roadmapStartDate), new Date(item.roadmapDueDate))
                                    : '';
                                  const barH = isMilestone ? '50px' : '44px';

                                  return (
                                    <div
                                      key={item.id}
                                      data-bar-id={item.id}
                                      title={item.title}
                                      className={`absolute bar-wrapper z-10 ${isLinkingSource ? 'ring-2 ring-primary ring-offset-1 rounded-md' : ''} ${linkingMode && !linkSource ? 'cursor-crosshair' : ''} group`}
                                      style={{
                                        left: `${left}%`,
                                        width: `${Math.min(width, 95)}%`,
                                        top: `${itemIdx * 50 + 4}px`,
                                        height: barH,
                                      }}
                                    >
                                      <div
                                        className={`flex items-center gap-1 px-1.5 h-full rounded-md transition-all hover:brightness-110 hover:shadow-sm select-none ${isMilestone ? 'border-l-4 border-r-4' : 'border-l-[3px]'
                                          } ${linkingMode ? 'cursor-crosshair' : ''}`}
                                        style={{
                                          backgroundColor: `${barColor}18`,
                                          borderLeftColor: priorityColor,
                                          borderRightColor: isMilestone ? priorityColor : undefined,
                                        }}
                                        onClick={() => handleBarClick(item, barColor)}
                                        onMouseDown={(e) => { if (!linkingMode) handleBarMouseDown(e, item, 'move', barColor); }}
                                      >
                                        {isMilestone && <span className="text-[10px] shrink-0">◆</span>}
                                        {(() => {
                                          if (!type) return null;
                                          const iconName = type.icon ? (ICON_ALIASES[type.icon] ?? kebabToPascal(type.icon)) : null;
                                          const IconComp = iconName ? (icons as any)[iconName] : null;
                                          return IconComp
                                            ? <span className="shrink-0 flex items-center" style={{ color: type.color }}><IconComp className="w-3.5 h-3.5" /></span>
                                            : <span className="text-xs shrink-0 leading-none" style={{ color: type.color }}>{TYPE_ICON_MAP[type.name] || type.name[0]}</span>;
                                        })()}
                                        <span className="text-xs font-semibold truncate">{item.title}</span>
                                        {dateStr && <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden sm:inline">{dateStr}</span>}

                                        {!linkingMode && (
                                          <span className="flex items-center gap-0.5 mr-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setEditingItem({ item, laneColor: barColor }); }}
                                              className="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                              title="Edit dates"
                                            >
                                              <Calendar className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); window.open(`/projects/${slug}/items/${item.sequenceNum}`, '_blank'); }}
                                              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                              title="Open item"
                                            >
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleUnscheduleItem(item.id); }}
                                              className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                              title="Remove from roadmap"
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </span>
                                        )}

                                        {/* Connection point for creating dependencies — outside the bar */}
                                        {!linkingMode && (
                                          <div
                                            className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-card border-2 border-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-primary hover:border-primary cursor-crosshair transition-all z-20"
                                            onMouseDown={(e) => handleConnectStart(e, item)}
                                            title="Connect to another item"
                                          />
                                        )}
                                      </div>

                                      {!linkingMode && (
                                        <div
                                          className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize hover:bg-muted-foreground/10 rounded-r-[5px] transition-colors z-10 flex items-center justify-center group"
                                          onMouseDown={(e) => handleBarMouseDown(e, item, 'resize', barColor)}
                                        >
                                          <div className="w-px h-4 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/60" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {undatedItems.map((item) => {
                                  const barColor = lane.color ?? '#6366f1';
                                  return (
                                    <div
                                      key={item.id}
                                      title={item.title}
                                      className="flex items-center gap-2 px-3 py-1.5 mx-1 my-1 rounded-md border border-dashed border-border/60 bg-muted/10 group cursor-pointer hover:bg-muted/20 transition-colors"
                                      onClick={() => setEditingItem({ item, laneColor: barColor })}
                                    >
                                      <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">#{item.sequenceNum}</span>
                                      <span className="text-[11px] font-semibold text-muted-foreground/60 truncate flex-1">{item.title}</span>
                                      <span className="text-[10px] text-muted-foreground/40 italic shrink-0">no dates</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleUnscheduleItem(item.id); }}
                                        className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingItem({ item, laneColor: barColor }); }}
                                        className="p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors text-[10px] font-semibold"
                                      >
                                        Set dates →
                                      </button>
                                    </div>
                                  );
                                })}

                                {(laneItems.length === 0) && (
                                  <div className="text-[11px] text-muted-foreground/50 px-2 py-2 italic">
                                    Drop items here
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </DroppableLane>
                    );
                  })}

                </div>
              </div>

              {/* Add lane — outside overflow so it spans full card width */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/5">
                <input
                  type="text"
                  placeholder="New lane name..."
                  value={newLaneName}
                  onChange={(e) => setNewLaneName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddLane(); }}
                  className="flex-1 h-8 px-2.5 rounded-md border border-border bg-muted/30 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleAddLane}
                  disabled={!newLaneName.trim()}
                  className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add lane
                </button>
              </div>

              {/* Legend */}
              {viewSettings.showDependencies && relations.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/10">
                  <LinkIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {relations.length} connection{relations.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragItem && (
            <DragOverlayItem item={activeDragItem.item} statusColor={activeDragItem.statusColor} />
          )}
        </DragOverlay>
      </DndContext>

      {/* Lane color/icon popup — fixed overlay to avoid overflow clipping */}
      {lanePopup && (
        <div className="fixed inset-0 z-50" onClick={() => setLanePopup(null)}>
          <div
            className="absolute bg-card border border-border rounded-lg shadow-xl p-1.5"
            style={{ top: lanePopup.rect.bottom + 4, left: lanePopup.rect.left, minWidth: '40px' }}
            onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
          >
            {lanePopup.field === 'color' ? (
              <div className="flex gap-1">
                {LANE_PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-125 ${lanes.find(l => l.id === lanePopup.laneId)?.color === c ? 'ring-2 ring-ring ring-offset-1' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => { handleLaneUpdate(lanePopup.laneId, { color: c }); setLanePopup(null); }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex gap-1 flex-wrap w-48">
                {LANE_PRESET_ICONS.map((ic) => (
                  <button
                    key={ic}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-lg hover:bg-muted transition-colors ${lanes.find(l => l.id === lanePopup.laneId)?.icon === ic ? 'bg-muted ring-1 ring-ring' : ''}`}
                    onClick={() => { handleLaneUpdate(lanePopup.laneId, { icon: ic }); setLanePopup(null); }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Linking mode floating indicator */}
      {linkingMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-full shadow-lg inline-flex items-center gap-2">
          <LinkIcon className="w-3.5 h-3.5" />
          {linkSource ? 'Click target item to link' : 'Click source item first'}
          <button onClick={exitLinkingMode} className="ml-1 p-0.5 rounded hover:bg-primary-foreground/20 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Date edit popover */}
      {editingItem && (
        <DateEditPopover
          item={editingItem.item}
          laneColor={editingItem.laneColor}
          onSave={(data) => {
            handleItemDateUpdate(editingItem.item.id, data);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
