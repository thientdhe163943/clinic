import { Injectable } from '@nestjs/common';
import { ShiftType } from '../../../domain/enums/shift-type.enum';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { ResolveActorShiftService } from '../../services/resolve-actor-shift.service';

export interface VisitQueueContextDto {
  shift: ShiftType | null;
  roomId: string | null;
  roomName: string | null;
}

// Tells the doctor/nurse queue screen which room the caller is currently
// staffing, so the page can render "Phòng X · Ca sáng" in its header and
// show a "not on shift" empty state instead of a bare "no visits" table
// when the actor has no covering WorkSchedule row.
@Injectable()
export class GetVisitQueueContextUseCase {
  constructor(private readonly resolveActorShift: ResolveActorShiftService) {}

  async execute(actorId: string, actorRole: UserRole, date?: string, shift?: ShiftType): Promise<VisitQueueContextDto> {
    // Version-up 0.2 #4: "which room am I staffing" has no meaning for a
    // RECEPTIONIST (no exam-room shift of their own) — and resolving by
    // actorId could wrongly latch onto an unrelated WorkSchedule row if one
    // happens to exist for them. Same rationale as ListVisitsUseCase.
    if (actorRole === UserRole.RECEPTIONIST) return { shift: null, roomId: null, roomName: null };

    const { context } = await this.resolveActorShift.resolve(actorId, date, shift);
    return context;
  }
}
