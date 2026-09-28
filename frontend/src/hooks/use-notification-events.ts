'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';

interface NotificationCreatedPayload {
  notificationId: string;
}

// Live-refetches the notification list/unread-count whenever a new
// notification is created for the logged-in user (received on their own
// userId room). Uses the tab-wide shared socket (see
// src/lib/realtime/socket.ts).
export function useNotificationEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (_payload: NotificationCreatedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification:created', handler);

    return () => {
      socket.off('notification:created', handler);
    };
  }, [queryClient]);
}
