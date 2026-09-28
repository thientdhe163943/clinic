import { Inject, Injectable } from '@nestjs/common';
import { AppointmentResponseDto, toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import {
  AppointmentCancelNotAllowedError,
  CancelReasonRequiredError,
  ForbiddenActionError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { NOTIFICATION_PORT, NotificationPort } from '../../ports/notification.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { formatClinicDateTime } from '../../../domain/services/clinic-calendar.util';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { UserRole } from '../../../domain/enums/user-role.enum';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';

const BLOCKED_STATUSES = [
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
];

export interface CancelAppointmentInput {
  appointmentId: string;
  reason?: string;
  actorId: string;
  actorRole: UserRole;
}

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(input: CancelAppointmentInput): Promise<AppointmentResponseDto> {
    if (!input.reason?.trim()) throw new CancelReasonRequiredError();

    const appointment = await this.appointmentRepository.findById(input.appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: input.appointmentId });

    // Business Rule: a patient may only cancel their own appointment.
    const patientActor = await this.patientRepository.findByUserId(input.actorId);
    if (!patientActor || patientActor.id !== appointment.patientId) {
      throw new ForbiddenActionError();
    }

    // Business Rule: cannot cancel an appointment already CHECKED_IN/IN_PROGRESS/COMPLETED/CANCELLED.
    if (BLOCKED_STATUSES.includes(appointment.status)) throw new AppointmentCancelNotAllowedError();

    const cancelledAt = new Date();
    const updated = await this.appointmentRepository.updateStatus(appointment.id, AppointmentStatus.CANCELLED, {
      cancelReason: input.reason,
      cancelledBy: input.actorId,
      cancelledAt,
    });

    await this.appointmentRepository.addHistory({
      appointmentId: appointment.id,
      oldStatus: appointment.status,
      newStatus: AppointmentStatus.CANCELLED,
      reason: input.reason,
      changedBy: input.actorId,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'APPOINTMENT_CANCELLED',
      module: 'APPOINTMENT',
      targetId: appointment.id,
      detail: { reason: input.reason },
    });

    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(updated.patientId),
      updated.doctorId ? this.userRepository.findById(updated.doctorId) : Promise.resolve(null),
      updated.serviceId ? this.serviceRepository.findById(updated.serviceId) : Promise.resolve(null),
    ]);

    // Feature 62 business rule: notification_logs type=APPOINTMENT_CANCELLED
    // to the patient (bell + email, gated on consent). No SMS fallback —
    // a patient with no email on file just doesn't get this notification.
    const body = `Lịch hẹn khám ${service?.name ?? ''} lúc ${formatClinicDateTime(updated.appointmentTime)} đã bị hủy. Lý do: ${input.reason}`;
    if (patient && patient.notificationConsent && patient.email) {
      await this.notification.notify({
        userId: patient.userId,
        recipient: patient.email,
        channel: 'EMAIL',
        type: 'APPOINTMENT_CANCELLED',
        subject: 'Lịch hẹn đã bị hủy',
        body,
        refId: updated.id,
      });
    }

    try {
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: updated.id });
      // Doctors don't get a bell/email for this (staff notifications are
      // realtime-only) — just a live push to their own schedule view.
      if (doctor) this.realtimePort.emit(doctor.id, 'appointment:changed', { appointmentId: updated.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    return toAppointmentResponse(
      updated,
      patient?.fullName ?? '',
      patient?.patientCode ?? '',
      doctor ? DoctorDisplayName.format(doctor.fullName) : '',
      service?.name ?? '',
    );
  }
}
