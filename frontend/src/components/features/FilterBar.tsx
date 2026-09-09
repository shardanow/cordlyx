'use client';

import type { RefObject } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Search, ListTodo, CircleDot, Flag, User, Target, Tags, ChevronDown } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { AvatarCircle } from '@/components/features/AvatarCircle';
import { TypeIcon } from '@/components/features/TypeIcon';
import { StatusDot } from '@/components/features/StatusDot';
import { cn } from '@/lib/utils';
import type { ItemType, ItemStatus, ItemPriority, ProjectMember, Plan, TagInfo } from '@/lib/project-data';

export interface FilterValues {
  search: string;
  debouncedSearch: string;
  typeId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string;
  planId: string;
  tagIds: string[];
}

interface FilterBarProps {
  values: FilterValues;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  onChange: (patch: Partial<FilterValues>) => void;
  data: {
    types: ItemType[];
    statuses: ItemStatus[];
    priorities: ItemPriority[];
    members: ProjectMember[];
    plans: Plan[];
    tags?: TagInfo[];
  };
  showStatus?: boolean;
  showPlan?: boolean;
  layout?: 'grid' | 'row';
  searchRef?: RefObject<HTMLInputElement | null>;
  trailing?: React.ReactNode;
}

const triggerClass = (hasValue: boolean, layout: 'grid' | 'row') =>
  layout === 'grid'
    ? `h-[50px] inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border ${hasValue ? 'border-border text-foreground' : 'border-border text-muted-foreground'} bg-muted/50 cursor-pointer w-full transition-colors hover:bg-muted`
    : 'h-[50px] shrink-0 min-w-[150px] inline-flex items-center gap-2.5 px-3.5 rounded-[10px] text-sm border border-border bg-muted/50';

