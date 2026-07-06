'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Shield, Users, FolderOpen, Search, Lock, BarChart3, Activity, Archive, ChevronDown, ChevronRight } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminProject {
  id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalActiveProjects: number;
  totalItems: number;
}

interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
}

interface ActivityItem {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  projectName: string | null;
  projectSlug: string | null;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'users' | 'projects' | 'activity'>('users');
  const [search, setSearch] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [roleChanges, setRoleChanges] = useState<Record<string, string>>({});

  const { data: adminCheck, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ['admin', 'check'],
    queryFn: () => api.get('/admin/check'),
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Access denied</h1>
          <p className="text-sm text-muted-foreground">You don&apos;t have admin privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">System administration</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-9 w-56 rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Stats */}
      <AdminStatsCards />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'users' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setTab('projects')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'projects' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          <FolderOpen className="w-4 h-4" />
          Projects
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'activity' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          <Activity className="w-4 h-4" />
          Activity
        </button>
      </div>

      {tab === 'users' && <UsersTab search={search} />}
      {tab === 'projects' && <ProjectsTab search={search} expandedProject={expandedProject} setExpandedProject={setExpandedProject} roleChanges={roleChanges} setRoleChanges={setRoleChanges} />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}

function AdminStatsCards() {
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats'),
  });

  const cards = [
    { label: 'Users', value: stats?.totalUsers ?? '—', icon: Users, color: 'bg-blue-600/10 text-blue-600' },
    { label: 'Projects', value: stats?.totalProjects ?? '—', icon: FolderOpen, color: 'bg-purple-600/10 text-purple-600' },
    { label: 'Active Projects', value: stats?.totalActiveProjects ?? '—', icon: BarChart3, color: 'bg-green-600/10 text-green-600' },
    { label: 'Items', value: stats?.totalItems ?? '—', icon: Shield, color: 'bg-amber-600/10 text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className={`w-10 h-10 rounded-lg ${c.color} flex items-center justify-center`}>
            <c.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin/users'),
  });

  const filtered = users?.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const makeAdmin = async (id: string) => {
    await api.patch(`/admin/users/${id}/make-admin`, {});
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'check'] });
  };

  const deactivate = async (id: string) => {
    if (!confirm('Deactivate this user? They will lose access to all projects.')) return;
    await api.patch(`/admin/users/${id}/deactivate`, {});
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No users found</div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                {u.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {u.email} {u.username ? `· @${u.username}` : ''}
                </div>
              </div>
              {u.isAdmin && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Admin</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-green-600/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                {u.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(u.createdAt).toLocaleDateString()}
              </span>
              {!u.isAdmin && u.isActive && (
                <button
                  onClick={() => makeAdmin(u.id)}
                  className="text-xs text-primary hover:text-primary/80 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                >
                  Make admin
                </button>
              )}
              {u.isActive && (
                <button
                  onClick={() => deactivate(u.id)}
                  className="text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                >
                  Deactivate
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectsTab({
  search,
  expandedProject,
  setExpandedProject,
  roleChanges,
  setRoleChanges,
}: {
  search: string;
  expandedProject: string | null;
  setExpandedProject: (id: string | null) => void;
  roleChanges: Record<string, string>;
  setRoleChanges: (updates: Record<string, string>) => void;
}) {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useQuery<AdminProject[]>({
    queryKey: ['admin', 'projects'],
    queryFn: () => api.get('/admin/projects'),
  });

  const { data: members } = useQuery<ProjectMember[]>({
    queryKey: ['admin', 'project-members', expandedProject],
    queryFn: () => api.get(`/admin/projects/${expandedProject}/members`),
    enabled: !!expandedProject,
  });

  const filtered = projects?.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const archive = async (id: string) => {
    if (!confirm('Archive this project?')) return;
    await api.patch(`/admin/projects/${id}/archive`, {});
    queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] });
  };

  const changeRole = async (projectId: string, memberId: string, role: string) => {
    await api.patch(`/admin/projects/${projectId}/members/${memberId}/role`, { role });
    setRoleChanges({ ...roleChanges, [memberId]: '' });
    queryClient.invalidateQueries({ queryKey: ['admin', 'project-members', expandedProject] });
  };

  const toggleExpand = (id: string) => {
    setExpandedProject(expandedProject === id ? null : id);
    setRoleChanges({});
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No projects found</div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((p) => (
            <div key={p.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                >
                  {expandedProject === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">/{p.slug}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isArchived ? 'bg-muted text-muted-foreground' : 'bg-green-600/10 text-green-600'}`}>
                  {p.isArchived ? 'Archived' : 'Active'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
                {!p.isArchived && (
                  <>
                    <button
                      onClick={() => archive(p.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) return;
                        await api.delete(`/admin/projects/${p.id}`);
                        queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] });
                      }}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                {p.isArchived && (
                  <span className="text-xs text-muted-foreground">Archived</span>
                )}
              </div>
              {expandedProject === p.id && (
                <div className="bg-muted/30 border-t border-border px-4 py-3 pl-12 space-y-2">
                  {!members || members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                          {m.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                        </div>
                        <select
                          value={roleChanges[m.id] ?? m.role}
                          onChange={(e) => setRoleChanges({ ...roleChanges, [m.id]: e.target.value })}
                          className="text-xs border border-input rounded px-2 py-1 bg-background"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {roleChanges[m.id] && roleChanges[m.id] !== m.role && (
                          <button
                            onClick={() => changeRole(p.id, m.id, roleChanges[m.id])}
                            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded font-medium"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchPage = async (c: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (c) params.set('cursor', c);
      const result = await api.get<{ data: ActivityItem[]; meta: { cursor: string | null; hasMore: boolean } }>(`/admin/activity?${params.toString()}`);
      setItems((prev) => c ? [...prev, ...result.data] : result.data);
      setCursor(result.meta?.cursor ?? null);
      setHasMore(result.meta?.hasMore ?? false);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  const [fetched, setFetched] = useState(false);
  if (!fetched) { setTimeout(() => { fetchPage(null); setFetched(true); }, 0); }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {loading && items.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      )}
      {!loading && items.length === 0 && fetched && (
        <div className="p-8 text-center text-muted-foreground">No activity yet</div>
      )}
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">
              {a.actor?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs">
                <span className="font-medium">{a.actor?.name ?? 'System'}</span>{' '}
                <span className="text-muted-foreground">{a.action}</span>
                {a.projectName && (
                  <span className="text-muted-foreground"> in <span className="font-medium">{a.projectName}</span></span>
                )}
              </p>
              {a.fieldName && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {a.fieldName}: {JSON.stringify(a.oldValue)} → {JSON.stringify(a.newValue)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => fetchPage(cursor)}
          disabled={loading}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-3 border-t border-border transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
