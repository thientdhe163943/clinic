import { Inject, Injectable } from '@nestjs/common';
import { toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import { ConfirmCheckInPaymentRequestDto } from '../../dtos/appointments/confirm-checkin-payment.dto';
import { CheckInResponseDto } from '../../dtos/appointments/checkin-response.dto';
import { toInvoiceResponse } from '../../dtos/invoices/invoice-response.dto';
import {
  AppointmentNotCheckedInError,
  CheckInAlreadyConfirmedError,
  ResourceNotFoundError,
  ScheduleRoomMissingError,
} from '../../errors/application-error';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';
import { INVOICE_REPOSITORY, InvoiceRepository } from '../../../domain/repositories/invoice.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';

export interface ConfirmCheckInPaymentInput extends ConfirmCheckInPaymentRequestDto {
  appointmentId: string;
  actorId: string;
}

// Payment-before-queue change (2026-08-21, explicit user request): the
// patient must not appear in the doctor's WAITING queue until the exam fee
// is actually collected. CheckInAppointmentUseCase now only transitions the
// appointment to CHECKED_IN and bills the exam fee (UNPAID) — this use case
// is the second step: collect that fee, then create the Visit/queue number.
// StartVisitUseCase's Gate #1 (exam fee must be paid before the doctor
// starts the exam) is left in place as defensive-in-depth even though it
// should now be structurally unreachable — a Visit can no longer exist
// unless this use case already collected the fee.
@Injectable()
export class ConfirmCheckInPaymentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(input: ConfirmCheckInPaymentInput): Promise<CheckInResponseDto> {
    const appointment = await this.appointmentRepository.findById(input.appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: input.appointmentId });

    // Business Rule: only an appointment that has already gone through
    // check-in (status CHECKED_IN) can have its payment confirmed here.
    if (appointment.status !== AppointmentStatus.CHECKED_IN) throw new AppointmentNotCheckedInError();
    if (!appointment.doctorId) throw new ResourceNotFoundError('Appointment doctor', { id: input.appointmentId });
    if (!appointment.roomId) throw new ScheduleRoomMissingError();

    // Idempotency guard: a Visit already existing for this appointment means
    // this step already ran (e.g. a double-submit) — reject rather than
    // silently minting a second queue number.
    const existingVisit = await this.visitRepository.findByAppointmentId(appointment.id);
    if (existingVisit) throw new CheckInAlreadyConfirmedError();

    // Collect the exam fee if there's an unpaid one — same "nothing to gate
    // on => allow through" rule as the old Gate #1 when the appointment had
    // no serviceId at booking time (nothing was ever billed).
    let invoice = await this.invoiceRepository.findByAppointmentId(appointment.id);
    const examinationItem = invoice?.items.find((item) => item.itemType === InvoiceItemType.SERVICE);
    if (invoice && examinationItem && !examinationItem.paidAt) {
      invoice = await this.invoiceRepository.payItems({
        invoiceId: invoice.id,
        itemIds: [examinationItem.id],
        amount: examinationItem.amount,
        method: input.paymentMethod,
        paidAt: new Date(),
        createdBy: input.actorId,
        note: input.note,
      });
    }

    const visit = await this.appointmentRepository.createVisitForCheckIn({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      roomId: appointment.roomId,
      priority: input.priority,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'CHECKIN_PAYMENT_CONFIRMED',
      module: 'APPOINTMENT',
      targetId: appointment.id,
    });

    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(appointment.patientId),
      this.userRepository.findById(appointment.doctorId),
      appointment.serviceId ? this.serviceRepository.findById(appointment.serviceId) : Promise.resolve(null),
    ]);

    try {
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: appointment.id });
      if (invoice) this.realtimePort.emit(['RECEPTIONIST', 'ADMIN'], 'invoice:changed', { invoiceId: invoice.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    return {
      appointment: toAppointmentResponse(
        appointment,
        patient?.fullName ?? '',
        patient?.patientCode ?? '',
        doctor ? DoctorDisplayName.format(doctor.fullName) : '',
        service?.name ?? '',
      ),
      visit: {
        id: visit.id,
        appointmentId: visit.appointmentId,
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        roomId: visit.roomId,
        queueNumber: visit.queueNumber,
        priority: visit.priority,
        status: visit.status,
        createdAt: visit.createdAt,
      },
      invoice: invoice ? toInvoiceResponse(invoice, patient?.fullName ?? '', patient?.patientCode ?? '') : null,
    };
  }
}
