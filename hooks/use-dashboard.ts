import { useQuery } from '@tanstack/react-query';

/**
 * Hook aggregato che ottiene tutti i dati della dashboard in un'unica richiesta
 *
 * PERFORMANCE: Riduce il numero di round-trip HTTP da 5 a 1.
 */
export function useDashboardData() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 secondi
    refetchInterval: 1000 * 60, // Refetch automatico ogni minuto
  });

  return {
    // Reconstruct nested structure for backward compatibility with DashboardPage
    projects: data ? { projects: data.projects } : undefined,
    tasks: data ? { tasks: data.tasks } : undefined,
    subtasks: data ? { subtasks: data.subtasks } : undefined,
    notifications: data ? Object.assign(data.notifications, { notifications: data.notifications, unreadCount: data.unreadCount }) : undefined,
    activity: data ? { events: data.events } : undefined,

    // Loading states
    isLoading,
    isLoadingProjects: isLoading,
    isLoadingTasks: isLoading,
    isLoadingSubtasks: isLoading,
    isLoadingNotifications: isLoading,
    isLoadingActivity: isLoading,

    // Error states
    error,

    // Refetch function
    refetch,
  };
}

/**
 * @deprecated Use useDashboardData() instead for better performance.
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

/**
 * @deprecated Use useDashboardData() instead for better performance.
 */
export function useDashboardMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/my-tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * @deprecated Use useDashboardData() instead for better performance.
 */
export function useDashboardMySubtasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/subtasks/my-subtasks');
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * @deprecated Use useDashboardData() instead for better performance.
 */
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

/**
 * @deprecated Use useDashboardData() instead for better performance.
 */
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
