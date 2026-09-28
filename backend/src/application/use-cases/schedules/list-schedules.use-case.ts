import { Inject, Injectable } from '@nestjs/common';
import { ListSchedulesQueryDto } from '../../dtos/schedules/list-schedules-query.dto';
import { ScheduleResponseDto, toScheduleResponse } from '../../dtos/schedules/schedule-response.dto';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { WORK_SCHEDULE_REPOSITORY, WorkScheduleRepository } from '../../../domain/repositories/work-schedule.repository';

export interface ListSchedulesInput extends ListSchedulesQueryDto {
  actorId: string;
  actorRole: UserRole;
}

@Injectable()
export class ListSchedulesUseCase {
  constructor(@Inject(WORK_SCHEDULE_REPOSITORY) private readonly scheduleRepository: WorkScheduleRepository) {}

  async execute(input: ListSchedulesInput): Promise<ScheduleResponseDto[]> {
    // Business Rule: non-Admin roles only ever see their own schedule —
    // force-filtered server-side regardless of any userId query override.
    // Exception (version-up 0.2 #4, reception overview board): RECEPTIONIST
    // is read-only here (GET /schedules is the only schedules endpoint it's
    // granted — see schedules.controller.ts) but needs to see every doctor's
    // schedule, same unrestricted userId/role filtering as ADMIN.
    const canViewAll = input.actorRole === UserRole.ADMIN || input.actorRole === UserRole.RECEPTIONIST;
    const userId = canViewAll ? input.userId : input.actorId;

    const items = await this.scheduleRepository.findMany({
      userId,
      role: canViewAll ? input.role : undefined,
      from: input.from,
      to: input.to,
    });

    return items.map((item) =>
      toScheduleResponse(item.schedule, item.userName, item.userRole, item.roomCode, item.roomName),
    );
  }
}
