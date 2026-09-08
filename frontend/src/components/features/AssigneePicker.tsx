'use client';

import { User } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';
import { AvatarCircle } from '@/components/features/AvatarCircle';
import type { ProjectMember } from '@/lib/project-data';

interface AssigneePickerProps {
  value: string;
  members: ProjectMember[];
  onChange: (userId: string) => void;
  onClose?: () => void;
  autoOpen?: boolean;
  triggerClassName?: string;
}

/** Assignee select with photo avatars. Used in list inline-edit and item meta row. */
export function AssigneePicker({ value, members, onChange, onClose, autoOpen, triggerClassName }: AssigneePickerProps) {
  const assignee = members.find((m) => m.userId === value);
  return (
    <Select value={value} onChange={onChange} autoOpen={autoOpen} onClose={onClose}>
      <SelectTrigger className={triggerClassName}>
        {assignee ? (
          <AvatarCircle name={assignee.name} avatarUrl={assignee.avatarUrl} />
        ) : (
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        {assignee?.name ?? 'Unassigned'}
      </SelectTrigger>
      <SelectContent>
        <SelectOption value="">
          <User className="w-3.5 h-3.5" />
          Unassigned
        </SelectOption>
        {members.map((m) => (
          <SelectOption key={m.userId} value={m.userId}>
            <AvatarCircle name={m.name} avatarUrl={m.avatarUrl} />
            {m.name}
          </SelectOption>
        ))}
      </SelectContent>
    </Select>
  );
}
