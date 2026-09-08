'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken } from '@/lib/api-client';
import { toast } from 'sonner';
import { Download, Upload, Loader2 } from 'lucide-react';
import ImportItemsModal from '@/components/ImportItemsModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function download(path: string, filename: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function upload(path: string, file: File): Promise<any> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? 'Import failed');
  return body;
}

interface RowResult {
  status: string;
  title?: string;
  name?: string;
  error?: string;
}

function ResultSummary({ result }: { result: { data?: any; meta: Record<string, unknown> } | null }) {
  if (!result) return null;
  const rows: RowResult[] = Array.isArray(result.data) ? result.data : [];
  const failures = rows.filter((r) => r.status === 'failed');
  const meta = result.meta ?? {};
  const counts = ['created', 'updated', 'skipped', 'failed', 'unchanged']
    .filter((k) => typeof meta[k] === 'number')
    .map((k) => `${k}: ${meta[k]}`)
    .join(' · ');
  return (
    <div className="mt-2 text-xs">
      <p className="font-medium">{counts}{meta.dryRun ? ' (preview — nothing written)' : ''}</p>
      {failures.length > 0 && (
        <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto bg-muted/50 rounded p-2">
          {failures.slice(0, 8).map((f, i) => (
            <li key={i} className="text-red-600">{f.title ?? f.name ?? `row ${i + 1}`}: {f.error}</li>
          ))}
          {failures.length > 8 && <li>…and {failures.length - 8} more</li>}
        </ul>
      )}
    </div>
  );
}

function useFileImport(invalidateKeys: string[][], slug: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ data?: any; meta: Record<string, unknown> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingPath = useRef('');

  const pick = (path: string) => {
    pendingPath.current = path;
    setResult(null);
    inputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const body = await upload(pendingPath.current, file);
      setResult(body);
      if (!body?.meta?.dryRun) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [...key, slug] });
        }
        toast.success('Import finished');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,.json,.jsonl,.ndjson"
      className="hidden"
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return { busy, result, pick, input, setResult };
}

