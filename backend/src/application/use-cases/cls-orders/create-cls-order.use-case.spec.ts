import { CreateClsOrderInput, CreateClsOrderUseCase } from './create-cls-order.use-case';
import { ClsRoomNotActiveError, ClsRoomTypeError, VisitNotInProgressError } from '../../errors/application-error';
import { ClsOrder } from '../../../domain/entities/cls-order.entity';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { Room } from '../../../domain/entities/room.entity';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { Visit } from '../../../domain/entities/visit.entity';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';

function buildVisit(overrides: Partial<Visit> = {}): Visit {
  return new Visit(
    overrides.id ?? 'visit-1',
    overrides.appointmentId ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? 'doctor-1',
    overrides.roomId ?? 'room-exam-1',
    overrides.queueNumber ?? 'P1-001',
    overrides.priority ?? VisitPriority.NORMAL,
    overrides.status ?? VisitStatus.IN_PROGRESS,
    overrides.calledAt ?? null,
    overrides.calledCount ?? 0,
    overrides.startedAt ?? new Date(),
    overrides.completedAt ?? null,
    overrides.createdAt ?? new Date(),
  );
}

function buildClsRoom(overrides: Partial<Room> = {}): Room {
  return new Room(
    overrides.id ?? 'cls-room-1',
    overrides.roomCode ?? 'CLS-01',
    overrides.name ?? 'Phong xet nghiem',
    overrides.type ?? RoomType.CLS,
    overrides.description ?? null,
    overrides.techniqueType ?? null,
    overrides.clsCategory ?? null,
    overrides.specialtyId ?? null,
    overrides.isActive ?? true,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

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

function buildUseCase(options?: { visit?: Visit; clsRoom?: Room | null; existingInvoice?: unknown }) {
  const visit = options?.visit ?? buildVisit();
  const clsRoom = options?.clsRoom === undefined ? buildClsRoom() : options.clsRoom;
  const service = { id: 'cls-service-1', name: 'Xet nghiem mau', price: 80000, clsCategory: null };
  const order = buildOrder();

  const visitRepository = { findById: jest.fn().mockResolvedValue(visit) };
  const clsOrderRepository = { create: jest.fn().mockResolvedValue(order) };
  const roomRepository = { findById: jest.fn().mockResolvedValue(clsRoom) };
  const serviceRepository = { findById: jest.fn().mockResolvedValue(service) };
  const patientRepository = { findById: jest.fn().mockResolvedValue({ fullName: 'Nguyen Van A', patientCode: 'PT-0001' }) };
  const userRepository = { findById: jest.fn().mockResolvedValue({ fullName: 'BS. Tran B' }) };
  const appointmentRepository = { findById: jest.fn().mockResolvedValue({ id: 'appointment-1', appointmentTime: new Date() }) };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };
  const invoiceBilling = {
    buildClsItem: jest.fn((params: { clsOrderId: string; serviceName: string; unitPrice: number }) => ({
      itemType: InvoiceItemType.CLS,
      clsRefId: params.clsOrderId,
      name: params.serviceName,
      unitPrice: params.unitPrice,
      quantity: 1,
      amount: params.unitPrice,
    })),
    ensureInvoiceHasItems: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
  };

  const useCase = new CreateClsOrderUseCase(
    visitRepository as never,
    clsOrderRepository as never,
    roomRepository as never,
    serviceRepository as never,
    patientRepository as never,
    userRepository as never,
    appointmentRepository as never,
    auditLog as never,
    realtimePort as never,
    invoiceBilling as never,
  );

  return { useCase, clsOrderRepository, invoiceBilling, realtimePort, order };
}

function buildInput(overrides: Partial<CreateClsOrderInput> = {}): CreateClsOrderInput {
  return {
    visitId: 'visit-1',
    clsRoomId: 'cls-room-1',
    serviceId: 'cls-service-1',
    actorId: 'doctor-1',
    ...overrides,
  };
}

describe('CreateClsOrderUseCase', () => {
  it('creates the CLS order and bills its fee onto the appointment invoice (happy path)', async () => {
    const { useCase, invoiceBilling, realtimePort } = buildUseCase();

    await useCase.execute(buildInput());

    expect(invoiceBilling.buildClsItem).toHaveBeenCalledWith({
      clsOrderId: 'cls-order-1',
      serviceName: 'Xet nghiem mau',
      unitPrice: 80000,
    });
    expect(invoiceBilling.ensureInvoiceHasItems).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 'appointment-1', patientId: 'patient-1' }),
    );
    expect(realtimePort.emit).toHaveBeenCalledWith(
      ['RECEPTIONIST', 'ADMIN'],
      'invoice:changed',
      expect.objectContaining({ invoiceId: 'invoice-1' }),
    );
  });

  it('rejects when the visit is not IN_PROGRESS (alternative flow)', async () => {
    const { useCase } = buildUseCase({ visit: buildVisit({ status: VisitStatus.WAITING }) });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(VisitNotInProgressError);
  });

  it('rejects a room that is not type CLS (alternative flow)', async () => {
    const { useCase } = buildUseCase({ clsRoom: buildClsRoom({ type: RoomType.EXAMINATION }) });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ClsRoomTypeError);
  });

  it('rejects an inactive CLS room (alternative flow)', async () => {
    const { useCase } = buildUseCase({ clsRoom: buildClsRoom({ isActive: false }) });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ClsRoomNotActiveError);
  });
});
