'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';

interface DoctorSpecialtyChangedPayload {
  doctorProfileId: string;
  status: string;
}

// Live-refetches doctor-specialty queries whenever the doctor's own pending
// update is approved/rejected (received on the doctor's own userId room).
// Invalidating the shared 'doctor-specialties' key prefix covers both
// ['doctor-specialties', 'me'] and the admin-side
// ['doctor-specialties', 'admin', 'doctors', query] queries, the same way
// the rest of this codebase already relies on TanStack Query's key-prefix
// matching (e.g. useApproveDoctorSpecialtyUpdate invalidates
// ['doctor-specialties', 'admin', 'doctors'] to cover every filtered query
// variant). Uses the tab-wide shared socket (see src/lib/realtime/socket.ts).
export function useDoctorSpecialtyEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (_payload: DoctorSpecialtyChangedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties'] });
    };

    socket.on('doctor-specialty:changed', handler);

    return () => {
      socket.off('doctor-specialty:changed', handler);
    };
  }, [queryClient]);
}
