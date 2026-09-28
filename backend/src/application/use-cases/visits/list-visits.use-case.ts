import { Inject, Injectable } from '@nestjs/common';
import { ListVisitsQueryDto } from '../../dtos/visits/list-visits-query.dto';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { ResolveActorShiftService } from '../../services/resolve-actor-shift.service';

const PRIORITY_RANK: Record<string, number> = { EMERGENCY: 3, ELDERLY: 2, PREGNANT: 2, CHILD: 2, NORMAL: 1 };
const STATUS_TIER: Record<string, number> = { AWAITING_RESULTS: 0, CALLED: 0, WAITING: 1, NO_SHOW: 2 };

export interface ListVisitsInput extends ListVisitsQueryDto {
  doctorId?: string;
  // The logged-in DOCTOR/NURSE — used to resolve which room their current
  // (or explicitly requested) shift covers, so the queue only shows that
  // room's patients (in addition to whichever doctorId scoping applies).
  actorId: string;
  // Version-up 0.2 #4 (reception overview board): a RECEPTIONIST has no
  // exam-room shift of their own, so actor-shift scoping doesn't apply to
  // them at all — they see every room's visits (filtered only by whatever
  // doctorId/date/status the query already specifies), same idea as
  // list-schedules.use-case.ts's canViewAll branch.
  actorRole: UserRole;
}

@Injectable()
export class ListVisitsUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    private readonly resolveActorShift: ResolveActorShiftService,
  ) {}

  async execute(input: ListVisitsInput): Promise<VisitResponseDto[]> {
    const isReceptionist = input.actorRole === UserRole.RECEPTIONIST;
    const { context, attempted } = isReceptionist
      ? { context: { roomId: null, shift: null, roomName: null }, attempted: false }
      : await this.resolveActorShift.resolve(input.actorId, input.date, input.shift);

    if (attempted && !context.roomId) return [];

    const items = await this.visitRepository.findListWithDetails({
      doctorId: input.doctorId,
      date: input.date,
      status: input.status,
      roomId: context.roomId ?? undefined,
    });

    // priority DESC → status tier ASC → queueNumber ASC (check-in order)
    const sorted = [...items].sort((a, b) => {
      const pDiff = (PRIORITY_RANK[b.visit.priority] ?? 1) - (PRIORITY_RANK[a.visit.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      const sDiff = (STATUS_TIER[a.visit.status] ?? 1) - (STATUS_TIER[b.visit.status] ?? 1);
      if (sDiff !== 0) return sDiff;
      return (a.visit.queueNumber ?? '').localeCompare(b.visit.queueNumber ?? '');
    });

    return sorted.map((item) =>
      toVisitResponse(
        item.visit,
        item.patientName,
        item.patientCode,
        item.doctorName,
        item.serviceName,
        item.appointmentTime,
        item.note,
        item.patientPhone,
      ),
    );
  }
}
