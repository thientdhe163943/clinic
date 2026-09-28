'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { useNotificationStore } from '@/stores/notification.store';

// Version-up 0.2 Phase 2 #9 tình huống B — fired by
// ReassignScheduleDoctorUseCase (reassign-schedule-doctor.use-case.ts) when
// ADMIN marks a doctor absent for a shift and swaps in a substitute. Same
// event name, two different payload shapes depending on the room it lands
// in:
//  - RECEPTIONIST role room gets the full payload — reception needs to know
//    who/how many appointments moved so they can follow up with patients.
//  - the substitute doctor's own userId room only gets `{ scheduleId }` —
//    just enough to know their queue changed.
// Neither payload carries doctor *names* (only ids), so the toast copy below
// stays generic rather than trying to resolve names that aren't there.
interface ScheduleDoctorReassignedPayload {
  scheduleId: string;
  originalDoctorId?: string;
  substituteDoctorId?: string;
  affectedAppointmentIds?: string[];
  reason?: string;
}

// Live-refetches schedules/appointments/visits whenever a doctor is
// reassigned off a shift elsewhere, and toasts a heads-up. Mount once per
// role layout for ADMIN + RECEPTIONIST (see (dashboard)/layout.tsx) — the
// substitute doctor also needs their own queue refreshed, so DOCTOR is
// included too. Uses the tab-wide shared socket (see
// src/lib/realtime/socket.ts).
export function useScheduleEvents() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (payload: ScheduleDoctorReassignedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['visits'] });

      const affectedCount = payload.affectedAppointmentIds?.length ?? 0;
      push({
        variant: 'warning',
        title: 'Một bác sĩ vừa được đánh dấu vắng và thay thế',
        description:
          affectedCount > 0
            ? `${affectedCount} lịch hẹn đã được tự động chuyển sang bác sĩ thay thế${
                payload.reason ? ` (lý do: ${payload.reason})` : ''
              }. Vui lòng chủ động gọi xác nhận lại với bệnh nhân nếu cần.`
            : 'Ca trực của bạn vừa được chuyển sang bác sĩ thay thế.',
      });
    };

    socket.on('schedule:doctor-reassigned', handler);

    return () => {
      socket.off('schedule:doctor-reassigned', handler);
    };
  }, [queryClient, push]);
}
