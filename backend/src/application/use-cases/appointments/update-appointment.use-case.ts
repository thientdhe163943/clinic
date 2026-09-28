import { Inject, Injectable } from '@nestjs/common';
import { AppointmentResponseDto, toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import { UpdateAppointmentRequestDto } from '../../dtos/appointments/update-appointment.dto';
import {
  AppointmentServiceTypeInvalidError,
  AppointmentSlotConflictError,
  AppointmentUpdateNotAllowedError,
  DoctorNotScheduledError,
  LunchBreakBookingError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { isWithinLunchBreak } from '../../../infrastructure/persistence/repositories/prisma-work-schedule.repository';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';

const ALLOWED_STATUSES = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

export interface UpdateAppointmentInput extends UpdateAppointmentRequestDto {
  appointmentId: string;
  actorId: string;
}

@Injectable()
export class UpdateAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(input: UpdateAppointmentInput): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findById(input.appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: input.appointmentId });

    // Business Rule: only PENDING/CONFIRMED appointments can be updated.
    if (!ALLOWED_STATUSES.includes(appointment.status)) throw new AppointmentUpdateNotAllowedError();

    if (input.serviceId) {
      const service = await this.serviceRepository.findById(input.serviceId);
      if (!service) throw new ResourceNotFoundError('Service', { id: input.serviceId });
      if (service.type !== ServiceType.EXAMINATION) throw new AppointmentServiceTypeInvalidError();
    }

    // `undefined` (field omitted from the request) means "leave unchanged";
    // `null` is an explicit "clear back to unassigned" — `??` would treat
    // both the same way and silently keep the old doctor/service, so the
    // two must be told apart explicitly rather than coalesced.
    const doctorIdProvided = input.doctorId !== undefined;
    const newDoctorId = doctorIdProvided ? input.doctorId : appointment.doctorId;
    const serviceIdProvided = input.serviceId !== undefined;
    const newServiceId = serviceIdProvided ? input.serviceId : appointment.serviceId;

    const newTime = input.appointmentTime ?? appointment.appointmentTime;
    const doctorOrTimeChanged =
      newDoctorId !== appointment.doctorId || newTime.getTime() !== appointment.appointmentTime.getTime();
    const serviceChanged = serviceIdProvided && newServiceId !== appointment.serviceId;

    let scheduleId = appointment.scheduleId;

    // Business Rule: only re-validate work-schedule coverage/doctor conflict
    // when a doctor is actually assigned — a doctor-less appointment (see
    // CreateAppointmentUseCase's optional-doctor booking) has no shift to
    // check, and remains validly doctor-less if only its time was changed.
    if (doctorOrTimeChanged && newDoctorId) {
      if (input.doctorId) {
        const doctor = await this.userRepository.findById(input.doctorId);
        if (!doctor) throw new ResourceNotFoundError('Doctor', { id: input.doctorId });
      }

      // Business Rule: re-validate work-schedule coverage when doctor or slot changes.
      const shift = await this.workScheduleRepository.findCoveringShift(newDoctorId, newTime);
      if (!shift) throw new DoctorNotScheduledError();
      scheduleId = shift.id;

      // Business Rule: new slot must not already be booked for the doctor.
      const conflict = await this.appointmentRepository.findDoctorConflict(
        newDoctorId,
        newTime,
        appointment.id,
      );
      if (conflict) throw new AppointmentSlotConflictError();
    } else if (doctorOrTimeChanged && !newDoctorId && isWithinLunchBreak(newTime)) {
      // Still doctor-less after this update but the time did change — same
      // gap as CreateAppointmentUseCase: no shift to check via
      // findCoveringShift, so the lunch break must be rejected explicitly.
      throw new LunchBreakBookingError();
    }

    const updated = await this.appointmentRepository.update(appointment.id, {
      doctorId: input.doctorId,
      serviceId: input.serviceId,
      appointmentTime: input.appointmentTime,
      // Clearing the doctor (or a time change re-resolving a schedule) must
      // also clear/replace scheduleId — otherwise it's left pointing at the
      // old doctor's shift even though the appointment is now doctor-less.
      scheduleId: doctorOrTimeChanged ? (newDoctorId ? scheduleId : null) : undefined,
      note: input.note,
    });

    // Business Rule: a service-only change is also a change worth logging,
    // even though appointment_history has no dedicated old/new service
    // column — the row still records that something changed and by whom.
    if (doctorOrTimeChanged || serviceChanged) {
      await this.appointmentRepository.addHistory({
        appointmentId: appointment.id,
        oldStatus: appointment.status,
        newStatus: appointment.status,
        oldTime: appointment.appointmentTime,
        newTime: updated.appointmentTime,
        oldDoctorId: appointment.doctorId,
        newDoctorId: updated.doctorId,
        changedBy: input.actorId,
      });
    }

    await this.auditLog.write({
      userId: input.actorId,
      action: 'APPOINTMENT_UPDATED',
      module: 'APPOINTMENT',
      targetId: appointment.id,
    });

    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(updated.patientId),
      updated.doctorId ? this.userRepository.findById(updated.doctorId) : Promise.resolve(null),
      updated.serviceId ? this.serviceRepository.findById(updated.serviceId) : Promise.resolve(null),
    ]);

    try {
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: updated.id });
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
