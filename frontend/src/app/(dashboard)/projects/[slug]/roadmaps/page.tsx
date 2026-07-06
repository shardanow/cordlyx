'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Plus, Map, Calendar, ArrowRight, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useEscToClose } from '@/hooks/use-esc-to-close';

interface Roadmap {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  color: string | null;
  sortOrder: number;
}

export default function RoadmapsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const { data: project } = useQuery<{ id: string; name: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data: roadmaps, isLoading } = useQuery<Roadmap[]>({
    queryKey: ['roadmaps', slug],
    queryFn: () => api.get(`/projects/${slug}/roadmaps`),
  });

  const closeModal = () => { setShowCreate(false); setEditingRoadmap(null); setNewName(''); setNewStart(''); setNewEnd(''); setNewColor('#6366f1'); };
  useEscToClose(closeModal, showCreate || !!editingRoadmap);

  const filtered = (roadmaps ?? []).filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = async () => {
    if (!newName.trim() || !newStart || !newEnd) return;
    try {
      await api.post(`/projects/${slug}/roadmaps`, {
        name: newName.trim(),
        startDate: newStart,
        endDate: newEnd,
        color: newColor,
      });
      queryClient.invalidateQueries({ queryKey: ['roadmaps', slug] });
      setShowCreate(false);
      setNewName('');
      setNewStart('');
      setNewEnd('');
      toast.success('Roadmap created');
    } catch {
      toast.error('Failed to create roadmap');
    }
  };

  const handleEdit = (roadmap: Roadmap) => {
    setEditingRoadmap(roadmap);
    setNewName(roadmap.name);
    setNewStart(roadmap.startDate.slice(0, 10));
    setNewEnd(roadmap.endDate.slice(0, 10));
    setNewColor(roadmap.color ?? '#6366f1');
  };

  const handleUpdate = async () => {
    if (!editingRoadmap || !newName.trim() || !newStart || !newEnd) return;
    try {
      await api.patch(`/projects/${slug}/roadmaps/${editingRoadmap.id}`, {
        name: newName.trim(),
        startDate: newStart,
        endDate: newEnd,
        color: newColor,
      });
      queryClient.invalidateQueries({ queryKey: ['roadmaps', slug] });
      setEditingRoadmap(null);
      setNewName('');
      setNewStart('');
      setNewEnd('');
      setNewColor('#6366f1');
      toast.success('Roadmap updated');
    } catch {
      toast.error('Failed to update roadmap');
    }
  };

  const handleDelete = async (roadmapId: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/projects/${slug}/roadmaps/${roadmapId}`);
      queryClient.invalidateQueries({ queryKey: ['roadmaps', slug] });
      toast.success('Roadmap deleted');
    } catch {
      toast.error('Failed to delete roadmap');
    }
  };

  function formatDateRange(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">Roadmaps</span>
      </div>

      {/* Title row */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roadmaps</h1>
          <p className="text-base md:text-md text-muted-foreground">{roadmaps?.length ?? 0} roadmaps</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-[46px] md:h-[50px] px-5 md:px-6 rounded-[10px] bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2.5"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Create roadmap</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <label className="h-[50px] w-full max-w-sm flex items-center gap-2.5 px-3.5 rounded-[10px] border border-border bg-muted/50 cursor-text transition-colors focus-within:ring-1 focus-within:ring-ring">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search roadmaps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-0 min-w-0"
          />
        </label>
      </div>

      {/* Roadmap cards */}
      <div className="space-y-2">
        {filtered.map((roadmap) => (
          <div
            key={roadmap.id}
            onClick={() => router.push(`/projects/${slug}/roadmaps/${roadmap.id}`)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all cursor-pointer"
          >
            <div
              className="w-3 h-12 rounded-full shrink-0"
              style={{ backgroundColor: roadmap.color ?? '#6366f1' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-bold text-base truncate">{roadmap.name}</span>
              </div>
              {roadmap.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{roadmap.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{formatDateRange(roadmap.startDate, roadmap.endDate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/projects/${slug}/roadmaps/${roadmap.id}`); }}
                className="h-9 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors inline-flex items-center gap-1"
              >
                Open
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(roadmap); }}
                className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Edit roadmap"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(roadmap.id, roadmap.name); }}
                className="h-9 px-3 rounded-lg text-muted-foreground text-xs font-bold hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {search ? 'No roadmaps matching your search' : 'No roadmaps yet. Create your first one!'}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {(showCreate || editingRoadmap) && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onPointerDown={closeModal}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingRoadmap ? 'Edit roadmap' : 'Create roadmap'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Q3 2024 Release"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Start date</label>
                  <input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">End date</label>
                  <input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Color</label>
                <div className="flex gap-2">
                  {['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#a855f7'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="h-10 px-4 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingRoadmap ? handleUpdate : handleCreate}
                disabled={!newName.trim() || !newStart || !newEnd}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {editingRoadmap ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
