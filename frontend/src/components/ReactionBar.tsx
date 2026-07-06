'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface ReactionGroup {
  count: number;
  users: { id: string; name: string; avatarUrl: string | null }[];
}

interface ReactionBarProps {
  reactions: Record<string, ReactionGroup>;
  currentUserId: string;
  onToggle: (emoji: string) => void;
  onAdd: (emoji: string) => void;
}

export default function ReactionBar({ reactions, currentUserId, onToggle, onAdd }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [pickerOpen]);

  const entries = Object.entries(reactions ?? {});

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {entries.map(([emoji, data]) => {
        const isMine = data.users.some((u) => u.id === currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(emoji); }}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full text-xs font-semibold border transition-colors ${
              isMine
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
            }`}
            title={data.users.map((u) => u.name).join(', ')}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span>{data.count}</span>
          </button>
        );
      })}
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPickerOpen(!pickerOpen); }}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {pickerOpen && (
          <div className="absolute z-50 bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg p-1.5 flex gap-1">
            {['👍', '❤️', '😄', '🎉', '🚀', '👀', '👎', '😠'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(emoji); setPickerOpen(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-md text-lg hover:bg-muted transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
