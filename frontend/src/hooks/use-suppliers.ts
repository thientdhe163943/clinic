'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/endpoints/suppliers';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type { CreateSupplierRequest, UpdateSupplierRequest } from '@/types/suppliers';

// Legacy/bare-array mode — used by the Supply-import form's supplier picker.
export function useSuppliers(search?: string) {
  return useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => suppliersApi.list(search),
  });
}

// Paginated admin-management mode — used by the admin supplier CRUD page.
export function useSupplierList(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['suppliers', 'admin', params],
    queryFn: () => suppliersApi.listAdmin(params),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateSupplierRequest) => suppliersApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierRequest }) =>
      suppliersApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}
