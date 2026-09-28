import { Inject, Injectable } from '@nestjs/common';
import { AvailableDoctorDto } from '../../dtos/appointments/available-doctors-response.dto';
import { ResourceNotFoundError, ServiceSpecialtyMissingError } from '../../errors/application-error';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { DoctorSlotService } from '../../services/doctor-slot.service';

export interface FindAvailableDoctorsInput {
  serviceId: string;
  date: Date;
}

export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class FindAvailableDoctorsUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly doctorSlotService: DoctorSlotService,
  ) {}

  async execute(input: FindAvailableDoctorsInput): Promise<AvailableDoctorDto[]> {
    const service = await this.serviceRepository.findById(input.serviceId);
    if (!service) throw new ResourceNotFoundError('Service', { id: input.serviceId });

    // Business Rule: a service maps to exactly one specialty; a service with
    // no specialty assigned cannot be used to filter doctors for booking.
    if (!service.specialtyId) throw new ServiceSpecialtyMissingError();

    const doctors = await this.userRepository.findDoctorsBySpecialty(service.specialtyId);
    if (doctors.length === 0) return [];

    const day = toDateOnly(input.date);

    const results = await Promise.all(
      doctors.map(async (doctor) => ({
        doctorId: doctor.id,
        doctorName: DoctorDisplayName.format(doctor.fullName),
        shifts: await this.doctorSlotService.getShiftsWithSlots(doctor.id, day),
      })),
    );

    // Business Rule: only doctors with at least one shift on the given date
    // are returned — a doctor matching the specialty but not scheduled that
    // day is not "available" for booking.
    return results.filter((doctor) => doctor.shifts.length > 0);
  }
}
