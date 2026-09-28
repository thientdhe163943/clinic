'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';

interface AppointmentChangedPayload {
  appointmentId: string;
}

// Live-refetches the appointments list/detail queries whenever any
// appointment is created/updated/cancelled/checked-in elsewhere (e.g. by the
// patient online, or another receptionist). Auth is via the same httpOnly
// cookie the REST client already relies on — no bearer token to attach.
// Uses the tab-wide shared socket (see src/lib/realtime/socket.ts) — this
// hook only attaches/detaches its own listener, it does not own the
// connection's lifecycle.
export function useAppointmentEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (_payload: AppointmentChangedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    };

    socket.on('appointment:changed', handler);

    return () => {
      socket.off('appointment:changed', handler);
    };
  }, [queryClient]);
}
