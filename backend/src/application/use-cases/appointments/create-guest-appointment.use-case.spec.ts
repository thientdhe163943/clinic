import { CreateGuestAppointmentUseCase } from './create-guest-appointment.use-case';
import { CreateGuestAppointmentRequestDto } from '../../dtos/appointments/create-guest-appointment.dto';
import { TooManyPendingAppointmentsError } from '../../errors/application-error';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { Patient } from '../../../domain/entities/patient.entity';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { Gender } from '../../../domain/enums/gender.enum';

// See create-appointment.use-case.spec.ts for why this fixed future,
// slot-aligned, lunch-break-safe time is used across these tests.
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
    overrides.userId ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'user-1',
    overrides.fullName ?? 'Nguyen Van A',
    overrides.email ?? null,
    overrides.phone ?? '0900000000',
    overrides.passwordHash ?? 'hash',
    overrides.role ?? UserRole.PATIENT,
    overrides.isActive ?? true,
    overrides.mustChangePassword ?? true,
    overrides.failedLoginCount ?? 0,
    overrides.lockedAt ?? null,
    overrides.lastLoginAt ?? null,
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

function buildInput(overrides: Partial<CreateGuestAppointmentRequestDto> = {}): CreateGuestAppointmentRequestDto {
  return {
    fullName: 'Nguyen Van A',
    phone: '0900000000',
    dateOfBirth: '1990-01-01',
    appointmentTime: FUTURE_APPOINTMENT_TIME,
    ...overrides,
  } as CreateGuestAppointmentRequestDto;
}

function buildUseCase(overrides?: {
  existingPatient?: Patient | null;
  assertPendingLimitNotExceeded?: jest.Mock;
  createdUser?: User;
  createdAppointment?: Appointment;
}) {
  const patient = overrides?.createdAppointment ? undefined : buildPatient({ id: 'patient-1' });
  const createdUser = overrides?.createdUser ?? buildUser();
  const createdAppointment = overrides?.createdAppointment ?? buildAppointment();

  const userRepository = {
    findByEmail: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findByIdCard: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    create: jest.fn().mockResolvedValue(createdUser),
  };
  const patientRepository = {
    findByPhone: jest.fn().mockResolvedValue(overrides?.existingPatient ?? null),
    findByIdCard: jest.fn().mockResolvedValue(null),
    linkUser: jest.fn().mockResolvedValue(overrides?.existingPatient ?? patient),
    create: jest.fn().mockResolvedValue(patient ?? buildPatient()),
    findById: jest.fn().mockResolvedValue(patient ?? buildPatient()),
  };
  const serviceRepository = { findById: jest.fn() };
  const workScheduleRepository = { findCoveringShift: jest.fn() };
  const appointmentRepository = {
    findConflict: jest.fn().mockResolvedValue(null),
    findDoctorConflict: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(createdAppointment),
    addHistory: jest.fn().mockResolvedValue(undefined),
  };
  const refreshTokenRepository = { create: jest.fn().mockResolvedValue(undefined) };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };
  const appointmentTrustService = {
    assertPendingLimitNotExceeded: overrides?.assertPendingLimitNotExceeded ?? jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('access-token') };
  const configService = { get: jest.fn().mockReturnValue(undefined) };

  const useCase = new CreateGuestAppointmentUseCase(
    userRepository as never,
    patientRepository as never,
    serviceRepository as never,
    workScheduleRepository as never,
    appointmentRepository as never,
    refreshTokenRepository as never,
    auditLog as never,
    realtimePort as never,
    appointmentTrustService as never,
    jwtService as never,
    configService as never,
  );

  return { useCase, userRepository, patientRepository, appointmentRepository, appointmentTrustService };
}

describe('CreateGuestAppointmentUseCase', () => {
  it('creates a new guest account + PENDING appointment (happy path, brand-new patient)', async () => {
    const { useCase, userRepository, appointmentRepository, appointmentTrustService } = buildUseCase();

    const result = await useCase.execute({ ...buildInput() });

    expect(result.appointment.status).toBe(AppointmentStatus.PENDING);
    expect(userRepository.create).toHaveBeenCalled();
    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: AppointmentStatus.PENDING }),
    );
    // A brand-new phone number has no existing patient record, so the
    // pending-limit check is trivially skipped (0 by construction).
    expect(appointmentTrustService.assertPendingLimitNotExceeded).not.toHaveBeenCalled();
  });

  it('rejects a returning guest already at the pending-appointment limit before creating any account (alternative flow #2)', async () => {
    const existingPatient = buildPatient({ id: 'patient-existing', userId: null });
    const { useCase, userRepository, appointmentRepository, appointmentTrustService } = buildUseCase({
      existingPatient,
      assertPendingLimitNotExceeded: jest.fn().mockRejectedValue(new TooManyPendingAppointmentsError(3, 3)),
    });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(TooManyPendingAppointmentsError);

    expect(appointmentTrustService.assertPendingLimitNotExceeded).toHaveBeenCalledWith('patient-existing');
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });
});
