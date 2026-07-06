export function AvatarCircle({ name, className }: { name: string; className?: string }) {
  return (
    <div className={`w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 ${className ?? ''}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
