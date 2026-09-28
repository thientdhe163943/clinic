import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TooManyPendingAppointmentsError } from '../errors/application-error';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../domain/repositories/appointment.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../domain/repositories/visit.repository';
import { nowAsClinicNaiveUtc } from '../../domain/services/clinic-calendar.util';

/**
 * Shared anti-spam/anti-no-show checks for the appointment booking flow
 * (version-up 0.2 plan item #7), used by both CreateAppointmentUseCase and
 * CreateGuestAppointmentUseCase so the two thresholds (`booking.*` config,
 * see app.config.ts) aren't duplicated/drifted between the two call sites —
 * same rationale as DoctorSlotService's extraction in Phase 0.
 */
@Injectable()
export class AppointmentTrustService {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Business rule #2: a patient may not hold more than
   * `booking.maxPendingAppointmentsPerPatient` PENDING/CONFIRMED future
   * appointments at once. Throws TooManyPendingAppointmentsError if the
   * limit is already reached.
   */
  async assertPendingLimitNotExceeded(patientId: string): Promise<void> {
    const limit = this.configService.get<number>('booking.maxPendingAppointmentsPerPatient') ?? 3;
    const count = await this.appointmentRepository.countActiveByPatient(patientId, nowAsClinicNaiveUtc());
    if (count >= limit) {
      throw new TooManyPendingAppointmentsError(count, limit);
    }
  }

  /**
   * Business rule #4: a patient with >= `booking.noShowTrustThreshold`
   * NO_SHOW visits in the last `booking.noShowLookbackDays` days loses the
   * auto-CONFIRMED fast-path — the caller should keep the appointment
   * PENDING instead of CONFIRMED so a receptionist confirms manually.
   */
  async hasExcessiveNoShows(patientId: string): Promise<boolean> {
    const threshold = this.configService.get<number>('booking.noShowTrustThreshold') ?? 2;
    const lookbackDays = this.configService.get<number>('booking.noShowLookbackDays') ?? 90;
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const noShowCount = await this.visitRepository.countNoShowsSince(patientId, since);
    return noShowCount >= threshold;
  }
}
