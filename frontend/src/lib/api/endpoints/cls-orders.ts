import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  ClsOrder,
  ClsOrderFilter,
  EnterClsResultRequest,
  LabQueueResponse,
  OcrExtractResponse,
} from '@/types/cls-orders';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const clsOrdersApi = {
  listByVisit(visitId: string) {
    return unwrap<ClsOrder[]>(apiClient.get('/cls-orders', { params: { visitId } }));
  },
  listAll(filter: ClsOrderFilter = {}) {
    const params: Record<string, string> = {};
    if (filter.statuses?.length) params.statuses = filter.statuses.join(',');
    return unwrap<LabQueueResponse>(apiClient.get('/cls-orders', { params }));
  },
  getById(id: string) {
    return unwrap<ClsOrder>(apiClient.get(`/cls-orders/${id}`));
  },
  call(id: string) {
    return unwrapResult<ClsOrder>(apiClient.patch(`/cls-orders/${id}/call`));
  },
  enterResult(id: string, input: EnterClsResultRequest) {
    return unwrapResult<ClsOrder>(apiClient.patch(`/cls-orders/${id}/result`, input));
  },
  // version-up 0.2 Phase 3 — OCR pre-fill draft, LAB category only. Uses
  // unwrapResult (not unwrap) because MSG_INFO_0099 carries a
  // toast-worthy reminder ("vui lòng kiểm tra trước khi lưu") that the hook
  // surfaces — unlike ai.ts's chat endpoint, this one has a message to show.
  ocrExtract(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return unwrapResult<OcrExtractResponse>(
      apiClient.post(`/cls-orders/${id}/ocr-extract`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
  uploadAttachment(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return unwrapResult<{ url: string; fileName: string }>(
      apiClient.post(`/cls-orders/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
  printUrl(id: string) {
    return `${API_BASE}/cls-orders/${id}/print`;
  },
  printResultUrl(id: string) {
    return `${API_BASE}/cls-orders/${id}/result-print`;
  },
};
