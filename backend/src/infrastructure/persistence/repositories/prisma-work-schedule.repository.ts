import { Injectable } from '@nestjs/common';
import { ShiftType as PrismaShiftType, WorkSchedule as PrismaWorkSchedule } from '@prisma/client';
import { WorkSchedule } from '../../../domain/entities/work-schedule.entity';
import { ShiftType } from '../../../domain/enums/shift-type.enum';
import { overlappingShifts } from '../../../domain/services/shift-overlap.util';
import {
  CreateWorkScheduleData,
  LinkedAppointmentInfo,
  ReassignDoctorData,
  UpdateWorkScheduleData,
  WorkScheduleListFilter,
  WorkScheduleListItem,
  WorkScheduleRepository,
  WorkScheduleShift,
} from '../../../domain/repositories/work-schedule.repository';
import { PrismaService } from '../prisma/prisma.service';

// NOTE: There is no dedicated WorkSchedule module yet, only the
// `work_schedules` table. The spec/database design does not define explicit
// clock-in/clock-out hours per shift, so this maps ShiftType to a clinic's
// standard working hours. Adjust here if the business defines exact hours
// later (e.g. via a config table).
// endHour may be fractional (17.5 = 17:30) — callers already do `endHour * 60`
// arithmetic in minutes, so this is exact; anything rendering these for
// display must format via formatShiftHour(), not a raw `${hour}:00` template.
export const SHIFT_HOURS: Record<PrismaShiftType, { startHour: number; endHour: number }> = {
  MORNING: { startHour: 7, endHour: 12 },
  AFTERNOON: { startHour: 13, endHour: 17.5 },
  FULL_DAY: { startHour: 7, endHour: 17.5 },
};

// The gap between MORNING.endHour and AFTERNOON.startHour above (12:00-13:00)
// is the clinic's 1-hour lunch break. An assigned-doctor booking is already
// rejected outside a real MORNING/AFTERNOON shift window via
// findCoveringShift, but the doctor-less "Đặt lịch nhanh" path has no shift
// to check against, so callers must check this explicitly (see
// LunchBreakBookingError in create-appointment.use-case.ts /
// create-guest-appointment.use-case.ts). Deliberately not applied to
// FULL_DAY, which spans the gap by design (see SHIFT_HOURS.FULL_DAY above)
// — whether FULL_DAY shifts should also carve out a lunch break is a
// separate, unrelated question about WorkSchedule assignment, not this
// booking-time check.
export function isWithinLunchBreak(appointmentTime: Date): boolean {
  const minutesSinceMidnight = appointmentTime.getUTCHours() * 60 + appointmentTime.getUTCMinutes();
  return (
    minutesSinceMidnight >= SHIFT_HOURS.MORNING.endHour * 60 &&
    minutesSinceMidnight < SHIFT_HOURS.AFTERNOON.startHour * 60
  );
}

@Injectable()
export class PrismaWorkScheduleRepository implements WorkScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCoveringShift(doctorId: string, datetime: Date): Promise<WorkScheduleShift | null> {
    const workDate = new Date(
      Date.UTC(datetime.getUTCFullYear(), datetime.getUTCMonth(), datetime.getUTCDate()),
    );

    const shifts = await this.prisma.workSchedule.findMany({
      where: { userId: doctorId, workDate },
    });

    const minutesOfDay = datetime.getUTCHours() * 60 + datetime.getUTCMinutes();

    const covering = shifts.find((shift) => {
      const { startHour, endHour } = SHIFT_HOURS[shift.shift];
      return minutesOfDay >= startHour * 60 && minutesOfDay < endHour * 60;
    });

    if (!covering) return null;

