'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import Spinner from '@/components/Spinner';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
}

interface ConfigItem {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  category?: string;
  isDefault: boolean;
  sortOrder: number;
}

interface Member {
  id: string;
  userId: string;
  role: string;
}

const STATUS_CATEGORIES = ['inbox', 'backlog', 'todo', 'active', 'done', 'cancelled'];

function ItemConfigEditor({
  endpoint,
  items,
  onAdd,
  onUpdate,
  onDelete,
  showCategory,
}: {
  endpoint: string;
  items: ConfigItem[];
  onAdd: (data: Record<string, string>) => Promise<void>;
  onUpdate: (id: string, data: Record<string, string>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showCategory?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [category, setCategory] = useState('todo');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(''); setColor('#3B82F6'); setCategory('todo');
    setShowForm(false); setEditId(null);
  };

  const startEdit = (item: ConfigItem) => {
    setName(item.name); setColor(item.color);
    if (showCategory && item.category) setCategory(item.category);
    setEditId(item.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, string> = { name: name.trim(), color };
      if (showCategory) data.category = category;
      if (editId) {
        await onUpdate(editId, data);
      } else {
        await onAdd(data);
      }
      reset();
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const label = endpoint.charAt(0).toUpperCase() + endpoint.slice(1);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium">Item {label}</h3>
        <button
          onClick={() => { reset(); setShowForm(!showForm); }}
          className="text-sm text-primary hover:underline"
        >
          {showForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 border border-border rounded space-y-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-input"
            />
            <span className="text-xs text-muted-foreground">{color}</span>
          </div>
          {showCategory && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STATUS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
          </button>
        </form>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2 border border-border rounded text-sm">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="flex-1">{item.name}</span>
            {item.category && (
              <span className="text-xs text-muted-foreground capitalize">{item.category}</span>
            )}
            {item.isDefault && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">default</span>
            )}
            <button onClick={() => startEdit(item)} className="text-xs text-muted-foreground hover:text-foreground">
              Edit
            </button>
            {!item.isDefault && (
              <button onClick={() => onDelete(item.id)} className="text-xs text-destructive hover:text-destructive/80 transition-colors">
                Delete
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground py-2">None configured.</div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const { data: project } = useQuery<Project>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState('');

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description ?? '');
      setEditSlug(project.slug);
    }
  }, [project]);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editSlug.trim()) return;
    setSavingProject(true);
    setProjectError('');
    try {
      await api.patch(`/projects/${slug}`, {
        name: editName.trim(),
        slug: editSlug.trim(),
        description: editDescription.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ['project', slug] });
      toast.success('Project saved');
      if (editSlug.trim() !== slug) {
        router.push(`/projects/${editSlug.trim()}/settings`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save project';
      setProjectError(msg);
      toast.error(msg);
    } finally {
      setSavingProject(false);
    }
  };

  const { data: types, isLoading: typesLoading } = useQuery<ConfigItem[]>({
    queryKey: ['types', slug],
    queryFn: () => api.get(`/projects/${slug}/types`),
  });

  const { data: statuses, isLoading: statusesLoading } = useQuery<ConfigItem[]>({
    queryKey: ['statuses', slug],
    queryFn: () => api.get(`/projects/${slug}/statuses`),
  });

  const { data: priorities, isLoading: prioritiesLoading } = useQuery<ConfigItem[]>({
    queryKey: ['priorities', slug],
    queryFn: () => api.get(`/projects/${slug}/priorities`),
  });

  const { data: tags, isLoading: tagsLoading } = useQuery<ConfigItem[]>({
    queryKey: ['tags', slug],
    queryFn: () => api.get(`/projects/${slug}/tags`),
  });

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ['members', slug],
    queryFn: () => api.get(`/projects/${slug}/members`),
  });

  const currentMember = members?.find((m) => m.userId === currentUser?.id);
  const isAdmin = currentMember?.role === 'admin';

  const onAdd = (endpoint: string) => async (data: Record<string, string>) => {
    try {
      await api.post(`/projects/${slug}/${endpoint}`, data);
      queryClient.invalidateQueries({ queryKey: [endpoint, slug] });
      toast.success(`${endpoint} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const onUpdate = (endpoint: string) => async (id: string, data: Record<string, string>) => {
    try {
      await api.patch(`/projects/${slug}/${endpoint}/${id}`, data);
      queryClient.invalidateQueries({ queryKey: [endpoint, slug] });
      toast.success(`${endpoint} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const onDelete = (endpoint: string) => async (id: string) => {
    try {
      await api.delete(`/projects/${slug}/${endpoint}/${id}`);
      queryClient.invalidateQueries({ queryKey: [endpoint, slug] });
      toast.success(`${endpoint} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-sm text-muted-foreground">
        Only project admins can change settings.
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">Settings</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
        Project Settings
        {(typesLoading || statusesLoading || prioritiesLoading || tagsLoading || membersLoading) && <Spinner size="sm" />}
      </h1>

      {/* Project Details */}
      <div className="mb-8 border border-border rounded-lg p-4">
        <h3 className="text-base font-medium mb-3">Project Details</h3>
        <form onSubmit={handleSaveProject} className="space-y-3">
          <input
            placeholder="Project name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <textarea
            placeholder="Description (optional)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          <div>
            <div className="flex items-center gap-2">
              <input
                placeholder="slug"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">/{editSlug || slug}</span>
            </div>
            {editSlug !== slug && (
              <p className="text-[11px] text-amber-500 mt-1">
                Changing the slug will change the project URL. All bookmarks and links to this project will break.
              </p>
            )}
          </div>
          {projectError && (
            <p className="text-xs text-destructive">{projectError}</p>
          )}
          <button
            type="submit"
            disabled={savingProject || !editName.trim() || !editSlug.trim()}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
          >
            {savingProject ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      <ItemConfigEditor
        endpoint="types"
        items={types ?? []}
        onAdd={onAdd('types')}
        onUpdate={onUpdate('types')}
        onDelete={onDelete('types')}
      />

      <ItemConfigEditor
        endpoint="statuses"
        items={statuses ?? []}
        onAdd={onAdd('statuses')}
        onUpdate={onUpdate('statuses')}
        onDelete={onDelete('statuses')}
        showCategory
      />

      <ItemConfigEditor
        endpoint="priorities"
        items={priorities ?? []}
        onAdd={onAdd('priorities')}
        onUpdate={onUpdate('priorities')}
        onDelete={onDelete('priorities')}
      />

      <ItemConfigEditor
        endpoint="tags"
        items={tags ?? []}
        onAdd={onAdd('tags')}
        onUpdate={onUpdate('tags')}
        onDelete={onDelete('tags')}
      />

      {/* Webhooks */}
      <div className="border border-border rounded-lg p-4">
        <h3 className="text-base font-medium mb-3">Webhooks</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Send HTTP POST requests when events occur in this project.
        </p>

        <div className="space-y-3 mb-4">
          <WebhookList slug={slug} />
        </div>

        <WebhookForm slug={slug} />
      </div>
    </div>
  );
}

// --- Webhook sub-components ---

const ITEM_EVENTS = [
  'item.created', 'item.updated', 'item.deleted',
  'comment.created', 'comment.updated', 'comment.deleted',
  'attachment.created', 'attachment.deleted',
];

function WebhookList({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const { data: webhooks } = useQuery<any[]>({
    queryKey: ['webhooks', slug],
    queryFn: () => api.get(`/projects/${slug}/webhooks`),
  });

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    await api.delete(`/projects/${slug}/webhooks/${id}`);
    queryClient.invalidateQueries({ queryKey: ['webhooks', slug] });
  };

  if (!webhooks || webhooks.length === 0) {
    return <p className="text-xs text-muted-foreground">No webhooks configured.</p>;
  }

  return (
    <div className="divide-y divide-border border border-border rounded">
      {webhooks.map((w: any) => (
        <div key={w.id} className="flex items-center gap-3 px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono truncate">{w.url}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{w.events?.join(', ') ?? 'All events'}</p>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${w.isActive ? 'bg-green-600/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
            {w.isActive ? 'Active' : 'Paused'}
          </span>
          <button
            onClick={() => remove(w.id)}
            className="text-[10px] text-destructive hover:text-destructive/80 shrink-0"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function WebhookForm({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const toggleEvent = (e: string) => {
    setEvents((prev) => prev.includes(e) ? prev.filter((v) => v !== e) : [...prev, e]);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    try {
      await api.post(`/projects/${slug}/webhooks`, { url: url.trim(), events });
      setUrl('');
      setEvents([]);
      queryClient.invalidateQueries({ queryKey: ['webhooks', slug] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add webhook');
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={handleAdd} className="space-y-3">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/webhook"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap gap-1.5">
        {ITEM_EVENTS.map((ev) => (
          <label key={ev} className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-[10px] cursor-pointer hover:bg-muted/80 transition-colors">
            <input
              type="checkbox"
              checked={events.includes(ev)}
              onChange={() => toggleEvent(ev)}
              className="w-3 h-3"
            />
            {ev}
          </label>
        ))}
      </div>
      {!events.length && <p className="text-[10px] text-muted-foreground">Leave empty to receive all events.</p>}
      <button
        type="submit"
        disabled={adding || !url.trim()}
        className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
      >
        {adding ? 'Adding...' : 'Add webhook'}
      </button>
    </form>
  );
}
