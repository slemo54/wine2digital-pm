import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere tutti i dati della dashboard in un'unica chiamata.
 * PERFORMANCE: Riduce le chiamate da 5 a 1, migliorando i tempi di caricamento e riducendo il carico sul server.
 */
export function useDashboardData() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minuti
  });

  const data = query.data || {};

  return {
    // Data (manteniamo la stessa struttura per compatibilità)
    projects: data.projects,
    tasks: data.tasks,
    subtasks: data.subtasks,
    notifications: data.notifications,
    activity: data.activity,

    // Loading states
    isLoading: query.isLoading,
    isLoadingProjects: query.isLoading,
    isLoadingTasks: query.isLoading,
    isLoadingSubtasks: query.isLoading,
    isLoadingNotifications: query.isLoading,
    isLoadingActivity: query.isLoading,

    // Error states
    error: query.error,

    // Refetch functions
    refetch: () => {
      query.refetch();
    },
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
      // Reverted to original invalid URL to avoid side effects as per review
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
      // Reverted to original invalid URL to avoid side effects as per review
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