    return {
      id: covering.id,
      userId: covering.userId,
      roomId: covering.roomId,
      workDate: covering.workDate,
      shift: covering.shift,
    };
  }

  async findById(id: string): Promise<WorkSchedule | null> {
    const row = await this.prisma.workSchedule.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findConflict(
    userId: string,
    workDate: Date,
    shift: ShiftType,
    excludeId?: string,
  ): Promise<WorkSchedule | null> {
    const row = await this.prisma.workSchedule.findFirst({
      where: {
        userId,
        workDate,
        shift: { in: overlappingShifts(shift) as PrismaShiftType[] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findRoomConflict(
    roomId: string,
    workDate: Date,
    shift: ShiftType,
    role: string,
    excludeId?: string,
  ): Promise<WorkSchedule | null> {
    const row = await this.prisma.workSchedule.findFirst({
      where: {
        roomId,
        workDate,
        shift: { in: overlappingShifts(shift) as PrismaShiftType[] },
        user: { role: role as any },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findMany(filter: WorkScheduleListFilter): Promise<WorkScheduleListItem[]> {
    const rows = await this.prisma.workSchedule.findMany({
      where: {
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.role ? { user: { role: filter.role as any } } : {}),
        ...(filter.from || filter.to
          ? {
              workDate: {
                ...(filter.from ? { gte: filter.from } : {}),
                ...(filter.to ? { lte: filter.to } : {}),
              },
            }
          : {}),
      },
      include: { user: true, room: true },
      orderBy: [{ workDate: 'asc' }, { shift: 'asc' }],
    });

    return rows.map((row) => ({
      schedule: this.toDomain(row),
      userName: row.user.fullName,
      userRole: row.user.role,
      roomCode: row.room?.roomCode ?? null,
      roomName: row.room?.name ?? null,
    }));
  }

  async findManyByUserAndDateRange(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<WorkScheduleListItem[]> {
    const rows = await this.prisma.workSchedule.findMany({
      where: { userId, workDate: { gte: fromDate, lte: toDate } },
      include: { user: true, room: true },
      orderBy: [{ workDate: 'asc' }, { shift: 'asc' }],
    });
    return rows.map((row) => ({
      schedule: this.toDomain(row),
      userName: row.user.fullName,
      userRole: row.user.role,
      roomCode: row.room?.roomCode ?? null,
      roomName: row.room?.name ?? null,
    }));
  }

  async hasLinkedAppointments(scheduleId: string): Promise<boolean> {
    const count = await this.prisma.appointment.count({ where: { scheduleId } });
    return count > 0;
  }

  async findLinkedAppointments(scheduleId: string): Promise<LinkedAppointmentInfo[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { scheduleId },
      include: { patient: { select: { fullName: true, phone: true } } },
      orderBy: { appointmentTime: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      patientName: row.patient.fullName,
      patientPhone: row.patient.phone,
      appointmentTime: row.appointmentTime,
      status: row.status,
    }));
  }

  async create(data: CreateWorkScheduleData): Promise<WorkSchedule> {
    const row = await this.prisma.workSchedule.create({
      data: {
        userId: data.userId,
        roomId: data.roomId,
        workDate: data.workDate,
        shift: data.shift as PrismaShiftType,
        note: data.note ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateWorkScheduleData): Promise<WorkSchedule> {
    const row = await this.prisma.workSchedule.update({
      where: { id },
      data: {
        roomId: data.roomId,
        workDate: data.workDate,
        shift: data.shift as PrismaShiftType,
        note: data.note ?? null,
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async reassignDoctor(id: string, data: ReassignDoctorData): Promise<WorkSchedule> {
    const row = await this.prisma.workSchedule.update({
      where: { id },
      data: {
        userId: data.userId,
        originalUserId: data.originalUserId,
        isAbsent: true,
        absentNote: data.absentNote,
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workSchedule.delete({ where: { id } });
  }

  private toDomain(row: PrismaWorkSchedule): WorkSchedule {
    return new WorkSchedule(
      row.id,
      row.userId,
      row.roomId,
      row.workDate,
      row.shift as ShiftType,
      row.note,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      row.updatedBy,
      row.isAbsent,
      row.absentNote,
      row.originalUserId,
    );
  }
}
