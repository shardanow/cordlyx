'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api-client';
import { X } from 'lucide-react';
import { useEscToClose } from '@/hooks/use-esc-to-close';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CreateProjectModal({
  open,
  onClose,
  onCreated,
  project,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  project?: Project | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!project;
  useEscToClose(onClose, open);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (open && project) {
      setName(project.name);
      setSlug(project.slug);
      setDescription(project.description ?? '');
      setSlugTouched(true);
      setError('');
    } else if (!open) {
      setName('');
      setSlug('');
      setDescription('');
      setError('');
      setSlugTouched(false);
    }
  }, [open, project]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const updated = await api.patch<Project>(`/projects/${project!.slug}`, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        });
        onCreated(updated);
      } else {
        const created = await api.post<Project>('/projects', {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
        });
        onCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} project`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onPointerDown={onClose}>
      <div
        className="bg-card rounded-lg shadow-xl w-full max-w-md p-5 border border-border"
        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-medium">{isEdit ? 'Edit project' : 'Create project'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <input
              ref={inputRef}
              placeholder="Project name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Slug</label>
            <input
              placeholder="project-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              required
              pattern="[a-z0-9-]+"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
            <textarea
              placeholder="Project description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
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
              disabled={saving || !name.trim() || !slug.trim()}
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
