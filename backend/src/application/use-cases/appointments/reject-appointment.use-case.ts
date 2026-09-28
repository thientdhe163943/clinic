import { Inject, Injectable } from '@nestjs/common';
import { AppointmentResponseDto, toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import {
  AppointmentNotPendingError,
  RejectReasonRequiredError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { NOTIFICATION_PORT, NotificationPort } from '../../ports/notification.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';

export interface RejectAppointmentInput {
  appointmentId: string;
  reason?: string;
  actorId: string;
}

@Injectable()
export class RejectAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
  ) {}

  async execute(input: RejectAppointmentInput): Promise<AppointmentResponseDto> {
    if (!input.reason?.trim()) throw new RejectReasonRequiredError();

    const appointment = await this.appointmentRepository.findById(input.appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: input.appointmentId });

    // Business Rule: only PENDING appointments can be rejected.
    if (appointment.status !== AppointmentStatus.PENDING) throw new AppointmentNotPendingError();

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
      action: 'APPOINTMENT_REJECTED',
      module: 'APPOINTMENT',
      targetId: appointment.id,
      detail: { reason: input.reason },
    });

    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(updated.patientId),
      updated.doctorId ? this.userRepository.findById(updated.doctorId) : Promise.resolve(null),
      updated.serviceId ? this.serviceRepository.findById(updated.serviceId) : Promise.resolve(null),
    ]);

    // Feature 65 A1 business rule: notification_logs type=APPOINTMENT_CANCELLED.
    if (patient && patient.notificationConsent && patient.email) {
      await this.notification.notify({
        userId: patient.userId,
        recipient: patient.email,
        channel: 'EMAIL',
        type: 'APPOINTMENT_CANCELLED',
        subject: 'Yêu cầu đặt lịch bị từ chối',
        body: `Yêu cầu đặt lịch khám ${service?.name ?? ''} đã bị từ chối. Lý do: ${input.reason}`,
        refId: updated.id,
      });
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
