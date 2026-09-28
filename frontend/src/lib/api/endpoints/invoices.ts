import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  CreateInvoiceRequest,
  Invoice,
  InvoiceListResponse,
  InvoiceQuery,
  PayInvoiceRequest,
} from '@/types/invoices';

export const invoicesApi = {
  // ─── Queries (GET) — trả về data trực tiếp ─────────────────────────────────
  list(query: InvoiceQuery = {}) {
    return unwrap<InvoiceListResponse>(apiClient.get('/invoices', { params: query }));
  },
  getByAppointment(appointmentId: string) {
    return unwrap<Invoice>(apiClient.get(`/invoices/${appointmentId}`));
  },
  printUrl(id: string) {
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/invoices/${id}/print`;
  },

  // ─── Mutations — trả về { data, message } để hook đọc result.message ───────
  create(input: CreateInvoiceRequest) {
    return unwrapResult<Invoice>(apiClient.post('/invoices', input));
  },
  pay(id: string, input: PayInvoiceRequest) {
    return unwrapResult<Invoice>(apiClient.patch(`/invoices/${id}/pay`, input));
  },
};
