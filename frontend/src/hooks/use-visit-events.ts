'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';

interface VisitChangedPayload {
  visitId: string;
}

// Live-refetches the visit queue whenever any visit is created/updated
// elsewhere (another doctor/nurse/receptionist action). Received by
// DOCTOR + NURSE + RECEPTIONIST role rooms. Uses the tab-wide shared socket
// (see src/lib/realtime/socket.ts).
export function useVisitEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (_payload: VisitChangedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
    };

    socket.on('visit:changed', handler);

    return () => {
      socket.off('visit:changed', handler);
    };
  }, [queryClient]);
}
