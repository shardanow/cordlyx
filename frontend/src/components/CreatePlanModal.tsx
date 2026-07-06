'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEscToClose } from '@/hooks/use-esc-to-close';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string | null;
  color: string | null;
  status: string;
}

const PLAN_TYPES = [
  { value: 'release', label: 'Release' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'goal', label: 'Goal' },
  { value: 'custom', label: 'Custom' },
] as const;

const PLAN_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const TYPE_COLORS: Record<string, string> = {
  release: '#3B82F6',
  milestone: '#8B5CF6',
  campaign: '#F59E0B',
  goal: '#10B981',
  custom: '#6B7280',
};

export default function CreatePlanModal({
  projectSlug,
  open,
  onClose,
  onCreated,
  plan,
}: {
  projectSlug: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (plan: Plan) => void;
  plan?: Plan | null;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!plan;
  useEscToClose(onClose, open);

  const [name, setName] = useState('');
  const [type, setType] = useState('release');
  const [status, setStatus] = useState('active');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();

    if (open && plan) {
      setName(plan.name);
      setType(plan.type);
      setStatus(plan.status);
      setDescription(plan.description ?? '');
      setError('');
    } else if (!open) {
      setName('');
      setType(PLAN_TYPES[0].value);
      setStatus('active');
      setDescription('');
      setError('');
    }
  }, [open, plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const updated = await api.patch<Plan>(`/projects/${projectSlug}/plans/${plan!.id}`, {
          name: name.trim(),
          type,
          status,
          description: description.trim() || undefined,
          color: TYPE_COLORS[type],
        });
        queryClient.invalidateQueries({ queryKey: ['plans', projectSlug] });
        if (onCreated) onCreated(updated);
      } else {
        const created = await api.post<Plan>(`/projects/${projectSlug}/plans`, {
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          color: TYPE_COLORS[type],
        });
        queryClient.invalidateQueries({ queryKey: ['plans', projectSlug] });
        if (onCreated) onCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} plan`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onPointerDown={onClose}>
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md p-5 border border-border" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-medium">{isEdit ? 'Edit plan' : 'Create plan'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <input
              ref={inputRef}
              placeholder="Plan name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <Select value={type} onChange={setType}>
              <SelectTrigger className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground">
                {PLAN_TYPES.find((t) => t.value === type)?.label}
              </SelectTrigger>
              <SelectContent>
                {PLAN_TYPES.map((t) => (
                  <SelectOption key={t.value} value={t.value}>{t.label}</SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onChange={setStatus}>
              <SelectTrigger className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground">
                {PLAN_STATUSES.find((s) => s.value === status)?.label}
              </SelectTrigger>
              <SelectContent>
                {PLAN_STATUSES.map((s) => (
                  <SelectOption key={s.value} value={s.value}>{s.label}</SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
            <textarea
              placeholder="Plan description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
