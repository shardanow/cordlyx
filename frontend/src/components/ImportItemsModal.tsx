'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAccessToken } from '@/lib/api-client';
import { useEscToClose } from '@/hooks/use-esc-to-close';
import { toast } from 'sonner';
import { X, Upload, Loader2 } from 'lucide-react';

interface ImportRowResult {
  index: number;
  status: 'created' | 'skipped' | 'failed';
  sequenceNum?: number | null;
  title: string;
  error?: string;
}

interface ImportResponse {
  data: ImportRowResult[];
  meta: { created: number; skipped: number; failed: number; dryRun: boolean; dedupe: boolean; format?: string };
}

interface Props {
  slug: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportItemsModal({ slug, open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEscToClose(onClose, open);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const runImport = async (dryRun: boolean) => {
    if (!file) {
      toast.error('Choose a file first (.csv, .json, .jsonl)');
      return;
    }
    setBusy(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const token = getAccessToken();
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${baseUrl}/projects/${slug}/items/import?dryRun=${dryRun}`, {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? 'Import failed');
      if (dryRun) {
        setPreview(body as ImportResponse);
      } else {
        setResult(body as ImportResponse);
        onImported();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const summary = result ?? preview;
  const failures = (summary?.data ?? []).filter((r) => r.status === 'failed');

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onPointerDown={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">Import items</h3>
          <button onClick={() => { reset(); onClose(); }} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          Upload a <code>.csv</code>, <code>.json</code> or <code>.jsonl</code> file (max 10 MB, 100 rows).
          Columns: Title*, Type, Status, Priority, Assignee (email), Due Date, Est. Hours, Tags, Plan.
          Re-importing the same file skips existing items (matched by title + type).
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,.jsonl,.ndjson"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setResult(null);
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-12 rounded-[10px] border border-dashed border-border bg-muted/50 text-sm font-medium hover:bg-muted transition-colors inline-flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {file ? file.name : 'Choose file'}
        </button>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => runImport(true)}
            disabled={!file || busy}
            className="flex-1 h-10 rounded-[10px] border border-border text-sm font-bold hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Preview
          </button>
          <button
            onClick={() => runImport(false)}
            disabled={!file || busy}
            className="flex-1 h-10 rounded-[10px] bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Import
          </button>
        </div>

        {summary && (
          <div className="mt-4 text-sm">
            <div className="flex gap-4 font-medium">
              <span className="text-green-600">Created: {summary.meta.created}</span>
              <span className="text-muted-foreground">Skipped: {summary.meta.skipped}</span>
              <span className="text-red-600">Failed: {summary.meta.failed}</span>
            </div>
            {summary.meta.dryRun && (
              <p className="text-muted-foreground mt-1">Preview only — nothing was written. Click Import to apply.</p>
            )}
            {failures.length > 0 && (
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto text-xs bg-muted/50 rounded p-2">
                {failures.slice(0, 20).map((f) => (
                  <li key={f.index}>
                    <span className="font-medium">Row {f.index + 1} ({f.title || 'no title'}):</span>{' '}
                    <span className="text-red-600">{f.error}</span>
                  </li>
                ))}
                {failures.length > 20 && <li>…and {failures.length - 20} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
