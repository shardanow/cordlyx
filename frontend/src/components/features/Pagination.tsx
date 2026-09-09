'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
  onLimit?: (limit: number) => void;
  limits?: number[];
}

const btn =
  'min-w-[46px] h-[46px] px-3 rounded-[10px] border border-border bg-card text-muted-foreground grid place-items-center disabled:opacity-50 disabled:cursor-default hover:bg-muted transition-colors text-sm font-bold';

/** Reusable page-based pagination: "{limit} of {total} · page X of Y" + jump input + limit selector. */
export function Pagination({ page, totalPages, total, limit, onPage, onLimit, limits = [25, 50, 100] }: PaginationProps) {
  const [jump, setJump] = useState(String(page));
  useEffect(() => setJump(String(page)), [page]);

  const commitJump = () => {
    const n = Number.parseInt(jump, 10);
    if (!Number.isFinite(n)) {
      setJump(String(page));
      return;
    }
    onPage(Math.min(Math.max(1, n), Math.max(1, totalPages)));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mt-6 text-base text-muted-foreground">
      <span>
        {limit} of {total} · page {page} of {Math.max(1, totalPages)}
      </span>
      <div className="flex items-center gap-2">
        {onLimit && (
          <select
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            className="h-[46px] rounded-[10px] border border-border bg-card px-3 text-sm font-bold text-foreground"
            aria-label="Items per page"
          >
            {limits.map((l) => (
              <option key={l} value={l}>
                {l} / page
              </option>
            ))}
          </select>
        )}
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn} aria-label="Previous page">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitJump();
            }}
            onBlur={commitJump}
            inputMode="numeric"
            className="w-16 h-[46px] rounded-[10px] border border-border bg-card text-center text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-ring"
            aria-label="Go to page"
          />
          <span className="text-muted-foreground">/ {Math.max(1, totalPages)}</span>
        </span>
        <button
          disabled={page >= Math.max(1, totalPages)}
          onClick={() => onPage(page + 1)}
          className={btn}
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
