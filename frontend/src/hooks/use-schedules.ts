'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { schedulesApi } from '@/lib/api/endpoints/schedules';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type {
  CreateBulkScheduleRequest,
  CreateScheduleRequest,
  ListSchedulesQuery,
  ReassignScheduleDoctorRequest,
  UpdateScheduleRequest,
} from '@/types/schedules';

export function useSchedules(query: ListSchedulesQuery = {}, enabled = true) {
  return useQuery({
    queryKey: ['schedules', query],
    queryFn: () => schedulesApi.list(query),
    enabled,
  });
}

export function useSchedule(id: string | undefined) {
  return useQuery({
    queryKey: ['schedules', id],
    queryFn: () => schedulesApi.getById(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: CreateScheduleRequest) => schedulesApi.create(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      if (result.data) queryClient.setQueryData(['schedules', result.data.id], result.data);
      router.push('/admin/schedules');
    },
  });
}

export function useCreateBulkSchedule() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (input: CreateBulkScheduleRequest) => schedulesApi.createBulk(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScheduleRequest }) => schedulesApi.update(id, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      if (result.data) queryClient.setQueryData(['schedules', result.data.id], result.data);
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      router.push('/admin/schedules');
    },
  });
}

// Version-up 0.2 Phase 2 #9 tình huống B — also invalidates `appointments`
// (every still-open appointment on the shift gets its doctorId swapped
// server-side) alongside `schedules` (isAbsent/originalUserId badge).
export function useReassignScheduleDoctor() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReassignScheduleDoctorRequest }) =>
      schedulesApi.reassignDoctor(id, input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}
