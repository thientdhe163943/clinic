import { Inject, Injectable } from '@nestjs/common';
import { Invoice } from '../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../domain/enums/invoice-item-type.enum';
import { InvoiceCode } from '../../domain/value-objects/invoice-code.vo';
import {
  CreateInvoiceItemData,
  INVOICE_REPOSITORY,
  InvoiceRepository,
} from '../../domain/repositories/invoice.repository';

const INVOICE_CODE_GENERATION_ATTEMPTS = 5;

export interface EnsureInvoiceHasItemsInput {
  appointmentId: string;
  patientId: string;
  createdBy: string;
  items: CreateInvoiceItemData[];
}

/**
 * Shared invoice line-item construction + "grow the invoice as the visit
 * progresses" orchestration for the version-up 0.2 item #10 payment split
 * (exam fee at check-in, CLS fee per order, medicine fee at completion) —
 * used by CheckInAppointmentUseCase (builder only, since check-in's Invoice
 * row must be created inside the same DB transaction as the Visit — see
 * PrismaAppointmentRepository.checkIn()), CreateClsOrderUseCase and
 * CompleteVisitUseCase (both builder + ensureInvoiceHasItems), and
 * CreateInvoiceUseCase (builder only, for its legacy/fallback full-rebuild
 * path). Same rationale as DoctorSlotService/AppointmentTrustService's
 * extraction in Phase 0/1: avoid the same billing math drifting between
 * call sites.
 */
@Injectable()
export class InvoiceBillingService {
  constructor(@Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository) {}

  buildExaminationItem(service: { id: string; name: string; price: number }): CreateInvoiceItemData {
    return {
      itemType: InvoiceItemType.SERVICE,
      serviceRefId: service.id,
      name: service.name,
      unitPrice: service.price,
      quantity: 1,
      amount: service.price,
    };
  }

  buildClsItem(params: { clsOrderId: string; serviceName: string; unitPrice: number }): CreateInvoiceItemData {
    return {
      itemType: InvoiceItemType.CLS,
      clsRefId: params.clsOrderId,
      name: params.serviceName,
      unitPrice: params.unitPrice,
      quantity: 1,
      amount: params.unitPrice,
    };
  }

  buildMedicineItem(params: {
    prescriptionItemId: string;
    medicineName: string;
    unitPrice: number;
  }): CreateInvoiceItemData {
    return {
      itemType: InvoiceItemType.MEDICINE,
      medicineRefId: params.prescriptionItemId,
      name: params.medicineName,
      unitPrice: params.unitPrice,
      quantity: 1,
      amount: params.unitPrice,
    };
  }

  /**
   * Appends `items` to the appointment's invoice, creating it first if this
   * is the very first billable line for it (e.g. an appointment booked
   * without a service at first, then billed only once a CLS order is
   * placed). Not used by check-in itself (that path needs same-transaction
   * atomicity with Visit creation, handled directly in
   * PrismaAppointmentRepository.checkIn()).
   */
  async ensureInvoiceHasItems(input: EnsureInvoiceHasItemsInput): Promise<Invoice> {
    const existing = await this.invoiceRepository.findByAppointmentId(input.appointmentId);
    if (existing) {
      return this.invoiceRepository.appendItems({ invoiceId: existing.id, items: input.items });
    }

    const subtotal = input.items.reduce((sum, item) => sum + item.amount, 0);
    let lastError: unknown;
    for (let attempt = 0; attempt < INVOICE_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        return await this.invoiceRepository.create({
          appointmentId: input.appointmentId,
          patientId: input.patientId,
          invoiceCode: InvoiceCode.generate().value,
          subtotal,
          discount: 0,
          total: subtotal,
          amountDue: subtotal,
          createdBy: input.createdBy,
          items: input.items,
        });
      } catch (error) {
        lastError = error;
        // A concurrent request may have created the invoice for this
        // appointment first (appointmentId is UNIQUE) — fall back to
        // appending instead of endlessly retrying on a conflict that isn't
        // actually about the invoiceCode.
        const raceWinner = await this.invoiceRepository.findByAppointmentId(input.appointmentId);
        if (raceWinner) {
          return this.invoiceRepository.appendItems({ invoiceId: raceWinner.id, items: input.items });
        }
      }
    }
    throw lastError;
  }
}
