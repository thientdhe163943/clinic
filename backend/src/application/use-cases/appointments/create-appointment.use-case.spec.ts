import { CreateAppointmentUseCase, CreateAppointmentInput } from './create-appointment.use-case';
import { TooManyPendingAppointmentsError } from '../../errors/application-error';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { Patient } from '../../../domain/entities/patient.entity';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { Gender } from '../../../domain/enums/gender.enum';

// A fixed future date, far enough ahead to never be "in the past" relative
// to whenever this test runs, on a slot-aligned (20-minute grid) morning
// time outside the clinic's lunch break — mirrors the doctor-less "Đặt lịch
// nhanh" path so no WorkScheduleRepository mocking is needed.
const FUTURE_APPOINTMENT_TIME = new Date(Date.UTC(2999, 0, 15, 9, 0, 0, 0));

function buildPatient(overrides: Partial<Patient> = {}): Patient {
  return new Patient(
    overrides.id ?? 'patient-1',
    overrides.patientCode ?? 'PT000001',
    overrides.fullName ?? 'Nguyen Van A',
    overrides.email ?? null,
    overrides.dateOfBirth ?? new Date('1990-01-01'),
    overrides.gender ?? Gender.MALE,
    overrides.phone ?? '0900000000',
    overrides.idCard ?? '000000000000',
    overrides.address ?? null,
    overrides.note ?? null,
    overrides.notificationConsent ?? true,
    overrides.userId ?? 'user-1',
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return new Appointment(
    overrides.id ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? null,
    overrides.serviceId ?? null,
    overrides.roomId ?? null,
    overrides.scheduleId ?? null,
    overrides.appointmentTime ?? FUTURE_APPOINTMENT_TIME,
    overrides.status ?? AppointmentStatus.PENDING,
    overrides.note ?? null,
    overrides.cancelReason ?? null,
    overrides.cancelledBy ?? null,
    overrides.cancelledAt ?? null,
    overrides.checkedInAt ?? null,
    overrides.bookedBy ?? 'user-1',
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

function buildUseCase(overrides?: {
  patient?: Patient;
  assertPendingLimitNotExceeded?: jest.Mock;
  hasExcessiveNoShows?: jest.Mock;
  createdAppointment?: Appointment;
}) {
  const patient = overrides?.patient ?? buildPatient();
  const createdAppointment = overrides?.createdAppointment ?? buildAppointment();

  const appointmentRepository = {
    findConflict: jest.fn().mockResolvedValue(null),
    findDoctorConflict: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(createdAppointment),
    addHistory: jest.fn().mockResolvedValue(undefined),
  };
  const patientRepository = {
    findByUserId: jest.fn().mockResolvedValue(patient),
    findById: jest.fn().mockResolvedValue(patient),
  };
  const userRepository = { findById: jest.fn() };
  const serviceRepository = { findById: jest.fn() };
  const workScheduleRepository = { findCoveringShift: jest.fn() };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };
  const appointmentTrustService = {
    assertPendingLimitNotExceeded: overrides?.assertPendingLimitNotExceeded ?? jest.fn().mockResolvedValue(undefined),
    hasExcessiveNoShows: overrides?.hasExcessiveNoShows ?? jest.fn().mockResolvedValue(false),
  };

  const useCase = new CreateAppointmentUseCase(
    appointmentRepository as never,
    patientRepository as never,
    userRepository as never,
    serviceRepository as never,
    workScheduleRepository as never,
    auditLog as never,
    realtimePort as never,
    appointmentTrustService as never,
  );

  return {
    useCase,
    appointmentRepository,
    patientRepository,
    appointmentTrustService,
    realtimePort,
  };
}

function buildInput(overrides: Partial<CreateAppointmentInput> = {}): CreateAppointmentInput {
  return {
    appointmentTime: FUTURE_APPOINTMENT_TIME,
    bookedBy: 'user-1',
    bookedByRole: UserRole.PATIENT,
    ...overrides,
  } as CreateAppointmentInput;
}

describe('CreateAppointmentUseCase', () => {
  it('books a doctor-less appointment for a self-booking patient as PENDING (happy path)', async () => {
    const { useCase, appointmentRepository, appointmentTrustService } = buildUseCase();

    const result = await useCase.execute(buildInput());

    expect(result.status).toBe(AppointmentStatus.PENDING);
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: AppointmentStatus.PENDING, patientId: 'patient-1' }),
    );
    expect(appointmentTrustService.assertPendingLimitNotExceeded).toHaveBeenCalledWith('patient-1');
    // Patient self-bookings never reach CONFIRMED, so the no-show check is
    // never even asked (short-circuited by the `status === CONFIRMED` guard).
    expect(appointmentTrustService.hasExcessiveNoShows).not.toHaveBeenCalled();
  });

  it('rejects booking when the patient already holds too many pending appointments (alternative flow #2)', async () => {
    const { useCase, appointmentRepository, appointmentTrustService } = buildUseCase({
      assertPendingLimitNotExceeded: jest.fn().mockRejectedValue(new TooManyPendingAppointmentsError(3, 3)),
    });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(TooManyPendingAppointmentsError);
    expect(appointmentRepository.create).not.toHaveBeenCalled();
    expect(appointmentTrustService.assertPendingLimitNotExceeded).toHaveBeenCalled();
  });

  it('withholds auto-CONFIRMED for a receptionist booking when the patient has excessive recent no-shows (alternative flow #4)', async () => {
    const createdAppointment = buildAppointment({ status: AppointmentStatus.PENDING });
    const { useCase, appointmentRepository, appointmentTrustService } = buildUseCase({
      hasExcessiveNoShows: jest.fn().mockResolvedValue(true),
      createdAppointment,
    });

    await useCase.execute(
      buildInput({ bookedByRole: UserRole.RECEPTIONIST, patientId: 'patient-1', bookedBy: 'receptionist-1' }),
    );

    expect(appointmentTrustService.hasExcessiveNoShows).toHaveBeenCalledWith('patient-1');
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: AppointmentStatus.PENDING }),
    );
  });

  it('auto-CONFIRMS a receptionist booking when the patient has no excessive no-shows', async () => {
    const createdAppointment = buildAppointment({ status: AppointmentStatus.CONFIRMED });
    const { useCase, appointmentRepository } = buildUseCase({ createdAppointment });

    await useCase.execute(
      buildInput({ bookedByRole: UserRole.RECEPTIONIST, patientId: 'patient-1', bookedBy: 'receptionist-1' }),
    );

    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: AppointmentStatus.CONFIRMED }),
    );
  });
});
