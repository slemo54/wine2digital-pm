import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export interface CalendarAbsencesFilters {
  statusFilter?: string;
  typeFilter?: string;
  searchQuery?: string;
}

export interface Absence {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  user?: {
    id: string;
    name?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    department?: string | null;
  };
}

interface CalendarAbsencesResponse {
  absences: Absence[];
  counts?: { pending: number; approved: number; rejected: number; total: number };
}

interface CreateAbsenceData {
  type: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

interface ApproveAbsenceData {
  id: string;
}

interface RejectAbsenceData {
  id: string;
  reason?: string;
}

/**
 * Hook to fetch absences for calendar
 */
export function useCalendarAbsences(filters: CalendarAbsencesFilters) {
  const searchParams = new URLSearchParams();
  if (filters.statusFilter) searchParams.set('status', filters.statusFilter);
  if (filters.typeFilter) searchParams.set('type', filters.typeFilter);
  if (filters.searchQuery) searchParams.set('search', filters.searchQuery);

  const queryString = searchParams.toString();
  const endpoint = `/api/absences${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['calendar-absences', filters],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch absences');
      }
      return res.json() as Promise<CalendarAbsencesResponse>;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation to create an absence
 */
export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAbsenceData) => {
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create absence');
      }
      return res.json() as Promise<Absence>;
    },

    onSuccess: () => {
      toast.success('Absence request created successfully');
      queryClient.invalidateQueries({ queryKey: ['calendar-absences'] });
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create absence');
    },
  });
}

/**
 * Mutation to approve an absence (for managers)
 * Uses optimistic update for immediate UI feedback
 */
export function useApproveAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: ApproveAbsenceData) => {
      const res = await fetch(`/api/absences/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve absence');
      }
      return res.json() as Promise<Absence>;
    },

    // OPTIMISTIC UPDATE - UI updates immediately
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['calendar-absences'] });

      // Snapshot previous values
      const previousAbsences = queryClient.getQueryData<Absence[]>(['calendar-absences']);

      // Optimistically update the absence status
      queryClient.setQueryData<Absence[]>(['calendar-absences'], (old) => {
        if (!old) return old;
        return old.map((absence) =>
          absence.id === id ? { ...absence, status: 'approved' } : absence
        );
      });

      return { previousAbsences };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousAbsences) {
        queryClient.setQueryData(['calendar-absences'], context.previousAbsences);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to approve absence');
    },

    onSuccess: () => {
      toast.success('Absence approved successfully');
    },

    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['calendar-absences'] });
    },
  });
}

/**
 * Mutation to reject an absence
 * Uses optimistic update for immediate UI feedback
 */
export function useRejectAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: RejectAbsenceData) => {
      const res = await fetch(`/api/absences/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject absence');
      }
      return res.json() as Promise<Absence>;
    },

    // OPTIMISTIC UPDATE - UI updates immediately
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['calendar-absences'] });

      // Snapshot previous values
      const previousAbsences = queryClient.getQueryData<Absence[]>(['calendar-absences']);

      // Optimistically update the absence status
      queryClient.setQueryData<Absence[]>(['calendar-absences'], (old) => {
        if (!old) return old;
        return old.map((absence) =>
          absence.id === id ? { ...absence, status: 'rejected' } : absence
        );
      });

      return { previousAbsences };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousAbsences) {
        queryClient.setQueryData(['calendar-absences'], context.previousAbsences);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to reject absence');
    },

    onSuccess: () => {
      toast.success('Absence rejected');
    },

    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['calendar-absences'] });
    },
  });
}
