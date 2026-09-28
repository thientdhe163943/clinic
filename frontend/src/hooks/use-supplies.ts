'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplyCategoriesApi, suppliesApi } from '@/lib/api/endpoints/supplies';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type {
  CreateSupplyCategoryRequest,
  CreateSupplyRequest,
  DistributeSupplyRequest,
  ImportSuppliesRequest,
  SupplyStockStatus,
  SupplyTransactionType,
  UpdateSupplyCategoryRequest,
  UpdateSupplyRequest,
} from '@/types/supplies';

// ─── Supply categories ──────────────────────────────────────────────────────

export function useSupplyCategories() {
  return useQuery({
    queryKey: ['supply-categories'],
    queryFn: () => supplyCategoriesApi.list(),
  });
}

export function useCreateSupplyCategory() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateSupplyCategoryRequest) => supplyCategoriesApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supply-categories'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useUpdateSupplyCategory() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplyCategoryRequest }) =>
      supplyCategoriesApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supply-categories'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useDeleteSupplyCategory() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => supplyCategoriesApi.remove(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supply-categories'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

// ─── Supplies ───────────────────────────────────────────────────────────────

export function useSupplyList(params?: {
  search?: string;
  category?: string;
  status?: SupplyStockStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['supplies', params],
    queryFn: () => suppliesApi.list(params),
  });
}

export function useCreateSupply() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateSupplyRequest) => suppliesApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useUpdateSupply() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplyRequest }) => suppliesApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useDeleteSupply() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => suppliesApi.remove(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useSupplyTransactions(
  id: string | undefined,
  params?: { from?: string; to?: string; type?: SupplyTransactionType; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['supplies', id, 'transactions', params],
    queryFn: () => suppliesApi.listTransactions(id ?? '', params),
    enabled: Boolean(id),
  });
}

export function useImportSupplies() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: ImportSuppliesRequest) => suppliesApi.import(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useDistributeSupply() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: DistributeSupplyRequest) => suppliesApi.distribute(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}
