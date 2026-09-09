'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import {
  Ban,
  ArrowLeftRight,
  Link2,
  Copy,
  ListTree,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type { RelationType } from '@cordlyx/shared';
import { cn } from '@/lib/utils';

export interface ChipTag {
  id: string;
  name: string;
  color: string | null;
}

/** Tag = filled pill in its own color (muted fallback when colorless). Distinct shape from relation chips. */
export function TagChip({ tag, onRemove, small }: { tag: ChipTag; onRemove?: () => void; small?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full font-semibold inline-flex items-center gap-1 border border-border bg-muted/50 text-muted-foreground',
        small ? 'h-6 px-2.5 text-xs' : 'h-8 px-2.5 text-sm',
      )}
      style={
        tag.color
          ? { color: tag.color, backgroundColor: `${tag.color}1f`, borderColor: `${tag.color}45` }
          : undefined
      }
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="opacity-70 hover:opacity-100" aria-label={`Remove tag ${tag.name}`}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
}

const RELATION_STYLE: Record<RelationType, { color: string; bg: string; border: string; icon: LucideIcon; label: string }> = {
  blocks: { color: '#ef4444', bg: '#ef444414', border: '#ef444452', icon: Ban, label: 'blocks' },
  depends_on: { color: '#f59e0b', bg: '#f59e0b14', border: '#f59e0b52', icon: ArrowLeftRight, label: 'depends on' },
  relates_to: { color: '#64748b', bg: '#64748b14', border: '#64748b52', icon: Link2, label: 'relates to' },
  duplicates: { color: '#a855f7', bg: '#a855f714', border: '#a855f752', icon: Copy, label: 'duplicates' },
  child_of: { color: '#22c55e', bg: '#22c55e14', border: '#22c55e52', icon: ListTree, label: 'child of' },
  next_action: { color: '#06b6d4', bg: '#06b6d414', border: '#06b6d452', icon: ArrowRight, label: 'next' },
};

/** Relation = outlined box with semantic icon+color per relation type (not just grey). */
export function RelationChip({
  type,
  seq,
  title,
  href,
  onRemove,
}: {
  type: RelationType;
  seq: number;
  title: string;
  href?: string;
  onRemove?: () => void;
}) {
  const s = RELATION_STYLE[type] ?? RELATION_STYLE.relates_to;
  const Icon = s.icon;
  const body = (
    <span
      className="h-8 px-2.5 rounded-lg text-sm inline-flex items-center gap-2 border"
      style={{ borderColor: s.border, backgroundColor: s.bg }}
      title={s.label}
    >
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide" style={{ color: s.color }}>
        <Icon className="w-3.5 h-3.5" />
        {s.label}
      </span>
      <span className="text-foreground font-medium truncate max-w-[220px]">
        #{seq} {title}
      </span>
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground" aria-label="Remove relation">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
