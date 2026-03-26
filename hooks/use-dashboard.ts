import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere i progetti dell'utente
 */
export function useDashboardProjects() {
  return useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minuti
  });
}

/**
 * Hook per ottenere i task assegnati all'utente
 */
export function useDashboardMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/my-tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minuti
  });
}

/**
 * Hook per ottenere i subtask dell'utente
 */
export function useDashboardMySubtasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/subtasks/my-subtasks');
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minuti
  });
}

/**
 * Hook per ottenere le notifiche
 */
export function useDashboardNotifications() {
  return useQuery({
    queryKey: ['dashboard', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 secondi - più fresco per notifiche
    refetchInterval: 1000 * 60, // Refetch automatico ogni minuto
  });
}

/**
 * Hook per ottenere l'activity log
 */
export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minuti
  });
}

/**
 * Hook aggregato che ottiene tutti i dati della dashboard in una singola chiamata unificata.
 *
 * PERFORMANCE: Riduce le chiamate di rete da 5 a 1, minimizzando l'overhead HTTP
 * e permettendo al server di eseguire le query al database in parallelo.
 */
export function useDashboardData() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 secondi
    refetchInterval: 1000 * 60, // Refetch ogni minuto per notifiche/attività
  });

  return {
    // Data - Correctly mapping nested structures expected by dashboard page
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

    // Error state
    error: query.error,

    // Refetch function
    refetch: query.refetch,
  };
}
