import { Inject, Injectable } from '@nestjs/common';
import { AppointmentResponseDto, toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import { AppointmentNotPendingError, ResourceNotFoundError } from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { NOTIFICATION_PORT, NotificationPort } from '../../ports/notification.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { formatClinicDateTime } from '../../../domain/services/clinic-calendar.util';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';

@Injectable()
export class ConfirmAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
  ) {}

  async execute(appointmentId: string, actorId: string): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findById(appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: appointmentId });

    // Business Rule: only PENDING appointments can be confirmed.
    if (appointment.status !== AppointmentStatus.PENDING) throw new AppointmentNotPendingError();

    const updated = await this.appointmentRepository.updateStatus(appointment.id, AppointmentStatus.CONFIRMED);

    // history, audit và fetch patient/doctor/service chạy song song
    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(updated.patientId),
      updated.doctorId ? this.userRepository.findById(updated.doctorId) : Promise.resolve(null),
      updated.serviceId ? this.serviceRepository.findById(updated.serviceId) : Promise.resolve(null),
      this.appointmentRepository.addHistory({
        appointmentId: appointment.id,
        oldStatus: appointment.status,
        newStatus: AppointmentStatus.CONFIRMED,
        changedBy: actorId,
      }),
      this.auditLog.write({
        userId: actorId,
        action: 'APPOINTMENT_CONFIRMED',
        module: 'APPOINTMENT',
        targetId: appointment.id,
      }),
    ]).then(([p, d, s]) => [p, d, s] as const);

    // Feature 59/65 business rule: notification_logs type=APPOINTMENT_CONFIRMED.
    // Failure is swallowed inside NotificationPort — never blocks confirmation.
    // Respects patients.notification_consent — never notify without consent.
    // Fire-and-forget: email gửi ngầm, không block response. Realtime bell
    // vẫn bắn vì realtimePort.emit() không await bên trong notify(). Email
    // only (SMS channel removed) — skip if the patient has no email on file.
    if (patient && patient.notificationConsent && patient.email) {
      void this.notification.notify({
        userId: patient.userId,
        recipient: patient.email,
        channel: 'EMAIL',
        type: 'APPOINTMENT_CONFIRMED',
        subject: 'Lịch hẹn đã được xác nhận',
        body: `Lịch hẹn khám ${service?.name ?? ''} với ${doctor ? DoctorDisplayName.format(doctor.fullName) : ''} lúc ${formatClinicDateTime(updated.appointmentTime)} đã được xác nhận.`,
        refId: updated.id,
      });
    }

    return toAppointmentResponse(
      updated,
      patient?.fullName ?? '',
      patient?.patientCode ?? '',
      doctor?.fullName ?? '',
      service?.name ?? '',
    );
  }
}
