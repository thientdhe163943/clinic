import { Inject, Injectable } from '@nestjs/common';
import { toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import { CheckInAppointmentRequestDto } from '../../dtos/appointments/check-in-appointment.dto';
import { CheckInResponseDto } from '../../dtos/appointments/checkin-response.dto';
import { toInvoiceResponse } from '../../dtos/invoices/invoice-response.dto';
import {
  AppointmentNotConfirmedError,
  CheckInDateMismatchError,
  DoctorNotScheduledError,
  ResourceNotFoundError,
  ScheduleRoomMissingError,
} from '../../errors/application-error';
import { isSameClinicDay, nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { InvoiceBillingService } from '../../services/invoice-billing.service';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
  CheckInInvoiceData,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';

export interface CheckInAppointmentInput extends CheckInAppointmentRequestDto {
  appointmentId: string;
  actorId: string;
}

@Injectable()
export class CheckInAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly invoiceBilling: InvoiceBillingService,
  ) {}

  async execute(input: CheckInAppointmentInput): Promise<CheckInResponseDto> {
    const appointment = await this.appointmentRepository.findById(input.appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: input.appointmentId });

    // Business Rule: only CONFIRMED appointments can be checked in.
    if (appointment.status !== AppointmentStatus.CONFIRMED) throw new AppointmentNotConfirmedError();

    // Business Rule: check-in is only allowed on the appointment's own
    // calendar day — a receptionist should not be able to check a patient
    // into a visit for an appointment booked on a different day.
    if (!isSameClinicDay(appointment.appointmentTime, nowAsClinicNaiveUtc())) {
      throw new CheckInDateMismatchError();
    }

    // Business Rule: a doctor must be assigned before check-in — an
    // appointment booked doctor-less (see CreateAppointmentUseCase's
    // optional-doctor booking) must first go through UpdateAppointmentUseCase
    // to have a doctor set, since the room is resolved from that doctor's
    // work-schedule shift.
    if (!appointment.doctorId) throw new DoctorNotScheduledError();

    // Business Rule: room is resolved from the doctor's pre-assigned work
    // schedule, not hand-picked by the receptionist. Uses the actual
    // check-in moment (now), not appointment.appointmentTime — a patient
    // booked for the afternoon who is actually checked in during the
    // morning shift (early arrival, schedule change, etc.) must land in
    // whichever room the doctor is covering right now, otherwise the visit
    // gets stamped with the originally-booked shift's room and never shows
    // up in the queue of the shift the patient is actually physically in.
    const shift = await this.workScheduleRepository.findCoveringShift(
      appointment.doctorId,
      nowAsClinicNaiveUtc(),
    );
    if (!shift) throw new DoctorNotScheduledError();
    if (!shift.roomId) throw new ScheduleRoomMissingError();

    const checkedInAt = new Date();

    // Business Rule (version-up 0.2 item #10): the exam-fee InvoiceItem is
    // billed right at check-in so StartVisitUseCase's Gate #1 has something
    // to check against — appointment.serviceId may be null (booked without
    // one), in which case there's nothing to bill yet and no invoice is
    // created here (a later CLS order or the /invoices fallback endpoint
    // will create one if needed).
    let invoiceData: CheckInInvoiceData | undefined;
    if (appointment.serviceId) {
      const service = await this.serviceRepository.findById(appointment.serviceId);
      if (service) {
        invoiceData = {
          createdBy: input.actorId,
          item: this.invoiceBilling.buildExaminationItem(service),
        };
      }
    }

    // One atomic write: appointment status/room/checkedInAt + history +
    // invoice (Feature 60/91 removed the old flat deposit; item #10
    // reintroduces itemized, per-stage billing starting here). Payment-
    // before-queue change (2026-08-21): no Visit yet — the patient only
    // enters the queue once ConfirmCheckInPaymentUseCase collects the exam
    // fee (or confirms there's nothing to collect).
    const result = await this.appointmentRepository.checkIn({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      roomId: shift.roomId,
      priority: input.priority,
      checkedInAt,
      changedBy: input.actorId,
      oldStatus: appointment.status,
      invoice: invoiceData,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'APPOINTMENT_CHECKED_IN',
      module: 'APPOINTMENT',
      targetId: appointment.id,
    });

    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(result.appointment.patientId),
      result.appointment.doctorId ? this.userRepository.findById(result.appointment.doctorId) : Promise.resolve(null),
      result.appointment.serviceId ? this.serviceRepository.findById(result.appointment.serviceId) : Promise.resolve(null),
    ]);

    try {
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: result.appointment.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    return {
      appointment: toAppointmentResponse(
        result.appointment,
        patient?.fullName ?? '',
        patient?.patientCode ?? '',
        doctor ? DoctorDisplayName.format(doctor.fullName) : '',
        service?.name ?? '',
      ),
      invoice: result.invoice
        ? toInvoiceResponse(result.invoice, patient?.fullName ?? '', patient?.patientCode ?? '')
        : null,
    };
  }
}
