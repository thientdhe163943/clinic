import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { nowAsClinicNaiveUtc, toClinicDateOnly } from '../../../domain/services/clinic-calendar.util';
import { NOTIFICATION_PORT, NotificationPort } from '../../ports/notification.port';

// notification_logs.type for Feature 89 reminders — GetRecheckNotificationsUseCase filters on this.
export const RECHECK_REMINDER_TYPE = 'RECHECK_REMINDER';

export interface RunRecheckReminderResult {
  scanned: number;
  notified: number;
  skippedNoConsent: number;
  skippedAlreadyBooked: number;
  skippedNoEmail: number;
}

function formatDateOnly(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

@Injectable()
export class RunRecheckReminderUseCase {
  private readonly logger = new Logger(RunRecheckReminderUseCase.name);

  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort,
  ) {}

  // Feature 89 main flow, run daily at 02:00 by RecheckReminderScheduler, and
  // exposed via POST /ai/recheck-analysis for a manual/demo trigger. The
  // reminder message itself is a deterministic template — never AI-generated
  // — the same "don't trust the model with factual/actionable content" rule
  // as the medicine-lookup and slot-suggestion grounding in ChatWithAiUseCase.
  async execute(): Promise<RunRecheckReminderResult> {
    const today = toClinicDateOnly(nowAsClinicNaiveUtc());
    const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    const candidates = await this.visitRepository.findRecheckCandidates([today, in3Days]);

    let notified = 0;
    let skippedNoConsent = 0;
    let skippedAlreadyBooked = 0;
    let skippedNoEmail = 0;

    for (const candidate of candidates) {
      const patient = await this.patientRepository.findById(candidate.patientId);
      // Feature 89 business rule: only patients who opted in.
      if (!patient || !patient.notificationConsent) {
        skippedNoConsent++;
        continue;
      }

      // Feature 89 business rule: don't remind a patient who already booked
      // their own recheck.
      if (await this.hasUpcomingAppointment(patient.id, candidate.followUpDate)) {
        skippedAlreadyBooked++;
        continue;
      }

      const isToday = candidate.followUpDate.getTime() === today.getTime();
      const dateLabel = formatDateOnly(candidate.followUpDate);
      const body = isToday
        ? `Chào ${patient.fullName}, hôm nay (${dateLabel}) là ngày tái khám theo hẹn của bạn. Vui lòng đặt lịch hoặc đến phòng khám để được tái khám kịp thời.`
        : `Chào ${patient.fullName}, bạn có lịch tái khám vào ngày ${dateLabel} (còn 3 ngày nữa). Vui lòng đặt lịch trước để được sắp xếp bác sĩ phù hợp.`;

      // SMS delivery was removed — a patient with no email on file simply
      // can't be reminded this way anymore, tracked separately so it's
      // visible in the run summary rather than silently dropped.
      if (!patient.email) {
        skippedNoEmail++;
        continue;
      }

      await this.notificationPort.notify({
        userId: patient.userId,
        recipient: patient.email,
        channel: 'EMAIL',
        type: RECHECK_REMINDER_TYPE,
        subject: 'Nhắc lịch tái khám',
        body,
        refId: candidate.visitId,
      });
      notified++;
    }

    this.logger.log(
      `Recheck reminder run: ${candidates.length} candidate(s), ${notified} notified, ` +
        `${skippedNoConsent} skipped (no consent), ${skippedAlreadyBooked} skipped (already booked), ` +
        `${skippedNoEmail} skipped (no email).`,
    );

    return { scanned: candidates.length, notified, skippedNoConsent, skippedAlreadyBooked, skippedNoEmail };
  }

  private async hasUpcomingAppointment(patientId: string, followUpDate: Date): Promise<boolean> {
    const { items } = await this.appointmentRepository.findMany({ patientId, page: 1, limit: 50, sort: 'desc' });
    return items.some(
      (item) =>
        item.appointment.status !== AppointmentStatus.CANCELLED &&
        item.appointment.appointmentTime.getTime() >= followUpDate.getTime(),
    );
  }
}