export default function DataTransferSection({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [itemsImportOpen, setItemsImportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<any>(null);
  const [snapshotMode, setSnapshotMode] = useState<'merge' | 'new'>('merge');
  const [newSlug, setNewSlug] = useState('');
  const snapshotInput = useRef<HTMLInputElement>(null);
  const snapshotDryRun = useRef(false);

  const plans = useFileImport([['plans']], slug);
  const config = useFileImport([['types'], ['statuses'], ['priorities'], ['tags']], slug);
  const roadmaps = useFileImport([['roadmaps']], slug);

  const { data: roadmapList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['roadmaps', slug],
    queryFn: () => api.get(`/projects/${slug}/roadmaps`),
  });
  const [selectedRoadmap, setSelectedRoadmap] = useState('');

  const doExport = async (key: string, path: string, filename: string) => {
    setExporting(key);
    try {
      await download(path, filename);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const runSnapshotImport = async (file: File | undefined) => {
    if (!file) return;
    setSnapshotBusy(true);
    try {
      const params = new URLSearchParams({
        dryRun: String(snapshotDryRun.current),
        dedupe: 'true',
      });
      const path =
        snapshotMode === 'merge'
          ? `/projects/${slug}/snapshot/import?${params}`
          : `/projects/snapshot/import-new?${params}${newSlug.trim() ? `&slug=${encodeURIComponent(newSlug.trim())}` : ''}`;
      const body = await upload(path, file);
      setSnapshotResult(body);
      if (!body?.meta?.dryRun && !body?.import?.meta?.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['items', slug] });
        queryClient.invalidateQueries({ queryKey: ['plans', slug] });
        queryClient.invalidateQueries({ queryKey: ['roadmaps', slug] });
        toast.success(snapshotMode === 'merge' ? 'Snapshot merged' : `Project created: ${body?.project?.slug}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Snapshot import failed');
    } finally {
      setSnapshotBusy(false);
    }
  };

  const btn =
    'h-8 px-3 rounded-md border border-border bg-card text-xs font-bold hover:bg-muted transition-colors inline-flex items-center gap-1.5 disabled:opacity-50';
  const busy = plans.busy || config.busy || roadmaps.busy || snapshotBusy || exporting !== null;

  return (
    <div className="mb-8 border border-border rounded-lg p-4">
      <h3 className="text-base font-medium mb-1">Data: import &amp; export</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Move data in and out of this project. Re-importing the same file only adds what is missing
        (matched by name, or title + type for items).
      </p>

      <div className="space-y-3">
        {/* Items */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border border-border rounded">
          <div className="flex-1 min-w-40">
            <p className="text-sm font-medium">Items</p>
            <p className="text-[11px] text-muted-foreground">Tasks, bugs, features… (CSV / JSON / JSONL)</p>
          </div>
          <button disabled={busy} className={btn} onClick={() => void doExport('items-csv', `/projects/${slug}/items/export?format=csv`, `${slug}-items.csv`)}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button disabled={busy} className={btn} onClick={() => void doExport('items-json', `/projects/${slug}/items/export?format=json`, `${slug}-items.json`)}>
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button disabled={busy} className={btn} onClick={() => setItemsImportOpen(true)}>
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </div>

        {/* Plans */}
        <div className="px-3 py-2.5 border border-border rounded">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-40">
              <p className="text-sm font-medium">Plans</p>
              <p className="text-[11px] text-muted-foreground">Releases, milestones, goals…</p>
            </div>
            <button disabled={busy} className={btn} onClick={() => void doExport('plans-csv', `/projects/${slug}/plans/export?format=csv`, `${slug}-plans.csv`)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button disabled={busy} className={btn} onClick={() => void doExport('plans-json', `/projects/${slug}/plans/export?format=json`, `${slug}-plans.json`)}>
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
            <button disabled={busy} className={btn} onClick={() => plans.pick(`/projects/${slug}/plans/import`)}>
              {plans.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import
            </button>
          </div>
          <ResultSummary result={plans.result} />
        </div>

        {/* Config */}
        <div className="px-3 py-2.5 border border-border rounded">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-40">
              <p className="text-sm font-medium">Project config</p>
              <p className="text-[11px] text-muted-foreground">Types, statuses, priorities, tags (JSON template, upsert by name)</p>
            </div>
            <button disabled={busy} className={btn} onClick={() => void doExport('config', `/projects/${slug}/config/export`, `${slug}-config.json`)}>
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button disabled={busy} className={btn} onClick={() => config.pick(`/projects/${slug}/config/import`)}>
              {config.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import
            </button>
          </div>
          <ResultSummary result={config.result} />
        </div>

        {/* Roadmaps */}
        <div className="px-3 py-2.5 border border-border rounded">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-40">
              <p className="text-sm font-medium">Roadmaps</p>
              <p className="text-[11px] text-muted-foreground">Timelines with lanes and schedule (items linked by number)</p>
            </div>
            <select
              value={selectedRoadmap}
              onChange={(e) => setSelectedRoadmap(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs max-w-44"
            >
              <option value="">All roadmaps</option>
              {(roadmapList ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              disabled={busy}
              className={btn}
              onClick={() =>
                void doExport(
                  'roadmaps',
                  selectedRoadmap ? `/projects/${slug}/roadmaps/${selectedRoadmap}/export` : `/projects/${slug}/roadmaps/export?format=json`,
                  selectedRoadmap ? `${slug}-roadmap.json` : `${slug}-roadmaps.json`,
                )
              }
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button disabled={busy} className={btn} onClick={() => roadmaps.pick(`/projects/${slug}/roadmaps/import`)}>
              {roadmaps.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import
            </button>
          </div>
          <ResultSummary result={roadmaps.result} />
        </div>

        {/* Snapshot */}
        <div className="px-3 py-2.5 border border-border rounded">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-40">
              <p className="text-sm font-medium">Full snapshot</p>
              <p className="text-[11px] text-muted-foreground">Everything above in one JSON file</p>
            </div>
            <button disabled={busy} className={btn} onClick={() => void doExport('snapshot', `/projects/${slug}/snapshot/export`, `${slug}-snapshot.json`)}>
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <select
              value={snapshotMode}
              onChange={(e) => setSnapshotMode(e.target.value as 'merge' | 'new')}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="merge">Merge into this project</option>
              <option value="new">Create new project</option>
            </select>
            {snapshotMode === 'new' && (
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="new-slug (optional)"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs w-36"
              />
            )}
            <button
              disabled={busy}
              className={btn}
              onClick={() => { snapshotDryRun.current = true; snapshotInput.current?.click(); }}
            >
              Preview
            </button>
            <button
              disabled={busy}
              className={btn}
              onClick={() => { snapshotDryRun.current = false; snapshotInput.current?.click(); }}
            >
              {snapshotBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import
            </button>
          </div>
          {snapshotResult && <SnapshotSummary result={snapshotResult} />}
        </div>
      </div>

      {plans.input}
      {config.input}
      {roadmaps.input}
      <input
        ref={snapshotInput}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          void runSnapshotImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ImportItemsModal
        slug={slug}
        open={itemsImportOpen}
        onClose={() => setItemsImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['items', slug] })}
      />
    </div>
  );

  function SnapshotSummary({ result }: { result: any }) {
    const sections = result?.meta?.sections ?? result?.import?.meta?.sections;
    if (!sections) return <ResultSummary result={result} />;
    const totals = Object.values(sections as Record<string, { created?: number; skipped?: number; failed?: number; updated?: number; unchanged?: number }>).reduce<{ created: number; skipped: number; failed: number }>(
      (acc, s) => ({
        created: acc.created + (s.created ?? 0),
        skipped: acc.skipped + (s.skipped ?? 0) + (s.unchanged ?? 0),
        failed: acc.failed + (s.failed ?? 0),
      }),
      { created: 0, skipped: 0, failed: 0 },
    );
    return (
      <div className="mt-2 text-xs space-y-0.5">
        <p className="font-medium">
          created: {totals.created} · skipped: {totals.skipped} · failed: {totals.failed}
          {(result?.meta?.dryRun || result?.import?.meta?.dryRun) ? ' (preview — nothing written)' : ''}
        </p>
        {result?.project?.slug && snapshotMode === 'new' && (
          <p>Project: <span className="font-mono">{result.project.slug}</span></p>
        )}
        {Object.entries(sections).map(([name, s]: [string, any]) => (
          <p key={name} className="text-muted-foreground">
            {name}: created {s.created ?? 0}, skipped {(s.skipped ?? 0) + (s.unchanged ?? 0)}, failed {s.failed ?? 0}
            {s.updated ? `, updated ${s.updated}` : ''}
          </p>
        ))}
      </div>
    );
  }
}
