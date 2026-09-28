import { Inject, Injectable } from '@nestjs/common';
import { ReassignScheduleDoctorRequestDto } from '../../dtos/schedules/reassign-schedule-doctor.dto';
import { ScheduleResponseDto, toScheduleResponse } from '../../dtos/schedules/schedule-response.dto';
import {
  ResourceNotFoundError,
  ScheduleConflictError,
  ScheduleSubstituteNotDoctorError,
  ScheduleSubstituteSameDoctorError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { WORK_SCHEDULE_REPOSITORY, WorkScheduleRepository } from '../../../domain/repositories/work-schedule.repository';
import { UpdateAppointmentUseCase } from '../appointments/update-appointment.use-case';

// Only these two statuses are "still actionable" — mirrors
// UpdateAppointmentUseCase's own ALLOWED_STATUSES, since every affected
// appointment gets routed straight through that use case's execute().
const REASSIGNABLE_STATUSES = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

export interface ReassignScheduleDoctorInput extends ReassignScheduleDoctorRequestDto {
  scheduleId: string;
  actorId: string;
}

export interface ReassignScheduleDoctorResult extends ScheduleResponseDto {
  affectedAppointmentIds: string[];
}

/**
 * Version-up 0.2 Phase 2 #9 (Tình huống B) — ADMIN-driven flow for a doctor
 * absent for a whole shift: swaps the substitute doctor onto the existing
 * WorkSchedule row in place (no second row — see schema.prisma comment on
 * WorkSchedule) and moves every still-open appointment tied to that shift
 * over to the substitute by delegating to UpdateAppointmentUseCase, which
 * already re-validates the substitute's own slot conflicts and records
 * AppointmentHistory.
 */
@Injectable()
export class ReassignScheduleDoctorUseCase {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly scheduleRepository: WorkScheduleRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly updateAppointmentUseCase: UpdateAppointmentUseCase,
  ) {}

  async execute(input: ReassignScheduleDoctorInput): Promise<ReassignScheduleDoctorResult> {
    const existing = await this.scheduleRepository.findById(input.scheduleId);
    if (!existing) throw new ResourceNotFoundError('Schedule', { id: input.scheduleId });

    // Business Rule: reassigning to the same doctor already on the shift is
    // a meaningless no-op (and would falsely flag the shift as "absent").
    if (input.substituteDoctorId === existing.userId) throw new ScheduleSubstituteSameDoctorError();

    const substitute = await this.userRepository.findById(input.substituteDoctorId);
    if (!substitute) throw new ResourceNotFoundError('Doctor', { id: input.substituteDoctorId });

    // Business Rule: the substitute must actually be a doctor account.
    if (substitute.role !== UserRole.DOCTOR) throw new ScheduleSubstituteNotDoctorError();

    // Business Rule: substitute must not already be working a conflicting
    // shift the same day (mirrors update-schedule.use-case.ts:60).
    const conflict = await this.scheduleRepository.findConflict(
      input.substituteDoctorId,
      existing.workDate,
      existing.shift,
    );
    if (conflict) throw new ScheduleConflictError(existing.shift, existing.workDate.toISOString().slice(0, 10));

    const originalDoctorId = existing.userId;
    // Only ever set on the *first* reassignment — a later reassignment must
    // not overwrite it with whoever was standing in most recently.
    const originalUserId = existing.originalUserId ?? existing.userId;

    const updated = await this.scheduleRepository.reassignDoctor(existing.id, {
      userId: input.substituteDoctorId,
      originalUserId,
      absentNote: input.reason,
      updatedBy: input.actorId,
    });

    const affected = await this.appointmentRepository.findByScheduleId(existing.id, REASSIGNABLE_STATUSES);

    const affectedAppointmentIds: string[] = [];
    for (const appointment of affected) {
      await this.updateAppointmentUseCase.execute({
        appointmentId: appointment.id,
        actorId: input.actorId,
        doctorId: input.substituteDoctorId,
      });
      affectedAppointmentIds.push(appointment.id);
    }

    await this.auditLog.write({
      userId: input.actorId,
      action: 'SCHEDULE_DOCTOR_REASSIGNED',
      module: 'SCHEDULE',
      targetId: existing.id,
      detail: {
        originalDoctorId,
        substituteDoctorId: input.substituteDoctorId,
        reason: input.reason,
        affectedAppointmentIds,
      },
    });

    try {
      this.realtimePort.emit('RECEPTIONIST', 'schedule:doctor-reassigned', {
        scheduleId: existing.id,
        originalDoctorId,
        substituteDoctorId: input.substituteDoctorId,
        affectedAppointmentIds,
        reason: input.reason,
      });
      this.realtimePort.emit(input.substituteDoctorId, 'schedule:doctor-reassigned', { scheduleId: existing.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    const room = updated.roomId ? await this.roomRepository.findById(updated.roomId) : null;

    return {
      ...toScheduleResponse(updated, substitute.fullName, substitute.role, room?.roomCode ?? null, room?.name ?? null),
      affectedAppointmentIds,
    };
  }
}
