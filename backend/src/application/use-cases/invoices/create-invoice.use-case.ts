import { Inject, Injectable } from '@nestjs/common';
import { CreateInvoiceRequestDto } from '../../dtos/invoices/create-invoice.dto';
import { InvoiceResponseDto, toInvoiceResponse } from '../../dtos/invoices/invoice-response.dto';
import {
  AppointmentNotCheckedInForInvoiceError,
  InvoiceAlreadyExistsError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { NOTIFICATION_PORT, NotificationPort } from '../../ports/notification.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { InvoiceBillingService } from '../../services/invoice-billing.service';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { InvoiceCode } from '../../../domain/value-objects/invoice-code.vo';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';
import {
  CreateInvoiceItemData,
  INVOICE_REPOSITORY,
  InvoiceRepository,
} from '../../../domain/repositories/invoice.repository';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import {
  PRESCRIPTION_REPOSITORY,
  PrescriptionRepository,
} from '../../../domain/repositories/prescription.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';

const INVOICE_CODE_GENERATION_ATTEMPTS = 5;

export interface CreateInvoiceInput extends CreateInvoiceRequestDto {
  actorId: string;
}

// Version-up 0.2 item #10: this endpoint is no longer the primary way an
// invoice comes into existence — that now happens automatically and
// incrementally (check-in creates it with the exam-fee line,
// CreateClsOrderUseCase/CompleteVisitUseCase append to it, see
// InvoiceBillingService). POST /invoices is kept only as a fallback for
// appointments that were checked in before this feature shipped and
// therefore never got an invoice created for them — it still rebuilds the
// full item set (SERVICE + completed CLS + prescribed medicine) in one shot,
// matching the old all-at-once behavior for that legacy/migration case.
@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(PRESCRIPTION_REPOSITORY) private readonly prescriptionRepository: PrescriptionRepository,
    @Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository,
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly invoiceBilling: InvoiceBillingService,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<InvoiceResponseDto> {
    const appointment = await this.appointmentRepository.findById(input.appointmentId);
    if (!appointment) throw new ResourceNotFoundError('Appointment', { id: input.appointmentId });

    // Business Rule (relaxed 2026-08-19, version-up 0.2 item #10): an
    // invoice is normally created at check-in already — this fallback path
    // only requires the appointment to have at least been checked in
    // (previously required Appointment.COMPLETED).
    if (!appointment.checkedInAt) throw new AppointmentNotCheckedInForInvoiceError();

    // Business Rule: at most one invoice per appointment (invoices.appointment_id is UNIQUE).
    const existing = await this.invoiceRepository.findByAppointmentId(appointment.id);
    if (existing) throw new InvoiceAlreadyExistsError();

    const patient = await this.patientRepository.findById(appointment.patientId);
    if (!patient) throw new ResourceNotFoundError('Patient', { id: appointment.patientId });

    const items: CreateInvoiceItemData[] = [];

    // 1. Main appointment service.
    if (appointment.serviceId) {
      const service = await this.serviceRepository.findById(appointment.serviceId);
      if (service) {
        items.push(this.invoiceBilling.buildExaminationItem(service));
      }
    }

    // 2. Completed CLS (cận lâm sàng) orders for this visit — cancelled/pending
    // orders were never actually performed and are not billed.
    const visit = await this.visitRepository.findByAppointmentId(appointment.id);
    if (visit) {
      const clsOrders = await this.clsOrderRepository.findByVisitId(visit.id);
      const completedOrders = clsOrders.filter((item) => item.order.status === ClsOrderStatus.COMPLETED);
      const clsServiceIds = [...new Set(completedOrders.map((item) => item.order.serviceId))];
      const clsServices = await Promise.all(clsServiceIds.map((id) => this.serviceRepository.findById(id)));
      const clsServiceById = new Map(clsServices.filter((s) => s !== null).map((s) => [s.id, s]));

      for (const { order, serviceName } of completedOrders) {
        const service = clsServiceById.get(order.serviceId);
        items.push(
          this.invoiceBilling.buildClsItem({
            clsOrderId: order.id,
            serviceName,
            unitPrice: service?.price ?? 0,
          }),
        );
      }

      // 3. Prescribed medicines for this visit.
      const prescription = await this.prescriptionRepository.findByVisitId(visit.id);
      if (prescription && prescription.items.length > 0) {
        const medicineIds = [...new Set(prescription.items.map((item) => item.medicineId))];
        const medicines = await Promise.all(medicineIds.map((id) => this.medicineRepository.findById(id)));
        const priceByMedicineId = new Map(
          medicines.filter((m): m is NonNullable<typeof m> => m !== null).map((m) => [m.id, m.price ?? 0]),
        );

        for (const item of prescription.items) {
          items.push(
            this.invoiceBilling.buildMedicineItem({
              prescriptionItemId: item.id,
              medicineName: item.medicineName,
              unitPrice: priceByMedicineId.get(item.medicineId) ?? 0,
            }),
          );
        }
      }
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const discount = input.discount ?? 0;
    const total = Math.max(subtotal - discount, 0);
    const amountDue = total;

    let invoice: Awaited<ReturnType<InvoiceRepository['create']>> | null = null;
    for (let attempt = 0; attempt < INVOICE_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        invoice = await this.invoiceRepository.create({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          invoiceCode: InvoiceCode.generate().value,
          subtotal,
          discount,
          total,
          amountDue,
          note: input.note,
          createdBy: input.actorId,
          items,
        });
        break;
      } catch (error) {
        const isLastAttempt = attempt === INVOICE_CODE_GENERATION_ATTEMPTS - 1;
        if (isLastAttempt) throw error;
      }
    }
    if (!invoice) throw new InvoiceAlreadyExistsError();

    await this.auditLog.write({
      userId: input.actorId,
      action: 'INVOICE_CREATED',
      module: 'INVOICE',
      targetId: invoice.id,
      detail: { invoiceCode: invoice.invoiceCode, total: invoice.total },
    });

    // Feature 64 business rule: notification_logs type=INVOICE_CREATED.
    // Failure is swallowed inside NotificationPort — never blocks invoice creation.
    if (patient.notificationConsent && patient.email) {
      await this.notification.notify({
        userId: patient.userId,
        recipient: patient.email,
        channel: 'EMAIL',
        type: 'INVOICE_CREATED',
        subject: 'Hóa đơn khám bệnh',
        body: `Hóa đơn ${invoice.invoiceCode} đã được tạo. Tổng tiền: ${invoice.total.toLocaleString('vi-VN')}đ, còn phải thanh toán: ${invoice.amountDue.toLocaleString('vi-VN')}đ.`,
        refId: invoice.id,
      });
    }

    try {
      this.realtimePort.emit(['RECEPTIONIST', 'ADMIN'], 'invoice:changed', { invoiceId: invoice.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    return toInvoiceResponse(invoice, patient.fullName, patient.patientCode);
  }
}
