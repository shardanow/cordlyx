'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { AvatarCircle } from '@/components/features/AvatarCircle';
import { StatusDot } from '@/components/features/StatusDot';
import Spinner from '@/components/Spinner';

interface Stats {
  total: number;
  open: number;
  done: number;
  doneRecently7d: number;
  overdue: {
    count: number;
    items: { id: string; sequenceNum: number; title: string; dueDate: string | null; assigneeName: string | null }[];
  };
  byStatus: { statusId: string; name: string; color: string; category: string; count: number }[];
  byAssignee: { userId: string; name: string; avatarUrl: string | null; open: number; total: number }[];
  byType: { typeId: string; name: string; color: string; count: number }[];
}

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: project } = useQuery<{ name: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['stats', slug],
    queryFn: () => api.get(`/projects/${slug}/stats`),
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const maxStatus = Math.max(1, ...stats.byStatus.map((s) => s.count));
  const maxLoad = Math.max(1, ...stats.byAssignee.map((a) => a.total));

  const cards = [
    { label: 'Total items', value: stats.total, sub: null as string | null },
    { label: 'Open', value: stats.open, sub: null },
    { label: 'Done', value: stats.done, sub: `${stats.doneRecently7d} in last 7 days` },
    { label: 'Overdue', value: stats.overdue.count, sub: null, alert: stats.overdue.count > 0 },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">Overview</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-6">Project overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-[12px] p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.alert ? 'text-red-500' : ''}`}>{c.value}</p>
            {c.sub && <p className="text-[11px] text-muted-foreground mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-[12px] p-4">
          <h3 className="text-sm font-bold mb-3">By status</h3>
          <div className="space-y-2.5">
            {stats.byStatus.map((s) => (
              <div key={s.statusId}>
                <div className="flex items-center gap-2 text-xs mb-1">
                  <StatusDot color={s.color} className="w-2 h-2" />
                  <span className="font-medium flex-1 truncate">{s.name}</span>
                  <span className="text-muted-foreground font-bold">{s.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.count / maxStatus) * 100}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
            {stats.byStatus.length === 0 && <p className="text-xs text-muted-foreground">No statuses configured.</p>}
          </div>

          {stats.byType.length > 0 && (
            <>
              <h3 className="text-sm font-bold mt-5 mb-3">By type</h3>
              <div className="flex flex-wrap gap-1.5">
                {stats.byType.map((t) => (
                  <span
                    key={t.typeId}
                    className="h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
                    style={{ color: t.color, backgroundColor: `${t.color}18` }}
                  >
                    {t.name} · {t.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-[12px] p-4">
            <h3 className="text-sm font-bold mb-3">Workload</h3>
            <div className="space-y-2.5">
              {stats.byAssignee.map((a) => (
                <div key={a.userId} className="flex items-center gap-2.5">
                  <AvatarCircle name={a.name} avatarUrl={a.avatarUrl} />
                  <span className="text-xs font-medium flex-1 truncate">{a.name}</span>
                  <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(a.total / maxLoad) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-bold w-12 text-right">
                    {a.open}/{a.total}
                  </span>
                </div>
              ))}
              {stats.byAssignee.length === 0 && <p className="text-xs text-muted-foreground">Nothing assigned yet.</p>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-[12px] p-4">
            <h3 className="text-sm font-bold mb-3">Overdue ({stats.overdue.count})</h3>
            <div className="space-y-1.5">
              {stats.overdue.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/projects/${slug}/items/${item.sequenceNum}`}
                  className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  <span className="font-mono text-muted-foreground shrink-0">#{item.sequenceNum}</span>
                  <span className="font-medium flex-1 truncate">{item.title}</span>
                  <span className="text-red-500 shrink-0">
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}
                  </span>
                </Link>
              ))}
              {stats.overdue.items.length === 0 && <p className="text-xs text-muted-foreground">Nothing overdue. 🎉</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
