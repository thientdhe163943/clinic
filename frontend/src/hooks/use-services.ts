'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/lib/api/endpoints/services';
import { useNotificationStore } from '@/stores/notification.store';
import type { ClsServiceCategory, CreateServiceRequest, ServiceType, UpdateServiceRequest } from '@/types/services';
import type { ApiError } from '@/types/api';

export function useServiceList(params?: { search?: string; type?: ServiceType; clsCategory?: ClsServiceCategory; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['services', params],
    queryFn: () => servicesApi.list(params),
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateServiceRequest) => servicesApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceRequest }) =>
      servicesApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}
