import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  creator: any;
  members: any[];
  tasks: any[];
}

/**
 * Fetcher function for project data
 */
async function fetchProjectById(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch project');
  }
  const data = await res.json();
  return data.project as Project;
}

/**
 * Hook to get project details
 * PERFORMANCE: Uses TanStack Query for caching and background updates
 */
export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return fetchProjectById(projectId);
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for prefetching project data on hover
 */
export function usePrefetchProject() {
  const queryClient = useQueryClient();

  return (projectId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['project', projectId],
      queryFn: () => fetchProjectById(projectId),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
}
