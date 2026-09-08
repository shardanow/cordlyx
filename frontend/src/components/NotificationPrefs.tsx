'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface PrefsRow {
  projectId: string;
  projectSlug: string;
  projectName: string;
  muted: boolean;
  emailDigest: boolean;
  digestHour: number;
}

interface Project {
  id: string;
  name: string;
  slug: string;
}

export default function NotificationPrefs() {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  });

  const { data: prefs } = useQuery<PrefsRow[]>({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get('/notifications/prefs'),
  });

  const prefOf = (projectId: string): PrefsRow | undefined =>
    prefs?.find((p) => p.projectId === projectId);

  const save = async (slug: string, patch: Partial<Pick<PrefsRow, 'muted' | 'emailDigest' | 'digestHour'>>) => {
    try {
      await api.put(`/notifications/prefs/${slug}`, patch);
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await api.post<{ sent: boolean; reason?: string }>('/notifications/digest/send');
      toast.success(res.sent ? 'Digest sent — check your inbox' : `Not sent: ${res.reason ?? 'unknown'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send digest');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">Notifications</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Mute projects or get unread notifications by email. Digest emails require server SMTP configuration.
      </p>

      <div className="mb-4 border border-border rounded divide-y divide-border">
        {(projects ?? []).map((p) => {
          const pref = prefOf(p.id);
          return (
            <div key={p.id} className="px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm font-medium flex-1 min-w-32">{p.name}</span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={pref?.muted ?? false}
                  onChange={(e) => void save(p.slug, { muted: e.target.checked })}
                  className="w-3.5 h-3.5"
                />
                Mute
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={pref?.emailDigest ?? false}
                  onChange={(e) => void save(p.slug, { emailDigest: e.target.checked })}
                  className="w-3.5 h-3.5"
                />
                Email digest
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                at
                <select
                  value={pref?.digestHour ?? 8}
                  onChange={(e) => void save(p.slug, { digestHour: Number(e.target.value) })}
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
        {(projects ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2.5">No projects yet.</p>
        )}
      </div>

      <button
        onClick={() => void sendNow()}
        disabled={sending}
        className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send digest now'}
      </button>
    </div>
  );
}
