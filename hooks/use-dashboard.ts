import { useQuery } from '@tanstack/react-query';

/**
 * Hook per ottenere i progetti dell'utente
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
 * Hook aggregato che ottiene tutti i dati della dashboard in parallelo
 * Questo è il modo corretto per caricare dati multipli con React Query
 *
 * PERFORMANCE: Le query vengono eseguite in parallelo automaticamente
 */
export function useDashboardData() {
  const projectsQuery = useDashboardProjects();
  const tasksQuery = useDashboardMyTasks();
  const subtasksQuery = useDashboardMySubtasks();
  const notificationsQuery = useDashboardNotifications();
  const activityQuery = useDashboardActivity();

  return {
    // Data
    projects: projectsQuery.data,
    tasks: tasksQuery.data,
    subtasks: subtasksQuery.data,
    notifications: notificationsQuery.data,
    activity: activityQuery.data,

    // Loading states
    isLoading:
      projectsQuery.isLoading ||
      tasksQuery.isLoading ||
      subtasksQuery.isLoading ||
      notificationsQuery.isLoading ||
      activityQuery.isLoading,

    isLoadingProjects: projectsQuery.isLoading,
    isLoadingTasks: tasksQuery.isLoading,
    isLoadingSubtasks: subtasksQuery.isLoading,
    isLoadingNotifications: notificationsQuery.isLoading,
    isLoadingActivity: activityQuery.isLoading,

    // Error states
    error:
      projectsQuery.error ||
      tasksQuery.error ||
      subtasksQuery.error ||
      notificationsQuery.error ||
      activityQuery.error,

    // Refetch functions
    refetch: () => {
      projectsQuery.refetch();
      tasksQuery.refetch();
      subtasksQuery.refetch();
      notificationsQuery.refetch();
      activityQuery.refetch();
    },
  };
}
