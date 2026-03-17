'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
}

/**
 * Hook to fetch notifications with configurable polling interval.
 * Defaults to polling every 30 seconds when the tab is focused.
 *
 * @example
 * ```tsx
 * const { notifications, unreadCount, isLoading } = useNotifications();
 * ```
 */
export function useNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
  pollingInterval?: number;
}) {
  const {
    unreadOnly = false,
    limit = 20,
    pollingInterval = 30_000,
  } = options || {};

  const searchParams = new URLSearchParams({
    ...(unreadOnly && { unreadOnly: 'true' }),
    limit: limit.toString(),
  });

  const query = useQuery({
    queryKey: ['notifications', { unreadOnly, limit }],
    queryFn: () =>
      apiClient.get<NotificationsResponse>(
        `/api/notifications?${searchParams.toString()}`
      ),
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false, // Only poll when tab is focused
  });

  return {
    notifications: query.data?.data ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to mark notifications as read.
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { ids?: string[]; markAllRead?: boolean }) =>
      apiClient.patch('/api/notifications', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Convenience hook to mark all notifications as read in one call.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.patch('/api/notifications', { markAllRead: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to get just the unread notification count.
 * Lightweight polling for notification badges.
 */
export function useUnreadCount(pollingInterval = 30_000) {
  const query = useQuery({
    queryKey: ['notifications', { unreadOnly: true, limit: 1 }],
    queryFn: () =>
      apiClient.get<NotificationsResponse>(
        '/api/notifications?unreadOnly=true&limit=1'
      ),
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false,
    select: (data) => data.unreadCount,
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
