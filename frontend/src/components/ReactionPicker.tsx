'use client';

import { useRef, useEffect } from 'react';

const PRESET_REACTIONS = ['👍', '❤️', '😄', '🎉', '🚀', '👀', '👎', '😠'];

export default function ReactionPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg p-1.5 flex gap-1"
    >
      {PRESET_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(emoji); }}
          className="w-8 h-8 flex items-center justify-center rounded-md text-lg hover:bg-muted transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
