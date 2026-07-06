'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect } from 'react';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [info, setInfo] = useState<{ projectName: string; projectSlug: string } | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }
    if (!isLoading && isAuthenticated) {
      api.get<{ projectName: string; projectSlug: string }>(`/invites/${token}`)
        .then(setInfo)
        .catch((err) => setError(err.message));
    }
  }, [isLoading, isAuthenticated, token, router]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await api.post<{ projectSlug: string }>(`/invites/${token}/accept`);
      setDone(true);
      router.push(`/projects/${res.projectSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-destructive">!</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Invalid or expired invite</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-green-600/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-green-600">✓</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Joined project</h1>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">+</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-1">Join {info.projectName}</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join this project.
          </p>
        </div>
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {accepting ? 'Joining...' : 'Accept invitation'}
        </button>
      </div>
    </div>
  );
}
