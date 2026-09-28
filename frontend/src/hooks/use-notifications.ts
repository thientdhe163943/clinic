'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/endpoints/notifications';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';

// Real-time push (`notification:created`, see useNotificationEvents) now
// invalidates this query the moment a notification is created for the
// logged-in user, so this no longer needs to be the primary delivery
// mechanism. Kept as a slow safety-net poll only (in case the socket
// silently drops without the client noticing) — was 30s when this was the
// sole delivery mechanism, relaxed to 2min now that it's just a fallback.
const POLL_INTERVAL_MS = 120_000;

export function useNotificationList() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? POLL_INTERVAL_MS : false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}
