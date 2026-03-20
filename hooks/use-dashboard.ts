import { useQuery } from '@tanstack/react-query';

/**
 * Hook for unified dashboard data aggregation.
 * Replaces separate hooks to reduce network waterfalls and improve performance.
 */
export function useDashboardData() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const data = query.data || {};

  return {
    // Aggregated Data
    projects: data.projects,
    tasks: data.tasks,
    subtasks: data.subtasks,
    notifications: data.notifications,
    activity: data.activity,

    // Shared Loading states
    isLoading: query.isLoading,
    isLoadingProjects: query.isLoading,
    isLoadingTasks: query.isLoading,
    isLoadingSubtasks: query.isLoading,
    isLoadingNotifications: query.isLoading,
    isLoadingActivity: query.isLoading,

    // Error state
    error: query.error,

    // Unified Refetch function
    refetch: query.refetch,
  };
}

/**
 * Individual hooks preserved for backward compatibility if needed,
 * but useDashboardData is preferred for the main dashboard.
 */
export function useDashboardProjects() {
  return useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?scope=assigned&view=dashboard');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useDashboardMySubtasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/subtasks?scope=assigned');
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useDashboardNotifications() {
  return useQuery({
    queryKey: ['dashboard', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}
