'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prescriptionsApi } from '@/lib/api/endpoints/prescriptions';
import { medicinesApi } from '@/lib/api/endpoints/medicines';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type { CreatePrescriptionRequest, UpdatePrescriptionRequest } from '@/types/visits';

export function usePrescription(visitId: string) {
  return useQuery({
    queryKey: ['prescriptions', 'visit', visitId],
    queryFn: () => prescriptionsApi.getByVisit(visitId),
    enabled: Boolean(visitId),
    retry: false,
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (data: CreatePrescriptionRequest) => prescriptionsApi.create(data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['prescriptions', 'visit', variables.visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useUpdatePrescription(visitId: string) {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePrescriptionRequest }) =>
      prescriptionsApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['prescriptions', 'visit', visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useMedicines(search?: string) {
  return useQuery({
    queryKey: ['medicines', search ?? ''],
    queryFn: () => medicinesApi.list(search),
  });
}
