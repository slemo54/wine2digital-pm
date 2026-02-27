import { useQuery } from '@tanstack/react-query';

export interface TasksListFilters {
  scope: 'all' | 'assigned' | 'projects';
  status: string;
  priority: string;
  projectId: string;
  dueFrom: string;
  dueTo: string;
  q: string;
  tag: string;
  page?: number;
  pageSize?: number;
}

export interface SubtasksFilters {
  scope: string;
  status: string;
  priority: string;
  projectId: string;
  dueFrom: string;
  dueTo: string;
  q: string;
}

/**
 * Hook to fetch tasks with filters
 * Supports smooth filter transitions with keepPreviousData
 */
export function useTasksList(filters: TasksListFilters) {
  return useQuery({
    queryKey: ['tasks-list', filters],
    queryFn: async () => {
      // Build query string from filters
      const params = new URLSearchParams();

      if (filters.scope) params.append('scope', filters.scope);
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.dueFrom) params.append('dueFrom', filters.dueFrom);
      if (filters.dueTo) params.append('dueTo', filters.dueTo);
      if (filters.q) params.append('q', filters.q);
      if (filters.tag) params.append('tag', filters.tag);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());

      const queryString = params.toString();
      const url = `/api/tasks${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (previousData) => previousData, // keepPreviousData equivalent
  });
}

/**
 * Hook to fetch assigned subtasks
 * Only enabled when filters.scope === 'assigned'
 */
export function useAssignedSubtasks(filters: SubtasksFilters) {
  return useQuery({
    queryKey: ['assigned-subtasks', filters],
    queryFn: async () => {
      // Build query string from filters
      const params = new URLSearchParams();

      params.append('scope', 'assigned');
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.dueFrom) params.append('dueFrom', filters.dueFrom);
      if (filters.dueTo) params.append('dueTo', filters.dueTo);
      if (filters.q) params.append('q', filters.q);

      const queryString = params.toString();
      const url = `/api/subtasks${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch assigned subtasks');
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: filters.scope === 'assigned',
  });
}

/**
 * Hook to fetch projects for the filter dropdown
 * Uses longer stale time as projects change less frequently
 */
export function useProjectsForFilter() {
  return useQuery({
    queryKey: ['projects-list-filter'],
    queryFn: async () => {
      const res = await fetch('/api/projects?page=1&limit=200');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
