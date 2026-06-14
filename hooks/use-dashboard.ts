import { useQuery } from '@tanstack/react-query';

/**
 * Aggregated hook that fetches all dashboard data in a single call.
 * PERFORMANCE: Reduces network round-trips by consolidating 5 requests into 1.
 */
export function useDashboardData() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
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
  };
}

/**
 * Hook to get user projects (legacy/individual)
 */

/**
 * Hook per ottenere il profilo dell'utente loggato
 */
export function useUserProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      // In assenza di /api/profile usiamo la sessione estesa o i dati base che avremo dal server
      // Qui aggiungiamo la chiamata fetch che verrà gestita se l'API esiste, altrimenti fallback
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        // Return null instead of throwing to allow fallback to session
        return data;
      } catch (err) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

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
 * Hook to get assigned tasks (legacy/individual)
 */
export function useDashboardMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?scope=assigned&view=dashboard');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get user subtasks (legacy/individual)
 */
export function useDashboardMySubtasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/subtasks?scope=assigned');
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get notifications (legacy/individual)
 */
export function useDashboardNotifications() {
  return useQuery({
    queryKey: ['dashboard', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds - fresher for notifications
    refetchInterval: 1000 * 60, // Auto-refetch every minute
  });
}

/**
 * Hook to get activity log (legacy/individual)
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
