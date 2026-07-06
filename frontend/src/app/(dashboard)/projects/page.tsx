'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import CreateProjectModal from '@/components/CreateProjectModal';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export default function ProjectsPage() {
  const { data, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  });

  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const projects = (data as Project[] | undefined)?.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (project: Project) => {
    setEditingProject(project);
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete "${project.name}"? This will permanently remove all associated data.`)) return;
    try {
      await api.delete(`/projects/${project.slug}`);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects?.length
              ? `${projects.length} project${projects.length !== 1 ? 's' : ''}`
              : 'Manage your projects'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      <CreateProjectModal
        open={showCreateModal || !!editingProject}
        onClose={() => { setShowCreateModal(false); setEditingProject(null); }}
        onCreated={(project) => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          if (!editingProject) router.push(`/projects/${project.slug}`);
        }}
        project={editingProject}
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="h-10 w-full max-w-sm rounded-lg border border-input bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-16 px-4">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-medium mb-1">{search ? 'No projects found' : 'No projects yet'}</h3>
          <p className="text-sm text-muted-foreground mb-5">
            {search ? 'Try a different search term' : 'Create your first project to get started'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create a project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {projects?.map((project) => (
            <div
              key={project.id}
              className="group block p-5 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/30 transition-all"
            >
              <Link href={`/projects/${project.slug}`} className="block">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                      {project.name}
                    </div>
                    {project.description ? (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {project.description}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50 mt-1 italic">No description</div>
                    )}
                  </div>
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                <button
                  onClick={() => handleEdit(project)}
                  className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit project"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(project)}
                  className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
