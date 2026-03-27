import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere il riepilogo della dashboard in una singola richiesta
 * PERFORMANCE: Riduce il numero di richieste da 5 a 1
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 secondi
    refetchInterval: 1000 * 60, // Refetch ogni minuto per notifiche/attività
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
      const res = await fetch('/api/tasks?scope=assigned&view=dashboard');
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
      const res = await fetch('/api/subtasks?scope=assigned');
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
 * PERFORMANCE: Ora usa un singolo endpoint consolidato per minimizzare le richieste HTTP.
 * Ritorna le proprietà con la stessa struttura attesa dai componenti legacy.
 */
export function useDashboardData() {
  const summaryQuery = useDashboardSummary();

  return {
    // Data (mappati dalla risposta del summary alla struttura legacy)
    projects: summaryQuery.data ? { projects: summaryQuery.data.projects } : undefined,
    tasks: summaryQuery.data ? { tasks: summaryQuery.data.tasks } : undefined,
    subtasks: summaryQuery.data ? { subtasks: summaryQuery.data.subtasks } : undefined,
    notifications: summaryQuery.data ? {
      notifications: summaryQuery.data.notifications,
      unreadCount: summaryQuery.data.unreadCount
    } : undefined,
    activity: summaryQuery.data ? { events: summaryQuery.data.activity } : undefined,

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
