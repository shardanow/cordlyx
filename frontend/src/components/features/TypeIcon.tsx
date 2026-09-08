import { icons, Shapes } from 'lucide-react';

function kebabToPascal(str: string): string {
  return str.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const ICON_ALIASES: Record<string, string> = {
  'check-square': 'SquareCheckBig',
};

interface TypeIconProps {
  name: string | null;
  className?: string;
  color?: string;
}

/** Lucide icon by config name; neutral glyph when unknown (never raw text). */
export function TypeIcon({ name, className, color }: TypeIconProps) {
  if (!name) return null;
  const m = icons as unknown as Record<string, React.ComponentType<{ className?: string; color?: string }> | undefined>;
  const key = ICON_ALIASES[name] ?? kebabToPascal(name);
  const LucideIcon = m[key];
  if (LucideIcon) return <LucideIcon className={className ?? 'w-4 h-4'} color={color} />;
  return <Shapes className={className ?? 'w-4 h-4'} color={color} />;
}
