import {
  CheckInAppointmentInput,
  CheckInAppointmentUseCase,
} from './check-in-appointment.use-case';
import {
  AppointmentNotConfirmedError,
  DoctorNotScheduledError,
} from '../../errors/application-error';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';
import { Invoice, InvoiceItem } from '../../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { Service } from '../../../domain/entities/service.entity';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { Visit } from '../../../domain/entities/visit.entity';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return new Appointment(
    overrides.id ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? 'doctor-1',
    overrides.serviceId ?? 'service-1',
    overrides.roomId ?? null,
    overrides.scheduleId ?? null,
    overrides.appointmentTime ?? nowAsClinicNaiveUtc(),
    overrides.status ?? AppointmentStatus.CONFIRMED,
    overrides.note ?? null,
    overrides.cancelReason ?? null,
    overrides.cancelledBy ?? null,
    overrides.cancelledAt ?? null,
    overrides.checkedInAt ?? null,
    overrides.bookedBy ?? 'receptionist-1',
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

function buildService(overrides: Partial<Service> = {}): Service {
  return new Service(
    overrides.id ?? 'service-1',
    overrides.serviceCode ?? 'SVC-001',
    overrides.name ?? 'Kham tong quat',
    overrides.specialtyId ?? null,
    overrides.type ?? ServiceType.EXAMINATION,
    overrides.clsCategory ?? null,
    overrides.price ?? 150000,
    overrides.description ?? null,
    overrides.isActive ?? true,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.deletedAt ?? null,
  );
}

function buildVisit(overrides: Partial<Visit> = {}): Visit {
  return new Visit(
    overrides.id ?? 'visit-1',
    overrides.appointmentId ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? 'doctor-1',
    overrides.roomId ?? 'room-1',
    overrides.queueNumber ?? 'P1-001',
    overrides.priority ?? VisitPriority.NORMAL,
    overrides.status ?? VisitStatus.WAITING,
    overrides.calledAt ?? null,
    overrides.calledCount ?? 0,
    overrides.startedAt ?? null,
    overrides.completedAt ?? null,
    overrides.createdAt ?? new Date(),
  );
}

function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const item = new InvoiceItem(
    'invoice-item-1',
    overrides.id ?? 'invoice-1',
    InvoiceItemType.SERVICE,
    'service-1',
    null,
    null,
    'Kham tong quat',
    150000,
    1,
    150000,
    null,
  );
  return new Invoice(
    overrides.id ?? 'invoice-1',
    overrides.appointmentId ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.invoiceCode ?? 'INV-20260819-0001',
    overrides.subtotal ?? 150000,
    overrides.discount ?? 0,
    overrides.total ?? 150000,
    overrides.amountDue ?? 150000,
    overrides.paymentStatus ?? ('UNPAID' as never),
    overrides.paymentMethod ?? null,
    overrides.paidAt ?? null,
    overrides.note ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.createdBy ?? 'receptionist-1',
    overrides.items ?? [item],
  );
}

function buildUseCase(options?: {
  appointment?: Appointment;
  service?: Service | null;
  invoiceResult?: Invoice | null;
  shift?: { id: string; userId: string; roomId: string | null } | null;
}) {
  const appointment = options?.appointment ?? buildAppointment();
  const service = options?.service === undefined ? buildService() : options.service;
  const visit = buildVisit();
  const invoiceResult = options?.invoiceResult === undefined ? buildInvoice() : options.invoiceResult;
  const shift = options?.shift === undefined ? { id: 'shift-1', userId: 'doctor-1', roomId: 'room-1' } : options.shift;

  const appointmentRepository = {
    findById: jest.fn().mockResolvedValue(appointment),
    checkIn: jest.fn().mockResolvedValue({ appointment, visit, invoice: invoiceResult }),
  };
  const patientRepository = {
    findById: jest.fn().mockResolvedValue({ fullName: 'Nguyen Van A', patientCode: 'PT-0001' }),
  };
  const userRepository = { findById: jest.fn().mockResolvedValue({ fullName: 'BS. Tran B' }) };
  const serviceRepository = { findById: jest.fn().mockResolvedValue(service) };
  const workScheduleRepository = {
    findCoveringShift: jest.fn().mockResolvedValue(shift),
  };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };
  const invoiceBilling = {
    buildExaminationItem: jest.fn((svc: Service) => ({
      itemType: InvoiceItemType.SERVICE,
      serviceRefId: svc.id,
      name: svc.name,
      unitPrice: svc.price,
      quantity: 1,
      amount: svc.price,
    })),
  };

  const useCase = new CheckInAppointmentUseCase(
    appointmentRepository as never,
    patientRepository as never,
    userRepository as never,
    serviceRepository as never,
    workScheduleRepository as never,
    auditLog as never,
    realtimePort as never,
    invoiceBilling as never,
  );

  return { useCase, appointmentRepository, serviceRepository, invoiceBilling, auditLog };
}

function buildInput(overrides: Partial<CheckInAppointmentInput> = {}): CheckInAppointmentInput {
  return {
    appointmentId: 'appointment-1',
    actorId: 'receptionist-1',
    ...overrides,
  };
}

describe('CheckInAppointmentUseCase', () => {
  it('creates the invoice with an exam-fee line at check-in (happy path)', async () => {
    const { useCase, appointmentRepository, invoiceBilling } = buildUseCase();

    const result = await useCase.execute(buildInput());

    expect(invoiceBilling.buildExaminationItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'service-1' }));
    expect(appointmentRepository.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({
          createdBy: 'receptionist-1',
          item: expect.objectContaining({ itemType: InvoiceItemType.SERVICE, amount: 150000 }),
        }),
      }),
    );
    expect(result.invoice).not.toBeNull();
    expect(result.invoice?.items[0].paidAt).toBeNull();
  });

  it('checks in without creating an invoice when the appointment has no service selected (alternative flow)', async () => {
    const appointment = buildAppointment({ serviceId: null });
    const { useCase, appointmentRepository, invoiceBilling } = buildUseCase({
      appointment,
      service: null,
      invoiceResult: null,
    });

    const result = await useCase.execute(buildInput());

    expect(invoiceBilling.buildExaminationItem).not.toHaveBeenCalled();
    expect(appointmentRepository.checkIn).toHaveBeenCalledWith(expect.objectContaining({ invoice: undefined }));
    expect(result.invoice).toBeNull();
  });

  it('rejects an appointment that is not CONFIRMED (alternative flow)', async () => {
    const appointment = buildAppointment({ status: AppointmentStatus.PENDING });
    const { useCase } = buildUseCase({ appointment });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(AppointmentNotConfirmedError);
  });

  it('rejects when the doctor has no shift covering the check-in moment (alternative flow)', async () => {
    const { useCase } = buildUseCase({ shift: null });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(DoctorNotScheduledError);
  });
});
