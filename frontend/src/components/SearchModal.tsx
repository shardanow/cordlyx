'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { Search, FileText, Loader2, X } from 'lucide-react';

interface SearchResult {
  id: string;
  sequenceNum: number;
  title: string;
  projectSlug?: string;
  projectName?: string;
}

export default function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<{ data: SearchResult[] }>(`/search?q=${encodeURIComponent(query.trim())}&limit=10`);
        setResults(data.data ?? []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const navigate = useCallback(
    (result: SearchResult) => {
      if (result.projectSlug) {
        router.push(`/projects/${result.projectSlug}/items/${result.sequenceNum}`);
      }
      onClose();
    },
    [router, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onPointerDown={onClose}>
      <div
        className="bg-card rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            placeholder="Search items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm outline-none placeholder:text-muted-foreground bg-transparent text-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">No results found.</div>
          )}

          {results.map((result, i) => (
            <button
              key={result.id}
              onClick={() => navigate(result)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                i === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                #{result.sequenceNum}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{result.title}</div>
                {result.projectName && (
                  <div className="text-xs text-muted-foreground truncate">{result.projectName}</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="p-2 border-t border-border flex gap-4 justify-end px-4">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">↑↓ <kbd className="text-[10px] bg-muted text-muted-foreground px-1 py-0.5 rounded border border-border font-mono">Navigate</kbd></span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">↵ <kbd className="text-[10px] bg-muted text-muted-foreground px-1 py-0.5 rounded border border-border font-mono">Open</kbd></span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">Esc <kbd className="text-[10px] bg-muted text-muted-foreground px-1 py-0.5 rounded border border-border font-mono">Close</kbd></span>
          </div>
        )}
      </div>
    </div>
  );
}
