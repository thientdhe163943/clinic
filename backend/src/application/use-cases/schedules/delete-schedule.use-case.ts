import { Inject, Injectable } from '@nestjs/common';
import {
  ResourceNotFoundError,
  ScheduleHasAppointmentsError,
  SchedulePastDateError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { WORK_SCHEDULE_REPOSITORY, WorkScheduleRepository } from '../../../domain/repositories/work-schedule.repository';

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class DeleteScheduleUseCase {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly scheduleRepository: WorkScheduleRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const existing = await this.scheduleRepository.findById(id);
    if (!existing) throw new ResourceNotFoundError('Schedule', { id });

    const today = toDateOnly(new Date());

    // Business Rule: cannot delete a schedule that has already taken place or is happening today.
    if (toDateOnly(existing.workDate) <= today) throw new SchedulePastDateError();

    // Business Rule: cannot delete a schedule that has linked appointments.
    const hasLinkedAppointments = await this.scheduleRepository.hasLinkedAppointments(id);
    if (hasLinkedAppointments) throw new ScheduleHasAppointmentsError();

    await this.scheduleRepository.delete(id);

    await this.auditLog.write({
      userId: actorId,
      action: 'SCHEDULE_DELETED',
      module: 'SCHEDULE',
      targetId: id,
    });
  }
}
