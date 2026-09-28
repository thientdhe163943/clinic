import { CallPatientToClsUseCase } from './call-patient-to-cls.use-case';
import { ClsFeeNotPaidError, ClsOrderNotPendingError, ClsRoomBusyError } from '../../errors/application-error';
import { ClsOrder } from '../../../domain/entities/cls-order.entity';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { InvoiceItem } from '../../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';

function buildOrder(overrides: Partial<ClsOrder> = {}): ClsOrder {
  return new ClsOrder(
    overrides.id ?? 'cls-order-1',
    overrides.visitId ?? 'visit-1',
    overrides.clsRoomId ?? 'cls-room-1',
    overrides.serviceId ?? 'cls-service-1',
    overrides.note ?? null,
    overrides.status ?? ClsOrderStatus.PENDING,
    overrides.calledAt ?? null,
    overrides.createdAt ?? new Date(),
    overrides.createdBy ?? 'doctor-1',
  );
}

function buildDetailItem(order: ClsOrder) {
  return {
    order,
    serviceName: 'Xet nghiem mau',
    clsRoomName: 'Phong xet nghiem',
    clsRoomCategory: null,
    patientName: 'Nguyen Van A',
    patientCode: 'PT-0001',
    dateOfBirth: null,
    gender: 'MALE',
    doctorName: 'BS. Tran B',
    appointmentTime: new Date(),
    resultSummary: null,
    resultAttachments: [],
    resultRows: null,
    resultFindings: null,
    resultEnteredBy: null,
  };
}

function buildClsFeeItem(paidAt: Date | null): InvoiceItem {
  return new InvoiceItem(
    'invoice-item-cls-1',
    'invoice-1',
    InvoiceItemType.CLS,
    null,
    'cls-order-1',
    null,
    'Xet nghiem mau',
    80000,
    1,
    80000,
    paidAt,
  );
}

function buildUseCase(options?: { order?: ClsOrder; clsItem?: InvoiceItem | null; inProgressCount?: number }) {
  const order = options?.order ?? buildOrder();
  const clsItem = options?.clsItem === undefined ? buildClsFeeItem(new Date()) : options.clsItem;

  const clsOrderRepository = {
    findWithDetailById: jest.fn().mockResolvedValue(buildDetailItem(order)),
    countInProgressByRoomExcludingVisit: jest.fn().mockResolvedValue(options?.inProgressCount ?? 0),
    updateStatus: jest.fn().mockResolvedValue({ ...order, status: ClsOrderStatus.IN_PROGRESS }),
  };
  const invoiceRepository = { findItemByClsRefId: jest.fn().mockResolvedValue(clsItem) };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };

  const useCase = new CallPatientToClsUseCase(
    clsOrderRepository as never,
    invoiceRepository as never,
    auditLog as never,
    realtimePort as never,
  );

  return { useCase, clsOrderRepository, invoiceRepository };
}

describe('CallPatientToClsUseCase', () => {
  it('calls the patient in once the CLS fee is paid (happy path)', async () => {
    const { useCase, clsOrderRepository } = buildUseCase({ clsItem: buildClsFeeItem(new Date()) });

    await useCase.execute('cls-order-1', 'lab-tech-1');

    expect(clsOrderRepository.updateStatus).toHaveBeenCalledWith('cls-order-1', ClsOrderStatus.IN_PROGRESS, expect.any(Date));
  });

  it('rejects calling the patient in when the CLS fee has not been paid (Gate #2, alternative flow)', async () => {
    const { useCase, clsOrderRepository } = buildUseCase({ clsItem: buildClsFeeItem(null) });

    await expect(useCase.execute('cls-order-1', 'lab-tech-1')).rejects.toBeInstanceOf(ClsFeeNotPaidError);
    expect(clsOrderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('allows calling in when no fee line was ever billed for this order (defensive fallback)', async () => {
    const { useCase, clsOrderRepository } = buildUseCase({ clsItem: null });

    await useCase.execute('cls-order-1', 'lab-tech-1');

    expect(clsOrderRepository.updateStatus).toHaveBeenCalled();
  });

  it('rejects an order that is not PENDING (alternative flow)', async () => {
    const { useCase } = buildUseCase({ order: buildOrder({ status: ClsOrderStatus.IN_PROGRESS }) });

    await expect(useCase.execute('cls-order-1', 'lab-tech-1')).rejects.toBeInstanceOf(ClsOrderNotPendingError);
  });

  it('rejects when the CLS room already has another patient IN_PROGRESS (alternative flow)', async () => {
    const { useCase } = buildUseCase({ inProgressCount: 1 });

    await expect(useCase.execute('cls-order-1', 'lab-tech-1')).rejects.toBeInstanceOf(ClsRoomBusyError);
  });
});
