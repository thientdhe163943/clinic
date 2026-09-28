import { PaginationMeta } from '../pagination.dto';
import { Invoice } from '../../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';

export interface InvoiceItemResponseDto {
  id: string;
  itemType: InvoiceItemType;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  /** Version-up 0.2 item #10: set once this line has been collected. */
  paidAt: Date | null;
}

export interface InvoiceResponseDto {
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
  paidAt: Date | null;
  note: string | null;
  createdAt: Date;
  items: InvoiceItemResponseDto[];
}

export interface InvoiceListResponseDto {
  items: InvoiceResponseDto[];
  meta: PaginationMeta;
}

export function toInvoiceResponse(invoice: Invoice, patientName: string, patientCode: string): InvoiceResponseDto {
  return {
    id: invoice.id,
    appointmentId: invoice.appointmentId,
    patientId: invoice.patientId,
    patientName,
    patientCode,
    invoiceCode: invoice.invoiceCode,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    total: invoice.total,
    amountDue: invoice.amountDue,
    paymentStatus: invoice.paymentStatus,
    paymentMethod: invoice.paymentMethod,
    paidAt: invoice.paidAt,
    note: invoice.note,
    createdAt: invoice.createdAt,
    items: invoice.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      amount: item.amount,
      paidAt: item.paidAt,
    })),
  };
}
