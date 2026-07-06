'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Target, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import CreatePlanModal from '@/components/CreatePlanModal';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string> = {
  release: 'Release',
  milestone: 'Milestone',
  campaign: 'Campaign',
  goal: 'Goal',
  custom: 'Custom',
};

export default function PlansPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [search, setSearch] = useState('');

  const { data: project } = useQuery<{ id: string; name: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans', slug],
    queryFn: () => api.get(`/projects/${slug}/plans`),
  });

  const plans = (data ?? []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
  };

  const handleDelete = async (planId: string, planName: string) => {
    if (!confirm(`Delete "${planName}"?`)) return;
    try {
      await api.delete(`/projects/${slug}/plans/${planId}`);
      queryClient.invalidateQueries({ queryKey: ['plans', slug] });
      toast.success('Plan deleted');
    } catch {
      toast.error('Failed to delete plan');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-3">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors">{project?.name ?? slug}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground">Plans</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-base md:text-lg text-muted-foreground">{plans.length} plans</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-[46px] md:h-[50px] px-5 md:px-6 rounded-[10px] bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2.5"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Create plan</span>
        </button>
      </div>

      <CreatePlanModal
        projectSlug={slug}
        open={showCreate || !!editingPlan}
        onClose={() => { setShowCreate(false); setEditingPlan(null); }}
        plan={editingPlan}
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plans..."
          className="h-10 w-full max-w-sm rounded-lg border border-input bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs"
                style={{ backgroundColor: plan.color ?? '#6B7280' }}
              >
                {plan.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{plan.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {PLAN_LABELS[plan.type] ?? plan.type}
                </div>
                {plan.description && (
                  <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                    {plan.description}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                plan.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                plan.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
              }`}>
                {plan.status}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(plan)}
                  className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit plan"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(plan.id, plan.name)}
                  className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-medium mb-1">{search ? 'No plans found' : 'No plans yet'}</h3>
          <p className="text-sm text-muted-foreground">{search ? 'Try a different search term' : 'Create your first plan to get started'}</p>
        </div>
      )}
    </div>
  );
}
