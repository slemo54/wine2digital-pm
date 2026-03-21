import { useQuery } from '@tanstack/react-query';

/**
 * Hook aggregato che ottiene tutti i dati della dashboard in una singola chiamata API
 * Migliora le performance riducendo i network round-trips
 */
export function useDashboardData() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    staleTime: 1000 * 30, // 30 secondi (base per notifiche)
    refetchInterval: 1000 * 60, // Refetch automatico ogni minuto
  });

  const data = query.data;

  return {
    // Data (aggreagted in summary endpoint)
    projects: data?.projects,
    tasks: data?.tasks,
    subtasks: data?.subtasks,
    notifications: data?.notifications,
    activity: data?.activity,

    // Loading states
    isLoading: query.isLoading,

    // Per compatibilità con dashboard page che usa skeleton granulari
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
 * Hook individuali (mantenuti per compatibilità se usati altrove,
 * ma ora puntano a dati che potrebbero essere già in cache o
 * dovrebbero idealmente essere migrati a useDashboardData)
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

export function useDashboardMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async () => {
      // Nota: questo endpoint /api/tasks/my-tasks non sembra esistere nel filesystem
      // ma il vecchio hook lo chiamava. Lo manteniamo per non rompere nulla
      // se venisse aggiunto o se il routing di Next.js lo gestisce diversamente.
      const res = await fetch('/api/tasks/my-tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useDashboardMySubtasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-subtasks'],
    queryFn: async () => {
      const res = await fetch('/api/subtasks/my-subtasks');
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });
}

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
