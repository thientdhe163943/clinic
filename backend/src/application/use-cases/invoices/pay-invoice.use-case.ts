import { Inject, Injectable } from '@nestjs/common';
import { PayInvoiceRequestDto } from '../../dtos/invoices/pay-invoice.dto';
import { InvoiceResponseDto, toInvoiceResponse } from '../../dtos/invoices/invoice-response.dto';
import {
  InvalidPayInvoiceItemsError,
  InvoiceAlreadyPaidError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { INVOICE_REPOSITORY, InvoiceRepository } from '../../../domain/repositories/invoice.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

export interface PayInvoiceInput extends PayInvoiceRequestDto {
  invoiceId: string;
  actorId: string;
}

// Version-up 0.2 item #10: paying an invoice is now a per-stage "collect
// now" action instead of an all-or-nothing final settlement — a
// receptionist can collect just the exam fee at check-in time, then later
// (a separate call) just a freshly-billed CLS fee, and so on. Each call
// records one InvoicePayment round covering exactly the InvoiceItem rows
// requested (or, if none given, every currently-unpaid row — preserves the
// old "pay everything at once" behavior).
@Injectable()
export class PayInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(input: PayInvoiceInput): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(input.invoiceId);
    if (!invoice) throw new ResourceNotFoundError('Invoice', { id: input.invoiceId });

    // Business Rule: an invoice already marked PAID cannot be paid again.
    if (invoice.paymentStatus === PaymentStatus.PAID) throw new InvoiceAlreadyPaidError();

    const unpaidItems = invoice.items.filter((item) => !item.paidAt);
    if (unpaidItems.length === 0) throw new InvoiceAlreadyPaidError();

    let itemIds: string[];
    if (input.itemIds && input.itemIds.length > 0) {
      // Business Rule: every requested id must belong to this invoice and
      // must not already be paid — otherwise reject the whole round rather
      // than silently dropping/ignoring invalid ids.
      const unpaidIds = new Set(unpaidItems.map((item) => item.id));
      const allValid = input.itemIds.every((id) => unpaidIds.has(id));
      if (!allValid) throw new InvalidPayInvoiceItemsError();
      itemIds = [...new Set(input.itemIds)];
    } else {
      // No itemIds given => pay everything still outstanding (backward
      // compatible with the pre-#10 "pay it all at once" behavior).
      itemIds = unpaidItems.map((item) => item.id);
    }

    const amount = invoice.items
      .filter((item) => itemIds.includes(item.id))
      .reduce((sum, item) => sum + item.amount, 0);
    const paidAt = new Date();

    const updated = await this.invoiceRepository.payItems({
      invoiceId: invoice.id,
      itemIds,
      amount,
      method: input.paymentMethod,
      paidAt,
      createdBy: input.actorId,
      note: input.note,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'INVOICE_PAID',
      module: 'INVOICE',
      targetId: updated.id,
      detail: { invoiceCode: updated.invoiceCode, amount, itemIds, paymentMethod: input.paymentMethod },
    });

    try {
      this.realtimePort.emit(['RECEPTIONIST', 'ADMIN'], 'invoice:changed', { invoiceId: updated.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    const patient = await this.patientRepository.findById(updated.patientId);
    return toInvoiceResponse(updated, patient?.fullName ?? '', patient?.patientCode ?? '');
  }
}
