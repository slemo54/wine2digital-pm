import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Hook to fetch all dashboard data in a single API call.
 * OPTIMIZATION: Reduces requests from 5 to 1, improving TTI and server load.
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch user projects.
 * @deprecated Use useDashboardSummary instead
 */
export function useDashboardProjects() {
  return useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch tasks assigned to the user.
 * @deprecated Use useDashboardSummary instead
 */
export function useDashboardMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/my-tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch subtasks assigned to the user.
 * @deprecated Use useDashboardSummary instead
 */
export function useDashboardMySubtasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/subtasks/my-subtasks');
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch notifications.
 * @deprecated Use useDashboardSummary instead
 */
export function useDashboardNotifications() {
  return useQuery({
    queryKey: ['dashboard', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Auto-refetch every minute
  });
}

/**
 * Hook to fetch activity log.
 * @deprecated Use useDashboardSummary instead
 */
export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Aggregated hook that retrieves all dashboard data.
 * OPTIMIZATION: Now uses the unified /api/dashboard/summary endpoint.
 *
 * PERFORMANCE: Reduces network latency by consolidating requests.
 */
export function useDashboardData() {
  const { data, isLoading, error, refetch } = useDashboardSummary();

  // useMemo to keep data references stable and prevent unnecessary re-renders
  return useMemo(() => ({
    // Data
    projects: data?.projects,
    tasks: data?.tasks,
    subtasks: data?.subtasks,
    notifications: data?.notifications,
    activity: data?.activity,

    // Loading states
    isLoading,
    isLoadingProjects: isLoading,
    isLoadingTasks: isLoading,
    isLoadingSubtasks: isLoading,
    isLoadingNotifications: isLoading,
    isLoadingActivity: isLoading,

    // Error states
    error,

    // Refetch functions
    refetch,
  }), [data, isLoading, error, refetch]);
}
