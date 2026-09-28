import { Inject, Injectable } from '@nestjs/common';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import {
  ExaminationResultRequiredError,
  VisitHasIncompleteClsError,
  VisitNotFoundError,
  VisitNotInProgressError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { InvoiceBillingService } from '../../services/invoice-billing.service';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';
import {
  PRESCRIPTION_REPOSITORY,
  PrescriptionRepository,
} from '../../../domain/repositories/prescription.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';

@Injectable()
export class CompleteVisitUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository,
    @Inject(PRESCRIPTION_REPOSITORY) private readonly prescriptionRepository: PrescriptionRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly invoiceBilling: InvoiceBillingService,
  ) {}

  async execute(visitId: string, actorId: string): Promise<VisitResponseDto> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.IN_PROGRESS) throw new VisitNotInProgressError();

    // Business Rule: examination result must exist before completing
    const result = await this.visitRepository.findResultWithDetails(visitId);
    if (!result) throw new ExaminationResultRequiredError();

    // Business Rule: all CLS orders must be COMPLETED or CANCELLED
    const hasIncomplete = await this.visitRepository.hasIncompleteClsOrders(visitId);
    if (hasIncomplete) throw new VisitHasIncompleteClsError();

    const completedAt = new Date();
    const updated = await this.visitRepository.completeVisit(visitId, completedAt);
    await this.appointmentRepository.updateStatus(visit.appointmentId, AppointmentStatus.COMPLETED);

    // Business Rule (version-up 0.2 item #10): bill any prescribed medicine
    // onto the invoice now, at visit completion — unlike the exam/CLS fees,
    // there's no hard payment gate on medicine (nothing downstream depends
    // on it being paid first); it's simply the last line added before the
    // receptionist collects the final balance on the patient's way out.
    let billedInvoiceId: string | null = null;
    const prescription = await this.prescriptionRepository.findByVisitId(visitId);
    if (prescription && prescription.items.length > 0) {
      const medicineIds = [...new Set(prescription.items.map((item) => item.medicineId))];
      const medicines = await Promise.all(medicineIds.map((id) => this.medicineRepository.findById(id)));
      const priceByMedicineId = new Map(
        medicines.filter((m): m is NonNullable<typeof m> => m !== null).map((m) => [m.id, m.price ?? 0]),
      );
      const medicineItems = prescription.items.map((item) =>
        this.invoiceBilling.buildMedicineItem({
          prescriptionItemId: item.id,
          medicineName: item.medicineName,
          unitPrice: priceByMedicineId.get(item.medicineId) ?? 0,
        }),
      );
      const invoice = await this.invoiceBilling.ensureInvoiceHasItems({
        appointmentId: visit.appointmentId,
        patientId: visit.patientId,
        createdBy: actorId,
        items: medicineItems,
      });
      billedInvoiceId = invoice.id;
    }

    await this.auditLog.write({
      userId: actorId,
      action: 'COMPLETE_VISIT',
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
      // Also emit appointment:changed — Appointment.status just flipped to
      // COMPLETED, and this is what the receptionist's appointment
      // list/detail page listens for. invoice:changed too: any medicine
      // lines just appended above (version-up 0.2 item #10) mean there may
      // be a fresh balance to collect on the patient's way out.
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: visit.appointmentId });
      if (billedInvoiceId) {
        this.realtimePort.emit(['RECEPTIONIST', 'ADMIN'], 'invoice:changed', { invoiceId: billedInvoiceId });
      }
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
