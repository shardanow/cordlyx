import { icons } from 'lucide-react';

function kebabToPascal(str: string): string {
  return str.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const ICON_ALIASES: Record<string, string> = {
  'check-square': 'SquareCheckBig',
};

export function TypeIcon({ name, className }: { name: string | null; className?: string }) {
  if (!name) return null;
  const m = icons as unknown as Record<string, React.ComponentType<{ className?: string }> | undefined>;
  const key = ICON_ALIASES[name] ?? kebabToPascal(name);
  const LucideIcon = m[key];
  if (LucideIcon) return <LucideIcon className={className ?? 'w-4 h-4'} />;
  return <span className="w-4 h-4 flex items-center justify-center text-xs">{name}</span>;
}
