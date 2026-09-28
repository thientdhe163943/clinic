import { PayInvoiceInput, PayInvoiceUseCase } from './pay-invoice.use-case';
import { InvalidPayInvoiceItemsError, InvoiceAlreadyPaidError, ResourceNotFoundError } from '../../errors/application-error';
import { Invoice, InvoiceItem } from '../../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';

function buildItem(overrides: Partial<InvoiceItem> & { id: string; itemType?: InvoiceItemType }): InvoiceItem {
  return new InvoiceItem(
    overrides.id,
    overrides.invoiceId ?? 'invoice-1',
    overrides.itemType ?? InvoiceItemType.SERVICE,
    overrides.serviceRefId ?? null,
    overrides.clsRefId ?? null,
    overrides.medicineRefId ?? null,
    overrides.name ?? 'Kham tong quat',
    overrides.unitPrice ?? 150000,
    overrides.quantity ?? 1,
    overrides.amount ?? 150000,
    overrides.paidAt ?? null,
  );
}

function buildInvoice(items: InvoiceItem[], overrides: Partial<Invoice> = {}): Invoice {
  return new Invoice(
    overrides.id ?? 'invoice-1',
    overrides.appointmentId ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.invoiceCode ?? 'INV-20260819-0001',
    overrides.subtotal ?? items.reduce((sum, i) => sum + i.amount, 0),
    overrides.discount ?? 0,
    overrides.total ?? items.reduce((sum, i) => sum + i.amount, 0),
    overrides.amountDue ?? items.reduce((sum, i) => sum + i.amount, 0),
    overrides.paymentStatus ?? PaymentStatus.UNPAID,
    overrides.paymentMethod ?? null,
    overrides.paidAt ?? null,
    overrides.note ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.createdBy ?? 'receptionist-1',
    items,
  );
}

function buildUseCase(options?: { invoice?: Invoice | null; payResult?: Invoice }) {
  const examItem = buildItem({ id: 'item-service-1' });
  const clsItem = buildItem({ id: 'item-cls-1', itemType: InvoiceItemType.CLS, name: 'Xet nghiem mau', unitPrice: 80000, amount: 80000 });
  const invoice = options?.invoice === undefined ? buildInvoice([examItem, clsItem]) : options.invoice;
  const payResult =
    options?.payResult ??
    buildInvoice([{ ...examItem, paidAt: new Date() } as InvoiceItem, clsItem], {
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      amountDue: 80000,
    });

  const invoiceRepository = {
    findById: jest.fn().mockResolvedValue(invoice),
    payItems: jest.fn().mockResolvedValue(payResult),
  };
  const patientRepository = { findById: jest.fn().mockResolvedValue({ fullName: 'Nguyen Van A', patientCode: 'PT-0001' }) };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };

  const useCase = new PayInvoiceUseCase(
    invoiceRepository as never,
    patientRepository as never,
    auditLog as never,
    realtimePort as never,
  );

  return { useCase, invoiceRepository, examItem, clsItem };
}

function buildInput(overrides: Partial<PayInvoiceInput> = {}): PayInvoiceInput {
  return {
    invoiceId: 'invoice-1',
    actorId: 'receptionist-1',
    paymentMethod: PaymentMethod.CASH,
    ...overrides,
  };
}

describe('PayInvoiceUseCase', () => {
  it('pays only the requested items, leaving the rest outstanding (happy path — staged payment)', async () => {
    const { useCase, invoiceRepository, examItem } = buildUseCase();

    await useCase.execute(buildInput({ itemIds: [examItem.id] }));

    expect(invoiceRepository.payItems).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'invoice-1',
        itemIds: [examItem.id],
        amount: 150000,
        method: PaymentMethod.CASH,
      }),
    );
  });

  it('pays every currently-unpaid item when itemIds is omitted (backward-compatible "pay it all" flow)', async () => {
    const { useCase, invoiceRepository, examItem, clsItem } = buildUseCase();

    await useCase.execute(buildInput());

    expect(invoiceRepository.payItems).toHaveBeenCalledWith(
      expect.objectContaining({ itemIds: expect.arrayContaining([examItem.id, clsItem.id]) }),
    );
  });

  it('rejects itemIds that do not belong to this invoice or are already paid (alternative flow)', async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute(buildInput({ itemIds: ['not-a-real-item'] }))).rejects.toBeInstanceOf(
      InvalidPayInvoiceItemsError,
    );
  });

  it('rejects paying an invoice that is already fully PAID (alternative flow)', async () => {
    const paidItem = buildItem({ id: 'item-service-1', paidAt: new Date() });
    const { useCase } = buildUseCase({
      invoice: buildInvoice([paidItem], { paymentStatus: PaymentStatus.PAID, amountDue: 0 }),
    });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(InvoiceAlreadyPaidError);
  });

  it('rejects a non-existent invoice (alternative flow)', async () => {
    const { useCase } = buildUseCase({ invoice: null });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
