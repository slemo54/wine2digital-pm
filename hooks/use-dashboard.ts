import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere tutti i dati della dashboard in una singola chiamata API.
 *
 * PERFORMANCE: Utilizza l'endpoint unificato /api/dashboard/summary per ridurre
 * i round-trip di rete e migliorare significativamente il tempo di caricamento
 * iniziale della dashboard.
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
    // Data
    projects: { projects: data.projects || [] },
    tasks: { tasks: data.tasks || [] },
    subtasks: { subtasks: data.subtasks || [] },
    notifications: {
      notifications: data.notifications || [],
      unreadCount: data.unreadCount || 0
    },
    activity: data.activity || { events: [] },

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

/**
 * Hook per ottenere le notifiche (mantenuto per compatibilità o refresh mirati)
 */
export function useDashboardNotifications() {
  return useQuery({
    queryKey: ['dashboard', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 secondi
    refetchInterval: 1000 * 60, // Refetch automatico ogni minuto
  });
}