/** Shared search + type/status/priority/assignee/plan filter toolbar (list + board). */
export function FilterBar({
  values,
  onSearch,
  onClearSearch,
  onChange,
  data,
  showStatus = true,
  showPlan = true,
  layout = 'grid',
  searchRef,
  trailing,
}: FilterBarProps) {
  const { types, statuses, priorities, members, plans, tags = [] } = data;
  const selectedType = types.find((t) => t.id === values.typeId);
  const [tagsOpen, setTagsOpen] = useState(false);
  const tagsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tagsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) setTagsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [tagsOpen]);

  const toggleTag = (id: string) => {
    const cur = values.tagIds ?? [];
    onChange({ tagIds: cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id] });
  };

  const searchBox = (
    <label
      className={cn(
        'h-[50px] flex items-center gap-2.5 px-3.5 rounded-[10px] border border-border bg-muted/50 cursor-text transition-colors focus-within:ring-1 focus-within:ring-ring',
        layout === 'row' && 'w-[220px] shrink-0',
      )}
    >
      {values.search !== values.debouncedSearch ? (
        <Spinner size="sm" className="shrink-0" />
      ) : (
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <input
        ref={searchRef}
        type="text"
        placeholder="Search items..."
        value={values.search}
        onChange={(e) => onSearch(e.target.value)}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-0 min-w-0"
      />
      {values.debouncedSearch && (
        <button onClick={onClearSearch} className="text-muted-foreground hover:text-foreground shrink-0">✕</button>
      )}
    </label>
  );

  const selects = (
    <>
      <Select value={values.typeId} onChange={(v) => onChange({ typeId: v })}>
        <SelectTrigger className={triggerClass(!!values.typeId, layout)}>
          {selectedType ? (
            <TypeIcon name={selectedType.icon} className="w-4 h-4 shrink-0" />
          ) : (
            <ListTodo className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{selectedType?.name ?? 'Type: All'}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectOption value="">
            <ListTodo className="w-4 h-4" />
            All types
          </SelectOption>
          {types.map((t) => (
            <SelectOption key={t.id} value={t.id}>
              <span style={{ color: t.color }} className="inline-flex shrink-0">
                <TypeIcon name={t.icon} className="w-4 h-4 shrink-0" />
              </span>
              {t.name}
            </SelectOption>
          ))}
        </SelectContent>
      </Select>

      {showStatus && (
        <Select value={values.statusId} onChange={(v) => onChange({ statusId: v })}>
          <SelectTrigger className={triggerClass(!!values.statusId, layout)}>
            <CircleDot className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {values.statusId ? (statuses.find((s) => s.id === values.statusId)?.name ?? 'All') : 'Status: All'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectOption value="">
              <CircleDot className="w-4 h-4" />
              All statuses
            </SelectOption>
            {statuses.map((s) => (
              <SelectOption key={s.id} value={s.id}>
                <StatusDot color={s.color} />
                {s.name}
              </SelectOption>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={values.priorityId} onChange={(v) => onChange({ priorityId: v })}>
        <SelectTrigger className={triggerClass(!!values.priorityId, layout)}>
          <Flag className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {values.priorityId ? (priorities.find((p) => p.id === values.priorityId)?.name ?? 'All') : 'Priority: All'}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectOption value="">
            <Flag className="w-4 h-4" />
            All priorities
          </SelectOption>
          {priorities.map((p) => (
            <SelectOption key={p.id} value={p.id}>
              <StatusDot color={p.color ?? '#888'} />
              {p.name}
            </SelectOption>
          ))}
        </SelectContent>
      </Select>

      <Select value={values.assigneeId} onChange={(v) => onChange({ assigneeId: v })}>
        <SelectTrigger className={triggerClass(!!values.assigneeId, layout)}>
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {values.assigneeId ? (members.find((m) => m.userId === values.assigneeId)?.name ?? 'All') : 'Assignee: All'}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectOption value="">
            <User className="w-4 h-4" />
            All assignees
          </SelectOption>
          {members.map((m) => (
            <SelectOption key={m.userId} value={m.userId}>
              <AvatarCircle name={m.name} avatarUrl={m.avatarUrl} />
              {m.name}
            </SelectOption>
          ))}
        </SelectContent>
      </Select>

      {showPlan && (
        <Select value={values.planId} onChange={(v) => onChange({ planId: v })}>
          <SelectTrigger className={triggerClass(!!values.planId, layout)}>
            <Target className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {values.planId ? (plans.find((p) => p.id === values.planId)?.name ?? 'All') : 'Plan: All'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectOption value="">
              <Target className="w-4 h-4" />
              All plans
            </SelectOption>
            {plans.map((p) => (
              <SelectOption key={p.id} value={p.id}>
                <StatusDot color={p.color ?? '#6B7280'} />
                {p.name}
                {p.type === 'sprint' ? ' · sprint' : ''}
                {p.startDate || p.endDate ? ` (${p.startDate ?? '…'}→${p.endDate ?? '…'})` : ''}
              </SelectOption>
            ))}
          </SelectContent>
        </Select>
      )}

      <div ref={tagsRef} className={cn('relative', layout === 'row' && 'shrink-0')}>
        <button
          type="button"
          onClick={() => setTagsOpen((o) => !o)}
          aria-expanded={tagsOpen}
          className={triggerClass((values.tagIds ?? []).length > 0, layout)}
        >
          <Tags className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {(values.tagIds ?? []).length > 0 ? `Tags: ${(values.tagIds ?? []).length}` : 'Tags: All'}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 ml-auto transition-transform', tagsOpen && 'rotate-180')} />
        </button>
        {tagsOpen && (
          <div className="absolute z-50 mt-1 left-0 right-0 max-h-[280px] overflow-auto bg-card border border-border rounded-lg shadow-lg p-1">
            {(values.tagIds ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ tagIds: [] })}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              >
                Clear tags
              </button>
            )}
            {tags.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No tags in project</div>
            )}
            {tags.map((t) => {
              const checked = (values.tagIds ?? []).includes(t.id);
              return (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm rounded hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTag(t.id)}
                    className="accent-current"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.color ?? '#888' }}
                  />
                  <span className="truncate">{t.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      {(values.tagIds ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 col-span-full">
          {(values.tagIds ?? []).map((id) => {
            const t = tags.find((x) => x.id === id);
            if (!t) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleTag(id)}
                className="h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 border"
                style={t.color ? { color: t.color, backgroundColor: `${t.color}1f`, borderColor: `${t.color}45` } : undefined}
                title="Remove tag filter"
              >
                {t.name} ✕
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  if (layout === 'row') {
    return (
      <div className="flex items-center gap-2.5 p-3 overflow-x-auto">
        {searchBox}
        {selects}
        {trailing}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[14px] mb-5 md:mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 p-4 md:p-5">
        {searchBox}
        {selects}
        {trailing}
      </div>
    </div>
  );
}
