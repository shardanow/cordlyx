import { cn } from '@/lib/utils';
import { TypeIcon } from '@/components/features/TypeIcon';

interface TypeBadgeProps {
  icon: string | null;
  color?: string | null;
  name: string;
  iconClassName?: string;
  className?: string;
}

/** Item type label: lucide icon tinted with the type color + name. */
export function TypeBadge({ icon, color, name, iconClassName, className }: TypeBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-bold text-sm', className)}
      style={color ? { color } : undefined}
    >
      <TypeIcon name={icon} className={iconClassName ?? 'w-4 h-4 shrink-0'} />
      {name}
    </span>
  );
}
