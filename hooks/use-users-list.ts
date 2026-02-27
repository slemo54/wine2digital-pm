import { useQuery } from '@tanstack/react-query';

interface UserLite {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
}

interface UsersListResponse {
  users: UserLite[];
}

/**
 * Hook per ottenere la lista di tutti gli utenti
 * Usato principalmente per la selezione dei membri del progetto
 */
export function useUsersList(enabled: boolean = true) {
  return useQuery<UsersListResponse>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minuti - gli utenti cambiano raramente
    enabled,
  });
}
