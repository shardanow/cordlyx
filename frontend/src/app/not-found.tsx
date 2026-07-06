import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
          <span className="text-2xl font-bold text-muted-foreground">404</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-1">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Go to projects
        </Link>
      </div>
    </div>
  );
}
