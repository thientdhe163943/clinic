import type { PaginationMeta } from './api';

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';
export type InvoiceItemType = 'SERVICE' | 'CLS' | 'MEDICINE';

export interface InvoiceItem {
  id: string;
  itemType: InvoiceItemType;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  /** Version-up 0.2 item #10: set once this line has been collected. */
  paidAt: string | null;
}

export interface Invoice {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  invoiceCode: string;
  subtotal: number;
  discount: number;
  total: number;
  amountDue: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  items: InvoiceItem[];
}

export interface InvoiceListResponse {
  items: Invoice[];
  meta: PaginationMeta;
}

export interface InvoiceQuery {
  search?: string;
  paymentStatus?: PaymentStatus;
  page?: number;
  limit?: number;
}

export interface CreateInvoiceRequest {
  appointmentId: string;
  discount?: number;
  note?: string;
}

export interface PayInvoiceRequest {
  paymentMethod: PaymentMethod;
  /**
   * Version-up 0.2 item #10: which unpaid InvoiceItem rows this "collect
   * now" round covers. Omitted/empty => pay every currently-unpaid item
   * (backend default, preserves the old "pay everything at once" behavior).
   */
  itemIds?: string[];
  note?: string;
}
