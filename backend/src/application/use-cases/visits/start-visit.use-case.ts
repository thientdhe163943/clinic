import { Inject, Injectable } from '@nestjs/common';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import {
  ExaminationFeeNotPaidError,
  RoomBusyError,
  VisitNotFoundError,
  VisitNotStartableError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';
import { INVOICE_REPOSITORY, InvoiceRepository } from '../../../domain/repositories/invoice.repository';

// Feature 16b: Called/AwaitingResults -> InProgress. This is where the
// "only 1 InProgress visit per room" rule is enforced (moved out of
// CallPatientUseCase, since Called no longer implies the room is occupied).
// Also syncs appointments.status -> InProgress in the same action.
@Injectable()
export class StartVisitUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(visitId: string, actorId: string): Promise<VisitResponseDto> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.CALLED && visit.status !== VisitStatus.AWAITING_RESULTS) {
      throw new VisitNotStartableError();
    }

    // Business Rule: only 1 IN_PROGRESS visit per room at a time.
    const inProgressCount = await this.visitRepository.countInProgressByRoom(visit.roomId);
    if (inProgressCount > 0) throw new RoomBusyError();

    // Business Rule — Gate #1 (version-up 0.2 item #10): the exam-fee
    // InvoiceItem (billed at check-in, see CheckInAppointmentUseCase) must
    // be collected before the doctor may start the visit. No SERVICE item
    // at all (invoice missing, or the appointment had no serviceId at
    // booking time — see CheckInAppointmentUseCase) means there's nothing
    // to gate on, so it's allowed through rather than blocked forever.
    const invoice = await this.invoiceRepository.findByAppointmentId(visit.appointmentId);
    const examinationItem = invoice?.items.find((item) => item.itemType === InvoiceItemType.SERVICE);
    if (examinationItem && !examinationItem.paidAt) {
      throw new ExaminationFeeNotPaidError();
    }

    const startedAt = new Date();
    const updated = await this.visitRepository.startVisit(visitId, startedAt);
    await this.appointmentRepository.updateStatus(visit.appointmentId, AppointmentStatus.IN_PROGRESS);

    await this.auditLog.write({
      userId: actorId,
      action: 'START_VISIT',
      module: 'VISIT',
      targetId: visitId,
    });

    const appointment = await this.appointmentRepository.findById(visit.appointmentId);
    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(visit.patientId),
      this.userRepository.findById(visit.doctorId),
      appointment?.serviceId ? this.serviceRepository.findById(appointment.serviceId) : Promise.resolve(null),
    ]);

    try {
      this.realtimePort.emit(['DOCTOR', 'NURSE', 'RECEPTIONIST'], 'visit:changed', { visitId: updated.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    return toVisitResponse(
      updated,
      patient?.fullName ?? '',
      patient?.patientCode ?? '',
      doctor?.fullName ?? '',
      service?.name ?? '',
      appointment?.appointmentTime ?? new Date(),
      appointment?.note ?? null,
      patient?.phone ?? '',
    );
  }
}
