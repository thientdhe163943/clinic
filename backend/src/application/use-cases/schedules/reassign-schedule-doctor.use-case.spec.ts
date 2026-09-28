import {
  ReassignScheduleDoctorInput,
  ReassignScheduleDoctorUseCase,
} from './reassign-schedule-doctor.use-case';
import {
  ResourceNotFoundError,
  ScheduleConflictError,
  ScheduleSubstituteNotDoctorError,
  ScheduleSubstituteSameDoctorError,
} from '../../errors/application-error';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { ShiftType } from '../../../domain/enums/shift-type.enum';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { WorkSchedule } from '../../../domain/entities/work-schedule.entity';

const WORK_DATE = new Date(Date.UTC(2999, 0, 15));

function buildSchedule(overrides: Partial<WorkSchedule> = {}): WorkSchedule {
  return new WorkSchedule(
    overrides.id ?? 'schedule-1',
    overrides.userId ?? 'doctor-original',
    overrides.roomId ?? 'room-1',
    overrides.workDate ?? WORK_DATE,
    overrides.shift ?? ShiftType.MORNING,
    overrides.note ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.createdBy ?? 'admin-1',
    overrides.updatedBy ?? null,
    overrides.isAbsent ?? false,
    overrides.absentNote ?? null,
    overrides.originalUserId ?? null,
  );
}

function buildDoctor(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'doctor-substitute',
    overrides.fullName ?? 'Bac Si B',
    overrides.email ?? 'doctor-b@example.com',
    overrides.phone ?? '0900000002',
    overrides.passwordHash ?? 'hash',
    overrides.role ?? UserRole.DOCTOR,
    overrides.isActive ?? true,
    overrides.mustChangePassword ?? false,
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
    overrides.doctorId ?? 'doctor-original',
    overrides.serviceId ?? null,
    overrides.roomId ?? null,
    overrides.scheduleId ?? 'schedule-1',
    overrides.appointmentTime ?? WORK_DATE,
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

function buildUseCase(overrides?: {
  schedule?: WorkSchedule;
  substitute?: User | null;
  conflict?: WorkSchedule | null;
  affectedAppointments?: Appointment[];
  reassigned?: WorkSchedule;
}) {
  const schedule = overrides?.schedule ?? buildSchedule();
  const substitute = overrides?.substitute === undefined ? buildDoctor() : overrides.substitute;
  const reassigned =
    overrides?.reassigned ?? buildSchedule({ ...schedule, userId: 'doctor-substitute', isAbsent: true });

  const scheduleRepository = {
    findById: jest.fn().mockResolvedValue(schedule),
    findConflict: jest.fn().mockResolvedValue(overrides?.conflict ?? null),
    reassignDoctor: jest.fn().mockResolvedValue(reassigned),
  };
  const userRepository = { findById: jest.fn().mockResolvedValue(substitute) };
  const roomRepository = { findById: jest.fn().mockResolvedValue(null) };
  const appointmentRepository = {
    findByScheduleId: jest.fn().mockResolvedValue(overrides?.affectedAppointments ?? [buildAppointment()]),
  };
  const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
  const realtimePort = { emit: jest.fn() };
  const updateAppointmentUseCase = { execute: jest.fn().mockResolvedValue(undefined) };

  const useCase = new ReassignScheduleDoctorUseCase(
    scheduleRepository as never,
    userRepository as never,
    roomRepository as never,
    appointmentRepository as never,
    auditLog as never,
    realtimePort as never,
    updateAppointmentUseCase as never,
  );

  return {
    useCase,
    scheduleRepository,
    userRepository,
    appointmentRepository,
    auditLog,
    realtimePort,
    updateAppointmentUseCase,
  };
}

function buildInput(overrides: Partial<ReassignScheduleDoctorInput> = {}): ReassignScheduleDoctorInput {
  return {
    scheduleId: 'schedule-1',
    substituteDoctorId: 'doctor-substitute',
    reason: 'Bác sĩ nghỉ đột xuất',
    actorId: 'admin-1',
    ...overrides,
  };
}

describe('ReassignScheduleDoctorUseCase', () => {
  it('reassigns the shift to the substitute doctor and moves every open appointment (happy path)', async () => {
    const appointment = buildAppointment({ id: 'appointment-1' });
    const { useCase, scheduleRepository, auditLog, realtimePort, updateAppointmentUseCase } = buildUseCase({
      affectedAppointments: [appointment],
    });

    const result = await useCase.execute(buildInput());

    expect(scheduleRepository.reassignDoctor).toHaveBeenCalledWith('schedule-1', {
      userId: 'doctor-substitute',
      originalUserId: 'doctor-original',
      absentNote: 'Bác sĩ nghỉ đột xuất',
      updatedBy: 'admin-1',
    });
    expect(updateAppointmentUseCase.execute).toHaveBeenCalledWith({
      appointmentId: 'appointment-1',
      actorId: 'admin-1',
      doctorId: 'doctor-substitute',
    });
    expect(result.affectedAppointmentIds).toEqual(['appointment-1']);
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCHEDULE_DOCTOR_REASSIGNED', targetId: 'schedule-1' }),
    );
    expect(realtimePort.emit).toHaveBeenCalledWith(
      'RECEPTIONIST',
      'schedule:doctor-reassigned',
      expect.objectContaining({ scheduleId: 'schedule-1', substituteDoctorId: 'doctor-substitute' }),
    );
    expect(realtimePort.emit).toHaveBeenCalledWith('doctor-substitute', 'schedule:doctor-reassigned', {
      scheduleId: 'schedule-1',
    });
  });

  it('keeps the very first originalUserId across a second reassignment instead of overwriting it', async () => {
    const schedule = buildSchedule({ userId: 'doctor-b', isAbsent: true, originalUserId: 'doctor-original' });
    const { useCase, scheduleRepository } = buildUseCase({
      schedule,
      affectedAppointments: [],
    });

    await useCase.execute(buildInput({ substituteDoctorId: 'doctor-substitute' }));

    expect(scheduleRepository.reassignDoctor).toHaveBeenCalledWith(
      'schedule-1',
      expect.objectContaining({ originalUserId: 'doctor-original' }),
    );
  });

  it('rejects a schedule that does not exist (alternative flow)', async () => {
    const { useCase, scheduleRepository } = buildUseCase({ schedule: undefined });
    scheduleRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('rejects a substitute that is not a doctor account (alternative flow)', async () => {
    const { useCase } = buildUseCase({ substitute: buildDoctor({ role: UserRole.NURSE }) });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ScheduleSubstituteNotDoctorError);
  });

  it('rejects reassigning to the same doctor already on the shift (alternative flow)', async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute(buildInput({ substituteDoctorId: 'doctor-original' }))).rejects.toBeInstanceOf(
      ScheduleSubstituteSameDoctorError,
    );
  });

  it('rejects a substitute already booked on a conflicting shift the same day (alternative flow)', async () => {
    const { useCase } = buildUseCase({ conflict: buildSchedule({ id: 'schedule-2' }) });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ScheduleConflictError);
  });
});
