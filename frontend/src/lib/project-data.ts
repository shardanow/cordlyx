import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
}

export interface ItemType {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface ItemStatus {
  id: string;
  name: string;
  color: string;
  category: string;
}

export interface ItemPriority {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  joinedAt?: string;
}

export interface Plan {
  id: string;
  name: string;
  color: string | null;
  type?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface TagInfo {
  id: string;
  name: string;
  color: string | null;
}

export interface ProjectData {
  project: ProjectInfo | undefined;
  types: ItemType[];
  statuses: ItemStatus[];
  priorities: ItemPriority[];
  members: ProjectMember[];
  plans: Plan[];
  tags: TagInfo[];
  isLoading: boolean;
}

/**
 * Single source of project reference data.
 * Query keys match the historic per-page keys (['types', slug], …),
 * so existing invalidateQueries calls keep working.
 */
export function useProjectData(slug: string | undefined): ProjectData {
  const { data: project } = useQuery<ProjectInfo>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
    enabled: !!slug,
  });

  const { data: types, isLoading: typesLoading } = useQuery<ItemType[]>({
    queryKey: ['types', slug],
    queryFn: () => api.get(`/projects/${slug}/types`),
    enabled: !!slug,
  });

  const { data: statuses, isLoading: statusesLoading } = useQuery<ItemStatus[]>({
    queryKey: ['statuses', slug],
    queryFn: () => api.get(`/projects/${slug}/statuses`),
    enabled: !!slug,
  });

  const { data: priorities, isLoading: prioritiesLoading } = useQuery<ItemPriority[]>({
    queryKey: ['priorities', slug],
    queryFn: () => api.get(`/projects/${slug}/priorities`),
    enabled: !!slug,
  });

  const { data: members, isLoading: membersLoading } = useQuery<ProjectMember[]>({
    queryKey: ['members', slug],
    queryFn: () => api.get(`/projects/${slug}/members`),
    enabled: !!slug,
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['plans', slug],
    queryFn: () => api.get(`/projects/${slug}/plans`),
    enabled: !!slug,
  });

  const { data: tags, isLoading: tagsLoading } = useQuery<TagInfo[]>({
    queryKey: ['tags', slug],
    queryFn: () => api.get(`/projects/${slug}/tags`),
    enabled: !!slug,
  });

  return {
    project,
    types: types ?? [],
    statuses: statuses ?? [],
    priorities: priorities ?? [],
    members: members ?? [],
    plans: plans ?? [],
    tags: tags ?? [],
    isLoading: typesLoading || statusesLoading || prioritiesLoading || membersLoading || plansLoading || tagsLoading,
  };
}
