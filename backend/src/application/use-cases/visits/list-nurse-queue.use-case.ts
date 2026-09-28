import { Inject, Injectable } from '@nestjs/common';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { ShiftType } from '../../../domain/enums/shift-type.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { ResolveActorShiftService, clinicTodayDateString } from '../../services/resolve-actor-shift.service';

export interface NurseQueueResult {
  shift: ShiftType | null;
  roomId: string | null;
  roomName: string | null;
  visits: VisitResponseDto[];
}

const PRIORITY_RANK: Record<string, number> = { EMERGENCY: 3, ELDERLY: 2, PREGNANT: 2, CHILD: 2, NORMAL: 1 };
const STATUS_TIER: Record<string, number> = { AWAITING_RESULTS: 0, CALLED: 0, WAITING: 1, NO_SHOW: 2 };

@Injectable()
export class ListNurseQueueUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    private readonly resolveActorShift: ResolveActorShiftService,
  ) {}

  async execute(actorId: string, status?: VisitStatus, date?: string, shift?: ShiftType): Promise<NurseQueueResult> {
    // Nurse queue is inherently "today" even when the FE sends no explicit
    // date (it never offers a date picker) — default here rather than
    // leaving it undefined, otherwise the visit lookup below would span
    // every date instead of just today's.
    const dateStr = date ?? clinicTodayDateString();
    const { context } = await this.resolveActorShift.resolve(actorId, dateStr, shift);

    if (!context.roomId) {
      return { shift: context.shift, roomId: null, roomName: null, visits: [] };
    }

    const items = await this.visitRepository.findListWithDetails({
      roomId: context.roomId,
      date: dateStr,
      status,
    });

    const sorted = [...items].sort((a, b) => {
      const pDiff = (PRIORITY_RANK[b.visit.priority] ?? 1) - (PRIORITY_RANK[a.visit.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      const sDiff = (STATUS_TIER[a.visit.status] ?? 1) - (STATUS_TIER[b.visit.status] ?? 1);
      if (sDiff !== 0) return sDiff;
      return (a.visit.queueNumber ?? '').localeCompare(b.visit.queueNumber ?? '');
    });

    return {
      shift: context.shift,
      roomId: context.roomId,
      roomName: context.roomName,
      visits: sorted.map((item) =>
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
      ),
    };
  }
}
