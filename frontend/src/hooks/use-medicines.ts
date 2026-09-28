'use client';

// Admin CRUD hooks for the medicine management page (Feature 70-73). The
// doctor prescribing flow's medicine-search picker (`useMedicines`) lives
// separately in `use-prescriptions.ts` and is untouched by this file.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { medicinesApi } from '@/lib/api/endpoints/medicines';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type { CreateMedicineRequest, UpdateMedicineRequest } from '@/types/medicines';

export function useAdminMedicineList(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin-medicines', params],
    queryFn: () => medicinesApi.listAdmin(params),
  });
}

export function useCreateMedicine() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateMedicineRequest) => medicinesApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
      void queryClient.invalidateQueries({ queryKey: ['medicines'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMedicineRequest }) =>
      medicinesApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
      void queryClient.invalidateQueries({ queryKey: ['medicines'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => medicinesApi.remove(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-medicines'] });
      void queryClient.invalidateQueries({ queryKey: ['medicines'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}
