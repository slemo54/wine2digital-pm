import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

/**
 * Hook per ottenere i dettagli base di un task
 */
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId) throw new Error('Task ID is required');
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch task');
      return res.json();
    },
    enabled: !!taskId,
    staleTime: 1000 * 60 * 2, // 2 minuti
  });
}

/**
 * Hook per ottenere TUTTI i dettagli di un task in una singola chiamata
 * Sostituisce le 5 chiamate separate (task, subtasks, comments, attachments, activity)
 *
 * PERFORMANCE: Risparmio stimato di 300-500ms per apertura modal
 */
export function useTaskFull(taskId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['task-full', taskId],
    queryFn: async () => {
      if (!taskId) throw new Error('Task ID is required');
      const res = await fetch(`/api/tasks/${taskId}/full`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch task details');
      }
      return res.json();
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!taskId,
    staleTime: 1000 * 30, // 30 secondi - più fresco per dati dettagliati
    gcTime: 1000 * 60 * 5, // 5 minuti in cache
  });
}

/**
 * Hook per aggiornare un task con optimistic update
 */
export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update task');
      }
      return res.json();
    },

    // OPTIMISTIC UPDATE - UI si aggiorna immediatamente
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['task-full', taskId] });
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });

      // Snapshot previous values
      const previousFull = queryClient.getQueryData(['task-full', taskId]);
      const previousTask = queryClient.getQueryData(['task', taskId]);

      // Optimistically update
      queryClient.setQueryData(['task-full', taskId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          task: { ...old.task, ...newData },
        };
      });

      queryClient.setQueryData(['task', taskId], (old: any) => {
        if (!old) return old;
        return { ...old, ...newData };
      });

      return { previousFull, previousTask };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousFull) {
        queryClient.setQueryData(['task-full', taskId], context.previousFull);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', taskId], context.previousTask);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    },

    onSuccess: () => {
      toast.success('Task updated successfully');
    },

    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['task-full', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Invalidate lists
    },
  });
}

/**
 * Hook per toggle status di un subtask con optimistic update
 */
export function useToggleSubtask(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      completed,
      status,
    }: {
      subtaskId: string;
      completed: boolean;
      status: string;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed, status }),
      });
      if (!res.ok) throw new Error('Failed to update subtask');
      return res.json();
    },

    // OPTIMISTIC UPDATE per risposta immediata (<16ms)
    onMutate: async ({ subtaskId, completed, status }) => {
      await queryClient.cancelQueries({ queryKey: ['task-full', taskId] });

      const previousData = queryClient.getQueryData(['task-full', taskId]);

      queryClient.setQueryData(['task-full', taskId], (old: any) => {
        if (!old?.task?.subtasks) return old;

        return {
          ...old,
          task: {
            ...old.task,
            subtasks: old.task.subtasks.map((s: any) =>
              s.id === subtaskId ? { ...s, completed, status } : s
            ),
          },
        };
      });

      return { previousData };
    },

    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['task-full', taskId], context.previousData);
      }
      toast.error('Failed to update subtask');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-full', taskId] });
    },
  });
}

/**
 * Hook per aggiungere un commento con optimistic update
 */
export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },

    onSuccess: () => {
      toast.success('Comment added');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-full', taskId] });
    },
  });
}

/**
 * Hook per prefetch dei task details al hover
 * Carica i dati in anticipo per apertura istantanea del modal
 */
export function usePrefetchTaskFull() {
  const queryClient = useQueryClient();

  return (taskId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['task-full', taskId],
      queryFn: async () => {
        const res = await fetch(`/api/tasks/${taskId}/full`);
        if (!res.ok) throw new Error('Failed to prefetch task');
        return res.json();
      },
      staleTime: 1000 * 60 * 5, // 5 minuti
    });
  };
}
