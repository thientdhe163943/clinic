import { Inject, Injectable } from '@nestjs/common';
import { ROOM_REPOSITORY, RoomRepository } from '../../domain/repositories/room.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../domain/repositories/work-schedule.repository';
import { ShiftType } from '../../domain/enums/shift-type.enum';
import { overlappingShifts } from '../../domain/services/shift-overlap.util';
import { nowAsClinicNaiveUtc } from '../../domain/services/clinic-calendar.util';

export interface ActorShiftContext {
  shift: ShiftType | null;
  roomId: string | null;
  roomName: string | null;
}

export function clinicTodayDateString(): string {
  const now = nowAsClinicNaiveUtc();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Resolves the room a DOCTOR/NURSE is actually staffing right now, from
 * their `WorkSchedule` — used to scope the doctor/nurse queue to the room of
 * the shift they're currently covering, instead of showing every room's
 * patients mixed together (or, for nurses previously, whichever shift
 * happened to sort first) when the same person works different rooms across
 * the morning/afternoon shift.
 *
 * Only resolves for "now" (today, no explicit shift) or an explicitly
 * requested date+shift — a bare `date` filter for a non-today date returns
 * `{ shift: null, roomId: null, roomName: null }` with `attempted: false`,
 * so callers know no scoping should be applied at all rather than "no shift
 * found".
 */
@Injectable()
export class ResolveActorShiftService {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
  ) {}

  async resolve(
    actorId: string,
    date?: string,
    shift?: ShiftType,
  ): Promise<{ context: ActorShiftContext; attempted: boolean }> {
    const today = clinicTodayDateString();

    if (shift) {
      const dateStr = date ?? today;
      const shifts = await this.workScheduleRepository.findMany({
        userId: actorId,
        from: parseDateOnly(dateStr),
        to: parseDateOnly(dateStr),
      });
      const match = shifts.find((s) => overlappingShifts(shift).includes(s.schedule.shift as ShiftType));
      if (!match) return { context: { shift: null, roomId: null, roomName: null }, attempted: true };

      return {
        attempted: true,
        context: {
          shift: match.schedule.shift as ShiftType,
          roomId: match.schedule.roomId ?? null,
          roomName: match.roomName,
        },
      };
    }

    // Only auto-derive from "now" when the caller is explicitly asking about
    // today (or omitted `date` entirely from a request that's inherently
    // today-scoped, e.g. the nurse queue). A bare `date`-less lookup used to
    // find one specific visit by id regardless of room/day (see
    // VisitDetailPage) must NOT be scoped — `date !== today` is true for
    // both "some other day" and "no date given", so both correctly skip
    // scoping here; only an explicit `date === today` proceeds.
    if (date !== today) {
      return { context: { shift: null, roomId: null, roomName: null }, attempted: false };
    }

    const covering = await this.workScheduleRepository.findCoveringShift(actorId, nowAsClinicNaiveUtc());
    if (!covering) return { context: { shift: null, roomId: null, roomName: null }, attempted: true };

    const room = covering.roomId ? await this.roomRepository.findById(covering.roomId) : null;
    return {
      attempted: true,
      context: {
        shift: covering.shift as ShiftType,
        roomId: covering.roomId,
        roomName: room?.name ?? null,
      },
    };
  }
}
