import { useQuery } from '@tanstack/react-query';

export interface ProjectsListFilters {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
  status?: string;
  search?: string;
}

export interface Project {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  startDate?: string | null;
  endDate?: string | null;
  creator?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  members: Array<{
    userId: string;
    role: string;
    user: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      name?: string | null;
      email: string;
    };
  }>;
  completionRate: number;
  tasksCompleted: number;
  tasksTotal: number;
  _count?: {
    tasks: number;
  };
}

export interface ProjectsListResponse {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Hook to fetch projects list with filters
 */
export function useProjectsList(filters: ProjectsListFilters = {}) {
  const { page, limit, orderBy, order, status, search } = filters;

  // Build query string from filters
  const queryParams = new URLSearchParams();
  if (page !== undefined) queryParams.set('page', page.toString());
  if (limit !== undefined) queryParams.set('limit', limit.toString());
  if (orderBy) queryParams.set('orderBy', orderBy);
  if (order) queryParams.set('order', order);
  if (status) queryParams.set('status', status);
  if (search) queryParams.set('search', search);

  const queryString = queryParams.toString();
  const endpoint = `/api/projects${queryString ? `?${queryString}` : ''}`;

  return useQuery<ProjectsListResponse>({
    queryKey: ['projects-list', filters],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
