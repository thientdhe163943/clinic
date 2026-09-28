'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { visitsApi, clsOrdersApi } from '@/lib/api/endpoints/visits';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type {
  CreateClsOrderRequest,
  CreateExaminationResultRequest,
  NurseQueueResponse,
  ShiftType,
  UpsertVitalSignsRequest,
  VisitQuery,
  VisitQueueContext,
  VisitStatus,
} from '@/types/visits';

export function useVisits(query: VisitQuery = {}) {
  return useQuery({
    queryKey: ['visits', query],
    queryFn: () => visitsApi.list(query),
  });
}

export function useNurseQueue(status?: VisitStatus, shift?: ShiftType) {
  return useQuery<NurseQueueResponse>({
    queryKey: ['visits', 'nurse-queue', status, shift],
    queryFn: () => visitsApi.nurseQueue(status, shift),
    refetchInterval: 15_000,
  });
}

export function useVisitQueueContext(query?: Pick<VisitQuery, 'date' | 'shift'>) {
  return useQuery<VisitQueueContext>({
    queryKey: ['visits', 'queue-context', query],
    queryFn: () => visitsApi.getQueueContext(query),
    enabled: query !== undefined,
  });
}

export function useCallPatient() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (id: string) => visitsApi.callPatient(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useStartVisit() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (id: string) => visitsApi.startVisit(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useHoldForResults() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (id: string) => visitsApi.holdForResults(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useMarkNoShow() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (id: string) => visitsApi.markNoShow(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useCreateExaminationResult(visitId: string) {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (data: CreateExaminationResultRequest) => visitsApi.createResult(visitId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits', 'result', visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useUpdateExaminationResult(visitId: string) {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (data: Partial<CreateExaminationResultRequest>) => visitsApi.updateResult(visitId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits', 'result', visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useVisitResult(visitId: string) {
  return useQuery({
    queryKey: ['visits', 'result', visitId],
    queryFn: () => visitsApi.getResult(visitId),
    retry: false,
  });
}

export function useCompleteVisit() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (id: string) => visitsApi.completeVisit(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useClsOrders(visitId: string) {
  return useQuery({
    queryKey: ['cls-orders', visitId],
    queryFn: () => clsOrdersApi.list(visitId),
    enabled: Boolean(visitId),
  });
}

export function useCreateClsOrder() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (data: CreateClsOrderRequest) => clsOrdersApi.create(data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['cls-orders', variables.visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useEditClsOrder(visitId: string) {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; clsRoomId?: string; serviceId?: string; note?: string | null }) =>
      clsOrdersApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['cls-orders', visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useCallPatientToCls() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, visitId }: { id: string; visitId: string }) =>
      clsOrdersApi.callPatient(id).then((r) => ({ ...r, visitId })),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['cls-orders', result.visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useAllClsOrders(params: { date?: string; statuses?: string } = {}) {
  return useQuery({
    queryKey: ['cls-orders', 'all', params],
    queryFn: () => clsOrdersApi.listAll(params),
  });
}

export function useLabCallPatient() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (id: string) => clsOrdersApi.callPatient(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['cls-orders', 'all'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useVitalSigns(visitId: string) {
  return useQuery({
    queryKey: ['vitals', visitId],
    queryFn: () => visitsApi.getVitals(visitId),
    enabled: Boolean(visitId),
  });
}

export function useUpsertVitalSigns(visitId: string) {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: (data: UpsertVitalSignsRequest) => visitsApi.upsertVitals(visitId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['vitals', visitId] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useEnterClsResult() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, summary }: { id: string; summary: string }) =>
      clsOrdersApi.enterResult(id, summary),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['cls-orders', 'all'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}
