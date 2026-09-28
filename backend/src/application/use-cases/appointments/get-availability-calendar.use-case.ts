import { Inject, Injectable } from '@nestjs/common';
import { AvailabilityCalendarDayDto } from '../../dtos/appointments/availability-calendar-response.dto';
import { ResourceNotFoundError, ServiceSpecialtyMissingError } from '../../errors/application-error';
import { toClinicDateOnly, nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { ShiftType } from '../../../domain/enums/shift-type.enum';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';
import { SHIFT_HOURS } from '../../../infrastructure/persistence/repositories/prisma-work-schedule.repository';
import { DoctorSlotService } from '../../services/doctor-slot.service';

export interface GetAvailabilityCalendarInput {
  serviceId: string;
  month: string; // "YYYY-MM"
}

@Injectable()
export class GetAvailabilityCalendarUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    private readonly doctorSlotService: DoctorSlotService,
  ) {}

  async execute(input: GetAvailabilityCalendarInput): Promise<AvailabilityCalendarDayDto[]> {
    const service = await this.serviceRepository.findById(input.serviceId);
    if (!service) throw new ResourceNotFoundError('Service', { id: input.serviceId });

    // Business Rule: same as FindAvailableDoctorsUseCase — a service without a
    // specialty cannot be used to resolve which doctors are bookable.
    if (!service.specialtyId) throw new ServiceSpecialtyMissingError();

    const [yearStr, monthStr] = input.month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1; // 0-based
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

    const doctors = await this.userRepository.findDoctorsBySpecialty(service.specialtyId);
    const today = toClinicDateOnly(nowAsClinicNaiveUtc());

    const result: AvailabilityCalendarDayDto[] = [];

    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
      const day = new Date(Date.UTC(year, monthIndex, dayOfMonth));
      const dateStr = day.toISOString().slice(0, 10);

      // Business Rule: days before today never have availability — no need to
      // query doctors/shifts for a date that can no longer be booked.
      if (day.getTime() < today.getTime() || doctors.length === 0) {
        result.push({ date: dateStr, hasAvailability: false });
        continue;
      }

      let hasAvailability = false;

      for (const doctor of doctors) {
        if (hasAvailability) break;

        const shifts = await this.workScheduleRepository.findMany({ userId: doctor.id, from: day, to: day });
        if (shifts.length === 0) continue;

        const { items: appointmentItems } = await this.appointmentRepository.findMany({
          doctorId: doctor.id,
          date: day,
          page: 1,
          limit: 200,
        });
        const bookedTimes = new Set(
          appointmentItems
            .filter((item) => item.appointment.status !== AppointmentStatus.CANCELLED)
            .map((item) => item.appointment.appointmentTime.getTime()),
        );

        for (const item of shifts) {
          const shiftType = item.schedule.shift as ShiftType;
          const { startHour, endHour } = SHIFT_HOURS[shiftType];
          const slots = this.doctorSlotService.buildSlots(day, startHour, endHour, bookedTimes);
          if (slots.some((slot) => slot.available)) {
            hasAvailability = true;
            break;
          }
        }
      }

      result.push({ date: dateStr, hasAvailability });
    }

    return result;
  }
}
