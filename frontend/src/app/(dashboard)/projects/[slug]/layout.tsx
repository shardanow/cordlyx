'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { useSocket } from '@/lib/use-socket';

interface Project {
  id: string;
  name: string;
  slug: string;
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();

  const { data: project } = useQuery<Project>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  useSocket(project?.id);

  return <div>{children}</div>;
}
