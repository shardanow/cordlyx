'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEscToClose } from '@/hooks/use-esc-to-close';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import RichEditor from '@/components/RichEditor';
import { icons, GripHorizontal } from 'lucide-react';

function kebabToPascal(str: string): string {
  return str.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const ICON_ALIASES: Record<string, string> = {
  'check-square': 'SquareCheckBig',
};

function TypeIcon({ name, className, color }: { name: string | null; className?: string; color?: string }) {
  if (!name) return null;
  const m = icons as unknown as Record<string, React.ComponentType<{ className?: string; color?: string }> | undefined>;
  const key = ICON_ALIASES[name] ?? kebabToPascal(name);
  const LucideIcon = m[key];
  if (LucideIcon) return <LucideIcon className={className ?? 'w-4 h-4'} color={color} />;
  return <span className="w-4 h-4 flex items-center justify-center text-xs" style={color ? { color } : undefined}>{name}</span>;
}

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface ItemType {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface ItemStatus {
  id: string; name: string; color: string; category: string;
}

export default function QuickCreateModal({
  open,
  onClose,
  sidebarOpen = true,
}: {
  open: boolean;
  onClose: () => void;
  sidebarOpen?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [projectSlug, setProjectSlug] = useState('');
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [planId, setPlanId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; sequenceNum: number; title: string }[]>([]);
  const [checkingDups, setCheckingDups] = useState(false);
  const [cardWidth, setCardWidth] = useState(480);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkDuplicates = useCallback((value: string) => {
    if (!value.trim() || !projectSlug) { setDuplicates([]); return; }
    setCheckingDups(true);
    api.post<{ duplicates: { id: string; sequenceNum: number; title: string }[] }>(
      `/projects/${projectSlug}/items/check-duplicates`, { title: value.trim() }
    ).then((res) => {
      setDuplicates(res.duplicates);
      setCheckingDups(false);
    }).catch(() => { setCheckingDups(false); });
  }, [projectSlug]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(() => checkDuplicates(value), 500);
  }, [checkDuplicates]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const sidebarWidth = sidebarOpen ? 256 : 64;
      const maxW = window.innerWidth - sidebarWidth - 32;
      const newWidth = Math.max(360, Math.min(maxW, startWidthRef.current + (e.clientX - startXRef.current)));
      setCardWidth(newWidth);
    }
    function onMouseUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [sidebarOpen]);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
    enabled: open,
  });

  const { data: types } = useQuery<ItemType[]>({
    queryKey: ['types', projectSlug],
    queryFn: () => api.get(`/projects/${projectSlug}/types`),
    enabled: open && !!projectSlug,
  });

  const { data: statuses } = useQuery<ItemStatus[]>({
    queryKey: ['statuses', projectSlug],
    queryFn: () => api.get(`/projects/${projectSlug}/statuses`),
    enabled: open && !!projectSlug,
  });

  interface Plan { id: string; name: string; type: string; color: string | null; }
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans', projectSlug],
    queryFn: () => api.get(`/projects/${projectSlug}/plans`),
    enabled: open && !!projectSlug,
  });

  useEscToClose(onClose, open);

  useEffect(() => {
    if (open && projects && projects.length > 0 && !projectSlug) {
      setProjectSlug(projects[0].slug);
    }
  }, [open, projects, projectSlug]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open && types && types.length > 0 && !typeId) {
      const defaultType = types.find((t) => t.name === 'Task') ?? types[0];
      setTypeId(defaultType.id);
    }
  }, [open, types, typeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !typeId || !projectSlug) return;

    setCreating(true);
    setError('');

    try {
      const res = await api.post<{ id: string; projectId: string; sequenceNum: number }>('/quick-create', {
        title: title.trim(),
        typeId,
        projectSlug,
        ...(description.trim() && { description: description.trim() }),
        ...(planId && { planId }),
      });

      queryClient.invalidateQueries({ queryKey: ['items', projectSlug] });
      queryClient.invalidateQueries({ queryKey: ['board', projectSlug] });
      setTitle('');
      setDescription('');
      setPlanId('');
      onClose();
      router.push(`/projects/${projectSlug}/items/${res.sequenceNum}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onPointerDown={onClose}>
      <div
        ref={cardRef}
        className="bg-card rounded-lg shadow-xl p-5 border border-border relative overflow-auto"
        style={{ width: cardWidth }}
        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-medium mb-4">Quick create</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Project</label>
            <Select value={projectSlug} onChange={(v) => { setProjectSlug(v); setTypeId(''); }}>
              <SelectTrigger className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground">
                {projects?.find((p) => p.slug === projectSlug)?.name ?? 'Select project'}
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectOption key={p.id} value={p.slug}>{p.name}</SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <input
              ref={inputRef}
              placeholder="Item title..."
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {duplicates.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-md border border-amber-500/30 bg-amber-500/5">
              <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">⚠️</span>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Similar items found:</p>
                {duplicates.map((d) => (
                  <p key={d.id} className="mb-0.5">
                    · <Link href={`/projects/${projectSlug}/items/${d.sequenceNum}`} className="underline hover:no-underline">#{d.sequenceNum} {d.title}</Link>
                  </p>
                ))}
                <p className="mt-1 text-amber-600/70 dark:text-amber-400/70">You can still create this item if it&apos;s different.</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <Select value={typeId} onChange={setTypeId}>
              <SelectTrigger className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground">
                {(() => { const t = types?.find((x) => x.id === typeId); return t ? <><TypeIcon name={t.icon} className="w-4 h-4 shrink-0" color={t.color} />{t.name}</> : <span>{types && types.length > 0 ? 'Select type' : 'No types available'}</span>; })()}
              </SelectTrigger>
              <SelectContent>
                {(types ?? []).map((t) => (
                  <SelectOption key={t.id} value={t.id}>
                    <TypeIcon name={t.icon} className="w-4 h-4 shrink-0" color={t.color} />
                    {t.name}
                  </SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Plan (optional)</label>
            <Select value={planId} onChange={setPlanId}>
              <SelectTrigger className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground">
                {plans?.find((p) => p.id === planId)?.name ?? 'No plan'}
              </SelectTrigger>
              <SelectContent>
                <SelectOption value="">No plan</SelectOption>
                {(plans ?? []).map((p) => (
                  <SelectOption key={p.id} value={p.id}>{p.name}</SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <RichEditor
              content={description}
              onChange={setDescription}
              placeholder="Add a description... (optional)"
              minHeight="100px"
            />
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim() || !typeId}
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>

        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-ew-resize flex items-center justify-center"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            resizingRef.current = true;
            startXRef.current = e.clientX;
            startWidthRef.current = cardWidth;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
          }}
        >
          <GripHorizontal className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
