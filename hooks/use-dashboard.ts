import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere il sommario completo della dashboard in una singola chiamata.
 * PERFORMANCE: Riduce network round-trips da 5 a 1.
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minuti
  });
}

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
      const res = await fetch('/api/tasks?scope=assigned'); // Fix 404: /api/tasks/my-tasks does not exist
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
      const res = await fetch('/api/subtasks?scope=assigned'); // Fix 404: /api/subtasks/my-subtasks does not exist
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
 * Hook aggregato che ottiene tutti i dati della dashboard.
 * Ora utilizza il summary endpoint unificato per massime performance.
 *
 * PERFORMANCE: Sostituisce 5 query parallele con 1 singola query aggregata.
 */
export function useDashboardData() {
  const summaryQuery = useDashboardSummary();

  return {
    // Data
    projects: summaryQuery.data?.projects,
    tasks: summaryQuery.data?.tasks,
    subtasks: summaryQuery.data?.subtasks,
    notifications: summaryQuery.data?.notifications,
    activity: summaryQuery.data?.activity,

    // Loading states
    isLoading: summaryQuery.isLoading,
    isLoadingProjects: summaryQuery.isLoading,
    isLoadingTasks: summaryQuery.isLoading,
    isLoadingSubtasks: summaryQuery.isLoading,
    isLoadingNotifications: summaryQuery.isLoading,
    isLoadingActivity: summaryQuery.isLoading,

    // Error states
    error: summaryQuery.error,

    // Refetch functions
    refetch: () => {
      summaryQuery.refetch();
    },
  };
}
