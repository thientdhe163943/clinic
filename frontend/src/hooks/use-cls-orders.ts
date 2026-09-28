'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsOrdersApi } from '@/lib/api/endpoints/cls-orders';
import { useNotificationStore } from '@/stores/notification.store';
import type { ClsOrderFilter, EnterClsResultRequest, LabQueueResponse } from '@/types/cls-orders';
import type { ApiError } from '@/types/api';

const QUERY_KEY = 'cls-orders';

export function useClsOrdersByVisit(visitId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'by-visit', visitId],
    queryFn: () => clsOrdersApi.listByVisit(visitId!),
    enabled: Boolean(visitId),
  });
}

export function useClsOrder(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: () => clsOrdersApi.getById(id!),
    enabled: Boolean(id),
  });
}

// Real-time push (`cls-order:changed`, see useClsOrderEvents) now
// invalidates this query the moment a CLS order changes, so the 15s poll is
// no longer the primary delivery mechanism — kept as a slow safety-net poll
// only (in case the socket silently drops without the client noticing).
export function useLabQueue(filter: ClsOrderFilter = {}) {
  return useQuery<LabQueueResponse>({
    queryKey: [QUERY_KEY, 'all', filter],
    queryFn: () => clsOrdersApi.listAll(filter),
    refetchInterval: 60_000,
  });
}

export function useCallPatientToCls() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => clsOrdersApi.call(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useCallPatientGroupToCls() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (orderIds: string[]) =>
      Promise.all(orderIds.map((id) => clsOrdersApi.call(id))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      push({ variant: 'success', title: 'Đã gọi bệnh nhân vào phòng' });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useEnterClsResult() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EnterClsResultRequest }) =>
      clsOrdersApi.enterResult(id, input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

// version-up 0.2 Phase 3 — OCR pre-fill draft, LAB category only. Doesn't
// touch any persisted data, so no query invalidation on success — the page
// merges the returned rows straight into its local editable-table state.
export function useOcrExtractClsResult() {
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => clsOrdersApi.ocrExtract(id, file),
    onSuccess: (result) => {
      push({ variant: 'info', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useUploadClsAttachment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      clsOrdersApi.uploadAttachment(id, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}
