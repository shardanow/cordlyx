'use client';

import React, { useEffect, useRef } from 'react';
import {
  Plus, Search, Keyboard, X, ArrowUp, ArrowDown, CornerDownLeft,
} from 'lucide-react';

interface Shortcut {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  keys: string;
}

const SHORTCUTS: Shortcut[] = [
  { icon: Plus, label: 'Quick create item', keys: '⌘K / Ctrl+K' },
  { icon: Search, label: 'Search items', keys: '/' },
  { icon: Keyboard, label: 'Show this help', keys: '?' },
  { icon: X, label: 'Close modals / Cancel', keys: 'Esc' },
  { icon: ArrowUp, label: 'Navigate search results', keys: '↑ / ↓' },
  { icon: CornerDownLeft, label: 'Open selected item', keys: 'Enter' },
];

export default function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onPointerDown={() => onClose()}
    >
      <div
        ref={containerRef}
        className="bg-card rounded-lg shadow-xl p-5 w-full max-w-md border border-border"
        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-medium">Keyboard shortcuts</h2>
          <button
            onClick={() => onClose()}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map(({ icon: Icon, label, keys }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors"
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm text-muted-foreground">{label}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border text-muted-foreground">{keys}</kbd>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border">?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
