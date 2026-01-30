import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minuti - i dati sono considerati "fresh" per 5 minuti
      gcTime: 1000 * 60 * 30, // 30 minuti - cache time (nuova API v5, prima era cacheTime)
      refetchOnWindowFocus: false, // Non refetch automatico quando la finestra torna in focus
      retry: 1, // Riprova solo 1 volta in caso di errore
      refetchOnMount: false, // Non refetch automatico al mount se i dati sono fresh
    },
    mutations: {
      retry: 1,
    },
  },
});
