'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { TypeBadge } from '@/components/features/TypeBadge';
import { StatusDot } from '@/components/features/StatusDot';
import { TagChip } from '@/components/features/Chips';
import { bodyExcerpt } from '@/lib/markdown';
import type { ItemType, ItemStatus, ItemPriority, ProjectMember, Plan } from '@/lib/project-data';

interface ChildItem {
  id: string;
  sequenceNum: number;
  title: string;
  typeId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  parentId: string | null;
  planId: string | null;
  description: string | null;
  createdAt: string;
}

export function TreeChildren({
  slug,
  parentId,
  depth,
  types,
  statuses,
  priorities,
  members,
  plans,
}: {
  slug: string;
  parentId: string;
  depth: number;
  types: ItemType[];
  statuses: ItemStatus[];
  priorities: ItemPriority[];
  members: ProjectMember[];
  plans: Plan[];
}) {
  const { data, isLoading } = useQuery<{ data: ChildItem[] }>({
    queryKey: ['item-children', slug, parentId],
    queryFn: () => api.get(`/projects/${slug}/items/${parentId}/children`),
  });
  const children = data?.data ?? [];
  if (isLoading) {
    return <div className="ml-8 text-sm text-muted-foreground py-1">Loading…</div>;
  }
  if (!children.length) {
    return <div className="ml-8 text-sm text-muted-foreground py-1">No subtasks</div>;
  }
  return (
    <div className="ml-6 border-l border-border pl-3 space-y-2 mt-2">
      {children.map((child) => {
        const type = types.find((t) => t.id === child.typeId);
        const status = statuses.find((s) => s.id === child.statusId);
        const plan = plans.find((p) => p.id === child.planId);
        return (
          <div
            key={child.id}
            className="bg-card border border-border rounded-[10px] px-4 py-2.5 flex items-center gap-3"
            style={{ marginLeft: Math.min(depth, 4) * 8 }}
          >
            {type && <TypeBadge icon={type.icon} color={type.color} name={type.name} />}
            <Link
              href={`/projects/${slug}/items/${child.sequenceNum}`}
              className="text-sm font-bold truncate hover:text-primary"
            >
              #{child.sequenceNum} {child.title}
            </Link>
            {status && (
              <span
                className="h-6 inline-flex items-center gap-1.5 px-2 rounded-md border text-xs font-bold"
                style={{ borderColor: `${status.color}52`, color: status.color }}
              >
                <StatusDot color={status.color} className="w-1.5 h-1.5" />
                {status.name}
              </span>
            )}
            {plan && <span className="text-xs text-muted-foreground truncate">{plan.name}</span>}
            {child.description && (
              <span className="text-xs text-muted-foreground truncate hidden xl:inline">
                {bodyExcerpt(child.description, 60)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
