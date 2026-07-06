import Spinner from '@/components/Spinner';

export default function ProjectLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Spinner size="lg" />
    </div>
  );
}
