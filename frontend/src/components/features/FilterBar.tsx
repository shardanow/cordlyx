'use client';

import type { RefObject } from 'react';
import { Search, ListTodo, CircleDot, Flag, User, Target } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { AvatarCircle } from '@/components/features/AvatarCircle';
import { TypeIcon } from '@/components/features/TypeIcon';
import { StatusDot } from '@/components/features/StatusDot';
import { cn } from '@/lib/utils';
import type { ItemType, ItemStatus, ItemPriority, ProjectMember, Plan } from '@/lib/project-data';

export interface FilterValues {
  search: string;
  debouncedSearch: string;
  typeId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string;
  planId: string;
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
  const { types, statuses, priorities, members, plans } = data;
  const selectedType = types.find((t) => t.id === values.typeId);

  const searchBox = (
    <label
      className={cn(
        'h-[50px] flex items-center gap-2.5 px-3.5 rounded-[10px] border border-border bg-muted/50 cursor-text transition-colors focus-within:ring-1 focus-within:ring-ring',
        layout === 'row' && 'w-[220px] shrink-0',
      )}
    >
      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
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
              </SelectOption>
            ))}
          </SelectContent>
        </Select>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,300px)_repeat(5,minmax(0,180px))_auto] gap-2.5 p-4 md:p-5">
        {searchBox}
        {selects}
        {trailing}
      </div>
    </div>
  );
}
