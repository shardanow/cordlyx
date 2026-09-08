import { cn } from '@/lib/utils';

/** Colored status/priority/plan dot. Replaces ad-hoc dotted divs across pages. */
export function StatusDot({ color, className }: { color?: string | null; className?: string }) {
  return (
    <div
      className={cn('w-2.5 h-2.5 rounded-full shrink-0', className)}
      style={{ backgroundColor: color ?? '#7b8498' }}
    />
  );
}
