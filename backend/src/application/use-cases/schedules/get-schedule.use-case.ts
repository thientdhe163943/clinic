import { Inject, Injectable } from '@nestjs/common';
import { ScheduleResponseDto, toScheduleResponse } from '../../dtos/schedules/schedule-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { WORK_SCHEDULE_REPOSITORY, WorkScheduleRepository } from '../../../domain/repositories/work-schedule.repository';

@Injectable()
export class GetScheduleUseCase {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly scheduleRepository: WorkScheduleRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
  ) {}

  async execute(id: string): Promise<ScheduleResponseDto> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) throw new ResourceNotFoundError('Schedule', { id });

    const user = await this.userRepository.findById(schedule.userId);
    const room = schedule.roomId ? await this.roomRepository.findById(schedule.roomId) : null;
    const linkedAppointments = await this.scheduleRepository.findLinkedAppointments(id);

    return toScheduleResponse(
      schedule,
      user?.fullName ?? '',
      user?.role ?? '',
      room?.roomCode ?? null,
      room?.name ?? null,
      linkedAppointments.length > 0,
      linkedAppointments,
    );
  }
}
