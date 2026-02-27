import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

// Types
export interface AdminUsersFilters {
  q?: string;
  role?: string;
  active?: string;
}

export interface AdminAbsencesFilters {
  statusFilter?: string;
  typeFilter?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  take?: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  image: string | null;
  department: string | null;
  createdAt: string;
}

export type AdminAbsenceStatus = "pending" | "approved" | "rejected";

export interface AdminAbsence {
  id: string;
  userId: string;
  type: string;
  status: AdminAbsenceStatus;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
    department: string | null;
  };
}

interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
}

interface AdminAbsencesResponse {
  absences: AdminAbsence[];
  total: number;
  page: number;
  totalPages: number;
  counts?: { pending: number; approved: number; rejected: number; total: number };
}

/**
 * Hook to fetch admin users list
 */
export function useAdminUsers(filters: AdminUsersFilters) {
  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.role) params.set('role', filters.role);
      if (filters.active) params.set('active', filters.active);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch users');
      }
      return res.json() as Promise<AdminUsersResponse>;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation to update a user with optimistic update
 */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdminUser> }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }
      const result = await res.json();
      return result.user as AdminUser;
    },

    // OPTIMISTIC UPDATE - UI updates immediately
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });

      // Snapshot previous values
      const previousData = queryClient.getQueryData<AdminUsersResponse>(['admin-users']);

      // Optimistically update the user in the cache
      queryClient.setQueryData(['admin-users'], (old: AdminUsersResponse | undefined) => {
        if (!old?.users) return old;
        return {
          ...old,
          users: old.users.map((user) =>
            user.id === id ? { ...user, ...data } : user
          ),
        };
      });

      return { previousData };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['admin-users'], context.previousData);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    },

    onSuccess: () => {
      toast.success('User updated successfully');
    },

    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

/**
 * Hook to fetch admin absences
 */
export function useAdminAbsences(filters: AdminAbsencesFilters) {
  return useQuery({
    queryKey: ['admin-absences', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.statusFilter) params.set('statusFilter', filters.statusFilter);
      if (filters.typeFilter) params.set('typeFilter', filters.typeFilter);
      if (filters.q) params.set('q', filters.q);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.page !== undefined) params.set('page', String(filters.page));
      if (filters.take !== undefined) params.set('take', String(filters.take));

      const res = await fetch(`/api/admin/absences?${params.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch absences');
      }
      return res.json() as Promise<AdminAbsencesResponse>;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Mutation to approve an absence with optimistic update
 */
export function useApproveAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/absences/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve absence');
      }
      return res.json() as Promise<AdminAbsence>;
    },

    // OPTIMISTIC UPDATE
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-absences'] });

      const previousData = queryClient.getQueryData<AdminAbsencesResponse>(['admin-absences']);

      queryClient.setQueryData(['admin-absences'], (old: AdminAbsencesResponse | undefined) => {
        if (!old?.absences) return old;
        return {
          ...old,
          absences: old.absences.map((absence) =>
            absence.id === id ? { ...absence, status: 'approved' } : absence
          ),
        };
      });

      return { previousData };
    },

    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin-absences'], context.previousData);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to approve absence');
    },

    onSuccess: () => {
      toast.success('Absence approved');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-absences'] });
    },
  });
}

/**
 * Mutation to reject an absence with optimistic update
 */
export function useRejectAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/absences/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject absence');
      }
      return res.json() as Promise<AdminAbsence>;
    },

    // OPTIMISTIC UPDATE
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-absences'] });

      const previousData = queryClient.getQueryData<AdminAbsencesResponse>(['admin-absences']);

      queryClient.setQueryData(['admin-absences'], (old: AdminAbsencesResponse | undefined) => {
        if (!old?.absences) return old;
        return {
          ...old,
          absences: old.absences.map((absence) =>
            absence.id === id ? { ...absence, status: 'rejected' } : absence
          ),
        };
      });

      return { previousData };
    },

    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin-absences'], context.previousData);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to reject absence');
    },

    onSuccess: () => {
      toast.success('Absence rejected');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-absences'] });
    },
  });
}

/**
 * Mutation to delete an absence with optimistic update
 */
export function useDeleteAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/absences/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete absence');
      }
      return res.json();
    },

    // OPTIMISTIC UPDATE
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-absences'] });

      const previousData = queryClient.getQueryData<AdminAbsencesResponse>(['admin-absences']);

      queryClient.setQueryData(['admin-absences'], (old: AdminAbsencesResponse | undefined) => {
        if (!old?.absences) return old;
        return {
          ...old,
          absences: old.absences.filter((absence) => absence.id !== id),
          total: old.total - 1,
        };
      });

      return { previousData };
    },

    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin-absences'], context.previousData);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to delete absence');
    },

    onSuccess: () => {
      toast.success('Absence deleted');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-absences'] });
    },
  });
}
