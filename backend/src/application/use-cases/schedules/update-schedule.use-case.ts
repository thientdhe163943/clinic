import { Inject, Injectable } from '@nestjs/common';
import { UpdateScheduleRequestDto } from '../../dtos/schedules/update-schedule.dto';
import { ScheduleResponseDto, toScheduleResponse } from '../../dtos/schedules/schedule-response.dto';
import {
  ResourceNotFoundError,
  ScheduleConflictError,
  ScheduleRoomConflictError,
  SchedulePastDateError,
  ScheduleRoomInactiveError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  UpdateWorkScheduleData,
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';

export interface UpdateScheduleInput extends UpdateScheduleRequestDto {
  id: string;
  updatedBy: string;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class UpdateScheduleUseCase {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly scheduleRepository: WorkScheduleRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdateScheduleInput): Promise<ScheduleResponseDto> {
    const existing = await this.scheduleRepository.findById(input.id);
    if (!existing) throw new ResourceNotFoundError('Schedule', { id: input.id });

    const today = toDateOnly(new Date());

    // Business Rule: cannot edit a schedule that has already taken place.
    if (toDateOnly(existing.workDate) < today) throw new SchedulePastDateError();

    const user = await this.userRepository.findById(existing.userId);
    if (!user) throw new ResourceNotFoundError('User', { id: existing.userId });

    const room = await this.roomRepository.findById(input.roomId);
    if (!room) throw new ResourceNotFoundError('Room', { id: input.roomId });

    if (!room.isActive) throw new ScheduleRoomInactiveError();

    const workDate = toDateOnly(input.workDate);

    // Business Rule: new date being edited to must also not be in the past.
    if (workDate < today) throw new SchedulePastDateError();

    const conflict = await this.scheduleRepository.findConflict(existing.userId, workDate, input.shift, existing.id);
    if (conflict) throw new ScheduleConflictError(input.shift, workDate.toISOString().slice(0, 10));

    // Business Rule (A4, added 2026-07-08): same room-conflict check as create.
    const roomConflict = await this.scheduleRepository.findRoomConflict(
      input.roomId,
      workDate,
      input.shift,
      user.role,
      existing.id,
    );
    if (roomConflict) throw new ScheduleRoomConflictError(input.shift, workDate.toISOString().slice(0, 10));

    const updated = await this.scheduleRepository.update(input.id, {
      roomId: input.roomId,
      workDate,
      shift: input.shift,
      note: input.note,
      updatedBy: input.updatedBy,
    } as UpdateWorkScheduleData);

    await this.auditLog.write({
      userId: input.updatedBy,
      action: 'SCHEDULE_UPDATED',
      module: 'SCHEDULE',
      targetId: updated.id,
    });

    // Cheap extra query so the frontend can warn before a destructive edit
    // without a second round-trip.
    const hasLinkedAppointments = await this.scheduleRepository.hasLinkedAppointments(updated.id);

    return toScheduleResponse(updated, user.fullName, user.role, room.roomCode, room.name, hasLinkedAppointments);
  }
}
