export default function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClass = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-3' };
  return (
    <div
      className={`${sizeClass[size]} rounded-full border-primary border-t-transparent animate-spin ${className}`}
    />
  );
}
