import { StartVisitUseCase } from './start-visit.use-case';
import { ExaminationFeeNotPaidError, RoomBusyError, VisitNotStartableError } from '../../errors/application-error';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { Invoice, InvoiceItem } from '../../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { Visit } from '../../../domain/entities/visit.entity';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';

function buildVisit(overrides: Partial<Visit> = {}): Visit {
  return new Visit(
    overrides.id ?? 'visit-1',
    overrides.appointmentId ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? 'doctor-1',
    overrides.roomId ?? 'room-1',
    overrides.queueNumber ?? 'P1-001',
    overrides.priority ?? VisitPriority.NORMAL,
    overrides.status ?? VisitStatus.CALLED,
    overrides.calledAt ?? new Date(),
    overrides.calledCount ?? 1,
    overrides.startedAt ?? null,
    overrides.completedAt ?? null,
    overrides.createdAt ?? new Date(),
  );
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return new Appointment(
    overrides.id ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? 'doctor-1',
    overrides.serviceId ?? 'service-1',
    overrides.roomId ?? 'room-1',
    overrides.scheduleId ?? null,
    overrides.appointmentTime ?? new Date(),
    overrides.status ?? AppointmentStatus.CHECKED_IN,
    overrides.note ?? null,
    overrides.cancelReason ?? null,
    overrides.cancelledBy ?? null,
    overrides.cancelledAt ?? null,
    overrides.checkedInAt ?? new Date(),
    overrides.bookedBy ?? 'receptionist-1',
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

function buildInvoice(items: InvoiceItem[]): Invoice {
  return new Invoice(
    'invoice-1',
    'appointment-1',
    'patient-1',
    'INV-20260819-0001',
    150000,
    0,
    150000,
    150000,
    'UNPAID' as never,
    null,
    null,
    null,
    new Date(),
    new Date(),
    'receptionist-1',
    items,
  );
}

function buildExamItem(paidAt: Date | null): InvoiceItem {
  return new InvoiceItem(
    'item-service-1',
    'invoice-1',
    InvoiceItemType.SERVICE,
    'service-1',
    null,
    null,
    'Kham tong quat',
    150000,
    1,
    150000,
    paidAt,
  );
}

function buildUseCase(options?: { visit?: Visit; invoice?: Invoice | null; inProgressCount?: number }) {
  const visit = options?.visit ?? buildVisit();
  const invoice = options?.invoice === undefined ? buildInvoice([buildExamItem(new Date())]) : options.invoice;

  const visitRepository = {
    findById: jest.fn().mockResolvedValue(visit),
    countInProgressByRoom: jest.fn().mockResolvedValue(options?.inProgressCount ?? 0),
    startVisit: jest.fn().mockResolvedValue({ ...visit, status: VisitStatus.IN_PROGRESS }),
  };
  const patientRepository = { findById: jest.fn().mockResolvedValue({ fullName: 'Nguyen Van A', patientCode: 'PT-0001' }) };
  const userRepository = { findById: jest.fn().mockResolvedValue({ fullName: 'BS. Tran B' }) };
  const serviceRepository = { findById: jest.fn().mockResolvedValue({ name: 'Kham tong quat' }) };
  const appointmentRepository = {
    findById: jest.fn().mockResolvedValue(buildAppointment()),
    updateStatus: jest.fn().mockResolvedValue(undefined),
  };
  const invoiceRepository = { findByAppointmentId: jest.fn().mockResolvedValue(invoice) };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };

  const useCase = new StartVisitUseCase(
    visitRepository as never,
    patientRepository as never,
    userRepository as never,
    serviceRepository as never,
    appointmentRepository as never,
    invoiceRepository as never,
    auditLog as never,
    realtimePort as never,
  );

  return { useCase, visitRepository, invoiceRepository };
}

describe('StartVisitUseCase', () => {
  it('starts the visit once the exam fee is paid (happy path)', async () => {
    const { useCase, visitRepository } = buildUseCase({
      invoice: buildInvoice([buildExamItem(new Date())]),
    });

    await useCase.execute('visit-1', 'doctor-1');

    expect(visitRepository.startVisit).toHaveBeenCalledWith('visit-1', expect.any(Date));
  });

  it('rejects starting the visit when the exam fee has not been paid (Gate #1, alternative flow)', async () => {
    const { useCase, visitRepository } = buildUseCase({
      invoice: buildInvoice([buildExamItem(null)]),
    });

    await expect(useCase.execute('visit-1', 'doctor-1')).rejects.toBeInstanceOf(ExaminationFeeNotPaidError);
    expect(visitRepository.startVisit).not.toHaveBeenCalled();
  });

  it('allows starting when there is no exam-fee line at all (appointment had no service selected)', async () => {
    const { useCase, visitRepository } = buildUseCase({ invoice: buildInvoice([]) });

    await useCase.execute('visit-1', 'doctor-1');

    expect(visitRepository.startVisit).toHaveBeenCalled();
  });

  it('allows starting when the appointment never got an invoice at all (legacy data)', async () => {
    const { useCase, visitRepository } = buildUseCase({ invoice: null });

    await useCase.execute('visit-1', 'doctor-1');

    expect(visitRepository.startVisit).toHaveBeenCalled();
  });

  it('rejects a visit not in a startable status (alternative flow)', async () => {
    const { useCase } = buildUseCase({ visit: buildVisit({ status: VisitStatus.WAITING }) });

    await expect(useCase.execute('visit-1', 'doctor-1')).rejects.toBeInstanceOf(VisitNotStartableError);
  });

  it('rejects when the room already has another IN_PROGRESS visit (alternative flow)', async () => {
    const { useCase } = buildUseCase({ inProgressCount: 1 });

    await expect(useCase.execute('visit-1', 'doctor-1')).rejects.toBeInstanceOf(RoomBusyError);
  });
});
