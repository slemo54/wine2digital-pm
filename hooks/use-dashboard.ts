import { useQuery } from '@tanstack/react-query';

/**
 * Hook aggregato che ottiene tutti i dati della dashboard in un'unica chiamata
 *
 * PERFORMANCE: Riduce le chiamate da 5 a 1 singola richiesta unificata,
 * ottimizzando il caricamento iniziale della dashboard.
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
    refetchInterval: 1000 * 60, // Refetch automatico ogni minuto per aggiornare notifiche
  });

  const data = query.data || {};

  return {
    // Data - Wrapped in objects to match the legacy nested structure expected by DashboardPage
    projects: { projects: data.projects || [] },
    tasks: { tasks: data.tasks || [] },
    subtasks: { subtasks: data.subtasks || [] },
    notifications: { notifications: data.notifications || [], unreadCount: data.unreadCount || 0 },
    activity: { events: data.events || [] },

    // Loading states
    isLoading: query.isLoading,

    // Manteniamo questi per compatibilità retroattiva con DashboardPage
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
 * Hook per ottenere i progetti dell'utente (mantenuto per compatibilità se usato altrove)
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
 * Hook per ottenere i task assegnati all'utente (mantenuto per compatibilità se usato altrove)
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
 * Hook per ottenere i subtask dell'utente (mantenuto per compatibilità se usato altrove)
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
 * Hook per ottenere le notifiche (mantenuto per compatibilità se usato altrove)
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
 * Hook per ottenere l'activity log (mantenuto per compatibilità se usato altrove)
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
