import { Inject, Injectable } from '@nestjs/common';
import { CreateScheduleRequestDto } from '../../dtos/schedules/create-schedule.dto';
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
  CreateWorkScheduleData,
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';

export interface CreateScheduleInput extends CreateScheduleRequestDto {
  createdBy: string;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class CreateScheduleUseCase {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly scheduleRepository: WorkScheduleRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: CreateScheduleInput): Promise<ScheduleResponseDto> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new ResourceNotFoundError('User', { id: input.userId });

    const room = await this.roomRepository.findById(input.roomId);
    if (!room) throw new ResourceNotFoundError('Room', { id: input.roomId });

    // Business Rule (A2): room must be Active.
    if (!room.isActive) throw new ScheduleRoomInactiveError();

    const workDate = toDateOnly(input.workDate);
    const today = toDateOnly(new Date());

    // Business Rule (A3): cannot create a schedule for a past date.
    if (workDate < today) throw new SchedulePastDateError();

    // Business Rule (A1): same user cannot have two shifts on the same date+shift.
    const conflict = await this.scheduleRepository.findConflict(input.userId, workDate, input.shift);
    if (conflict) throw new ScheduleConflictError(input.shift, workDate.toISOString().slice(0, 10));

    // Business Rule (A4, added 2026-07-08): a room can only be assigned to
    // one staff member per date+shift — a physical room can't serve two
    // people at once.
    const roomConflict = await this.scheduleRepository.findRoomConflict(input.roomId, workDate, input.shift, user.role);
    if (roomConflict) throw new ScheduleRoomConflictError(input.shift, workDate.toISOString().slice(0, 10));

    const schedule = await this.scheduleRepository.create({
      userId: input.userId,
      roomId: input.roomId,
      workDate,
      shift: input.shift,
      note: input.note,
      createdBy: input.createdBy,
    } as CreateWorkScheduleData);

    await this.auditLog.write({
      userId: input.createdBy,
      action: 'SCHEDULE_CREATED',
      module: 'SCHEDULE',
      targetId: schedule.id,
    });

    return toScheduleResponse(schedule, user.fullName, user.role, room.roomCode, room.name);
  }
}
