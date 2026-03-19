import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere tutti i dati della dashboard in una singola chiamata API.
 *
 * PERFORMANCE: Riduce le chiamate di rete da 5 a 1, minimizzando latenza e waterfall.
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

  return {
    // Data
    projects: query.data?.projects,
    tasks: query.data?.tasks,
    subtasks: query.data?.subtasks,
    notifications: query.data?.notifications,
    activity: query.data?.activity,

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
    refetch: query.refetch,
  };
}
