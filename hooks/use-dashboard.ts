import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch all dashboard data in a single request for optimal performance.
 * Replaces multiple individual calls to projects, tasks, subtasks, etc.
 */
export function useDashboardData() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refresh every minute
  });

  const data = query.data;

  return {
    // Map individual data keys for backward compatibility with existing UI components
    projects: data ? { projects: data.projects } : undefined,
    tasks: data ? { tasks: data.tasks } : undefined,
    subtasks: data ? { subtasks: data.subtasks } : undefined,
    notifications: data ? { notifications: data.notifications, unreadCount: data.unreadCount } : undefined,
    activity: data ? { events: data.activity } : undefined,

    // Unified loading state
    isLoading: query.isLoading,

    // Stubs for individual loading states to prevent breaking changes
    isLoadingProjects: query.isLoading,
    isLoadingTasks: query.isLoading,
    isLoadingSubtasks: query.isLoading,
    isLoadingNotifications: query.isLoading,
    isLoadingActivity: query.isLoading,

    // Unified error state
    error: query.error,

    // Refetch function
    refetch: query.refetch,
  };
}

/**
 * Legacy individual hooks - kept for potential usage in other pages
 * though they now use the same stale times for consistency.
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
      // Corrected from broken path /api/tasks/my-tasks
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
      // Corrected from broken path /api/subtasks/my-subtasks
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
