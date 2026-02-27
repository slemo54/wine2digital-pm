import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

/**
 * Hook to fetch notifications
 */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<Notification[]> => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook to mark all notifications as read with optimistic update
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
      return res.json();
    },

    // OPTIMISTIC UPDATE - Update cache immediately
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['dashboard', 'notifications'] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);
      const previousDashboardNotifications = queryClient.getQueryData(['dashboard', 'notifications']);

      // Optimistically update all notifications to read
      queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
        if (!old) return old;
        return old.map((notification) => ({ ...notification, isRead: true }));
      });

      queryClient.setQueryData(['dashboard', 'notifications'], (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((notification: Notification) => ({ ...notification, isRead: true }));
        }
        return old;
      });

      return { previousNotifications, previousDashboardNotifications };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      if (context?.previousDashboardNotifications) {
        queryClient.setQueryData(['dashboard', 'notifications'], context.previousDashboardNotifications);
      }
    },

    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'notifications'] });
    },
  });
}

/**
 * Hook to mark a single notification as read with optimistic update
 */
export function useMarkOneRead(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to mark notification as read');
      return res.json();
    },

    // OPTIMISTIC UPDATE - Update cache immediately
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['dashboard', 'notifications'] });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);
      const previousDashboardNotifications = queryClient.getQueryData(['dashboard', 'notifications']);

      // Optimistically update single notification to read
      queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
        if (!old) return old;
        return old.map((notification) =>
          notification.id === id ? { ...notification, isRead: true } : notification
        );
      });

      queryClient.setQueryData(['dashboard', 'notifications'], (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((notification: Notification) =>
            notification.id === id ? { ...notification, isRead: true } : notification
          );
        }
        return old;
      });

      return { previousNotifications, previousDashboardNotifications };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
      if (context?.previousDashboardNotifications) {
        queryClient.setQueryData(['dashboard', 'notifications'], context.previousDashboardNotifications);
      }
    },

    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'notifications'] });
    },
  });
}
