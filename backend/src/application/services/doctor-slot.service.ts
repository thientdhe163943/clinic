import { Inject, Injectable } from '@nestjs/common';
import { AppointmentSlotDto, AvailableDoctorShiftDto } from '../dtos/appointments/available-doctors-response.dto';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../domain/repositories/appointment.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../domain/repositories/work-schedule.repository';
import { SHIFT_HOURS } from '../../infrastructure/persistence/repositories/prisma-work-schedule.repository';
import { AppointmentStatus } from '../../domain/enums/appointment-status.enum';
import { ShiftType } from '../../domain/enums/shift-type.enum';
import { APPOINTMENT_SLOT_MINUTES } from '../../domain/constants/appointment-slot.constant';
import { nowAsClinicNaiveUtc } from '../../domain/services/clinic-calendar.util';

/**
 * Shared doctor-availability slot logic, extracted (Phase 0 of the 0.2
 * version-up plan) out of FindAvailableDoctorsUseCase so both the booking
 * flow (FindAvailableDoctorsUseCase, GetAvailabilityCalendarUseCase) and the
 * public doctor list's `date` filter (ListPublicDoctorsUseCase) build the
 * exact same 30-minute-grid/exclusion logic instead of re-implementing it in
 * two places. Behavior is unchanged from the original inline implementation.
 */
@Injectable()
export class DoctorSlotService {
  constructor(
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
  ) {}

  /**
   * Builds the fixed-size slot grid for a single shift window on `day`,
   * marking a slot unavailable if it has already passed "now" or if it's in
   * `bookedTimes`.
   */
  buildSlots(day: Date, startHour: number, endHour: number, bookedTimes: Set<number>): AppointmentSlotDto[] {
    const slots: AppointmentSlotDto[] = [];
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const now = nowAsClinicNaiveUtc();

    for (let minutes = startMinutes; minutes < endMinutes; minutes += APPOINTMENT_SLOT_MINUTES) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const slotDate = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute),
      );
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push({
        time,
        datetime: slotDate.toISOString(),
        // Business Rule: a slot that has already passed cannot be booked, even
        // if nothing is booked into it yet.
        available: slotDate.getTime() > now.getTime() && !bookedTimes.has(slotDate.getTime()),
      });
    }

    return slots;
  }

  /**
   * Computes a single doctor's shifts + slot grid for `day`, excluding
   * already-booked (non-CANCELLED) appointment times — the exact per-doctor
   * logic FindAvailableDoctorsUseCase used to inline directly.
   */
  async getShiftsWithSlots(doctorId: string, day: Date): Promise<AvailableDoctorShiftDto[]> {
    const shifts = await this.workScheduleRepository.findMany({
      userId: doctorId,
      from: day,
      to: day,
    });

    // Fetch the doctor's existing appointments on this date once (not per
    // shift) and exclude CANCELLED ones — a cancelled appointment must not
    // block its slot from being booked again.
    const { items: appointmentItems } =
      shifts.length > 0
        ? await this.appointmentRepository.findMany({ doctorId, date: day, page: 1, limit: 200 })
        : { items: [] };
    const bookedTimes = new Set(
      appointmentItems
        .filter((item) => item.appointment.status !== AppointmentStatus.CANCELLED)
        .map((item) => item.appointment.appointmentTime.getTime()),
    );

    return shifts.map((item) => {
      const shiftType = item.schedule.shift as ShiftType;
      const { startHour, endHour } = SHIFT_HOURS[shiftType];
      return {
        shift: shiftType,
        roomId: item.schedule.roomId,
        roomName: item.roomName,
        startHour,
        endHour,
        slots: this.buildSlots(day, startHour, endHour, bookedTimes),
      };
    });
  }

  /**
   * Convenience for callers that only need a yes/no on whether the doctor
   * has any bookable slot on `day` (e.g. the public doctor list's `date`
   * filter) — reuses the exact same exclusion logic as getShiftsWithSlots
   * instead of writing a separate query.
   */
  async hasAvailableSlot(doctorId: string, day: Date): Promise<boolean> {
    const shifts = await this.getShiftsWithSlots(doctorId, day);
    return shifts.some((shift) => shift.slots.some((slot) => slot.available));
  }
}
