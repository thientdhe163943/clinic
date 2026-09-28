import { Invoice, InvoiceItem } from '../entities/invoice.entity';
import { InvoiceItemType } from '../enums/invoice-item-type.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');

export interface CreateInvoiceItemData {
  itemType: InvoiceItemType;
  serviceRefId?: string | null;
  clsRefId?: string | null;
  medicineRefId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

export interface CreateInvoiceData {
  appointmentId: string;
  patientId: string;
  invoiceCode: string;
  subtotal: number;
  discount: number;
  total: number;
  amountDue: number;
  note?: string | null;
  createdBy: string;
  items: CreateInvoiceItemData[];
}

export interface InvoiceListFilter {
  search?: string;
  paymentStatus?: PaymentStatus;
  page: number;
  limit: number;
}

export interface InvoiceListItem {
  invoice: Invoice;
  patientName: string;
  patientCode: string;
}

/**
 * Version-up 0.2 item #10: appends newly-billable lines to an *existing*
 * invoice (e.g. a CLS order just created, or medicine dispensed at
 * visit-completion) instead of creating a brand-new Invoice — the Invoice
 * lifecycle moved from "create once at the very end" to "create early at
 * check-in, grow line by line". Recomputes subtotal/total/amountDue and
 * paymentStatus from the full (old + new) item set.
 */
export interface AppendInvoiceItemsData {
  invoiceId: string;
  items: CreateInvoiceItemData[];
}

/**
 * Version-up 0.2 item #10: one "collect now" round — marks the given
 * InvoiceItem rows as paid (paidAt = paidAt) and records an InvoicePayment
 * (+ InvoicePaymentItem link rows) so which items were covered by which
 * round is auditable. itemIds must all belong to invoiceId and must not
 * already be paid — the caller (PayInvoiceUseCase) validates this before
 * calling in.
 */
export interface PayInvoiceItemsData {
  invoiceId: string;
  itemIds: string[];
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  createdBy: string;
  note?: string | null;
}

export interface UpdateInvoiceItemData {
  name: string;
  unitPrice: number;
  amount: number;
}

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByAppointmentId(appointmentId: string): Promise<Invoice | null>;
  /**
   * Version-up 0.2 item #10, Gate #2: looks up the single InvoiceItem
   * (itemType=CLS) billed for a given ClsOrder, without needing to resolve
   * appointmentId first (CallPatientToClsUseCase only has the ClsOrder id
   * on hand) — returns null if that order was never billed (e.g. its
   * invoice creation raced/failed), in which case the gate lets it through
   * rather than permanently blocking an order nothing can ever mark paid.
   */
  findItemByClsRefId(clsRefId: string): Promise<InvoiceItem | null>;
  findMany(filter: InvoiceListFilter): Promise<{ items: InvoiceListItem[]; total: number }>;
  create(data: CreateInvoiceData): Promise<Invoice>;
  appendItems(data: AppendInvoiceItemsData): Promise<Invoice>;
  payItems(data: PayInvoiceItemsData): Promise<Invoice>;
  /** Updates the invoice item linked to a CLS order and recomputes invoice totals. */
  updateItemByClsRefId(clsRefId: string, data: UpdateInvoiceItemData): Promise<void>;
}
