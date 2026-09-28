import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  ClsOrder,
  CreateClsOrderRequest,
  CreateExaminationResultRequest,
  ExaminationResult,
  UpsertVitalSignsRequest,
  VitalSigns,
  VisitListItem,
  VisitQuery,
  NurseQueueResponse,
  VisitQueueContext,
} from '@/types/visits';

export const visitsApi = {
  list(query: VisitQuery = {}) {
    return unwrap<VisitListItem[]>(apiClient.get('/visits', { params: query }));
  },
  nurseQueue(status?: string, shift?: string) {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (shift) params.shift = shift;
    return unwrap<NurseQueueResponse>(apiClient.get('/visits/nurse-queue', { params }));
  },
  getQueueContext(query: Pick<VisitQuery, 'date' | 'shift'> = {}) {
    return unwrap<VisitQueueContext>(apiClient.get('/visits/queue-context', { params: query }));
  },

  callPatient(id: string) {
    return unwrapResult<VisitListItem>(apiClient.patch(`/visits/${id}/call`));
  },

  startVisit(id: string) {
    return unwrapResult<VisitListItem>(apiClient.patch(`/visits/${id}/start`));
  },

  holdForResults(id: string) {
    return unwrapResult<VisitListItem>(apiClient.patch(`/visits/${id}/hold-for-results`));
  },

  markNoShow(id: string) {
    return unwrapResult<VisitListItem>(apiClient.patch(`/visits/${id}/no-show`));
  },

  printAdmissionSlipUrl(id: string) {
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/visits/${id}/admission/print`;
  },

  createResult(id: string, input: CreateExaminationResultRequest) {
    return unwrapResult<ExaminationResult>(apiClient.post(`/visits/${id}/result`, input));
  },

  updateResult(id: string, input: Partial<CreateExaminationResultRequest>) {
    return unwrapResult<ExaminationResult>(apiClient.patch(`/visits/${id}/result`, input));
  },

  getResult(id: string) {
    return unwrap<ExaminationResult>(apiClient.get(`/visits/${id}/result`));
  },

  completeVisit(id: string) {
    return unwrapResult<VisitListItem>(apiClient.patch(`/visits/${id}/complete`));
  },

  printResultUrl(id: string) {
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/visits/${id}/result/print`;
  },

  printAllClsOrdersUrl(visitId: string, diagnosis?: string) {
    const base = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/visits/${visitId}/cls-orders/print`;
    return diagnosis ? `${base}?diagnosis=${encodeURIComponent(diagnosis)}` : base;
  },

  upsertVitals(id: string, input: UpsertVitalSignsRequest) {
    return unwrapResult<VitalSigns>(apiClient.post(`/visits/${id}/vitals`, input));
  },

  getVitals(id: string) {
    return apiClient
      .get<{ success: boolean; data: VitalSigns | null }>(`/visits/${id}/vitals`)
      .then((r) => r.data.data ?? null);
  },
};

export const clsOrdersApi = {
  list(visitId: string) {
    return unwrap<ClsOrder[]>(apiClient.get('/cls-orders', { params: { visitId } }));
  },

  listAll(params: { date?: string; statuses?: string } = {}) {
    return unwrap<ClsOrder[]>(apiClient.get('/cls-orders', { params }));
  },

  create(input: CreateClsOrderRequest) {
    return unwrapResult<ClsOrder>(apiClient.post('/cls-orders', input));
  },

  callPatient(id: string) {
    return unwrapResult<ClsOrder>(apiClient.patch(`/cls-orders/${id}/call`));
  },

  update(id: string, data: { clsRoomId?: string; serviceId?: string; note?: string | null }) {
    return unwrapResult<ClsOrder>(apiClient.patch(`/cls-orders/${id}`, data));
  },

  enterResult(id: string, summary: string) {
    return unwrapResult<ClsOrder>(apiClient.patch(`/cls-orders/${id}/result`, { summary }));
  },

  printUrl(id: string) {
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/cls-orders/${id}/print`;
  },
};
