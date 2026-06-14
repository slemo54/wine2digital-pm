import { useQuery } from '@tanstack/react-query';

/**
 * Hook aggregato che ottiene tutti i dati della dashboard in un'unica richiesta
 * PERFORMANCE: Riduce il numero di round-trip API da 5 a 1
 */
export function useDashboardData() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minuto
  });

  return {
    // Data (mappati per mantenere la compatibilità con il dashboard)
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

    // Error state
    error,

    // Refetch function
    refetch,
  };
}

/**
 * Hook per ottenere i progetti dell'utente (legacy/standalone)
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
 * Hook per ottenere i task assegnati all'utente (legacy/standalone)
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
 * Hook per ottenere i subtask dell'utente (legacy/standalone)
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
 * Hook per ottenere le notifiche (legacy/standalone)
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
 * Hook per ottenere l'activity log (legacy/standalone)
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
