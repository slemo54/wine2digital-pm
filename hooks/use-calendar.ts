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
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
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
  if (filters.statusFilter && filters.statusFilter !== 'all') searchParams.set('status', filters.statusFilter);
  if (filters.typeFilter && filters.typeFilter !== 'all') searchParams.set('type', filters.typeFilter);
  if (filters.searchQuery) searchParams.set('search', filters.searchQuery);

  searchParams.set('includeCounts', 'true');
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
      const res = await fetch(`/api/absences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
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

      // Snapshot previous values for all calendar-absences queries
      const queries = queryClient.getQueriesData<CalendarAbsencesResponse>({ queryKey: ['calendar-absences'] });
      const previousState = queries.map(([queryKey, data]) => ({ queryKey, data }));

      // Optimistically update the absence status across all cached queries
      queries.forEach(([queryKey, old]) => {
        if (!old) return;

        let statusChanged = false;
        let oldStatus = null;

        const newAbsences = old.absences.map((absence) => {
          if (absence.id === id) {
            statusChanged = absence.status !== 'approved';
            oldStatus = absence.status;
            return { ...absence, status: 'approved' };
          }
          return absence;
        });

        let newCounts = old.counts;
        if (statusChanged && old.counts && oldStatus) {
            newCounts = {
                ...old.counts,
                [oldStatus]: Math.max(0, old.counts[oldStatus] - 1),
                ['approved']: old.counts['approved'] + 1,
            };
        }

        queryClient.setQueryData<CalendarAbsencesResponse>(queryKey, {
          absences: newAbsences,
          ...(newCounts ? { counts: newCounts } : {}),
        });
      });

      return { previousState };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousState) {
        context.previousState.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(err instanceof Error ? err.message : 'Failed to process absence');
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
      const res = await fetch(`/api/absences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reason }),
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

      // Snapshot previous values for all calendar-absences queries
      const queries = queryClient.getQueriesData<CalendarAbsencesResponse>({ queryKey: ['calendar-absences'] });
      const previousState = queries.map(([queryKey, data]) => ({ queryKey, data }));

      // Optimistically update the absence status across all cached queries
      queries.forEach(([queryKey, old]) => {
        if (!old) return;

        let statusChanged = false;
        let oldStatus = null;

        const newAbsences = old.absences.map((absence) => {
          if (absence.id === id) {
            statusChanged = absence.status !== 'rejected';
            oldStatus = absence.status;
            return { ...absence, status: 'rejected' };
          }
          return absence;
        });

        let newCounts = old.counts;
        if (statusChanged && old.counts && oldStatus) {
            newCounts = {
                ...old.counts,
                [oldStatus]: Math.max(0, old.counts[oldStatus] - 1),
                ['rejected']: old.counts['rejected'] + 1,
            };
        }

        queryClient.setQueryData<CalendarAbsencesResponse>(queryKey, {
          absences: newAbsences,
          ...(newCounts ? { counts: newCounts } : {}),
        });
      });

      return { previousState };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousState) {
        context.previousState.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(err instanceof Error ? err.message : 'Failed to process absence');
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
