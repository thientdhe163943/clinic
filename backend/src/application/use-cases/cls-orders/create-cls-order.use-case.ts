import { Inject, Injectable } from '@nestjs/common';
import { CreateClsOrderDto } from '../../dtos/cls-orders/create-cls-order.dto';
import { ClsOrderResponseDto, toClsOrderResponse } from '../../dtos/cls-orders/cls-order-response.dto';
import {
  ClsRoomNotActiveError,
  ClsRoomTypeError,
  ClsServiceRoomCategoryMismatchError,
  ResourceNotFoundError,
  VisitNotFoundError,
  VisitNotInProgressError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { InvoiceBillingService } from '../../services/invoice-billing.service';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';

export interface CreateClsOrderInput extends CreateClsOrderDto {
  visitId: string;
  actorId: string;
}

@Injectable()
export class CreateClsOrderUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly invoiceBilling: InvoiceBillingService,
  ) {}

  async execute(input: CreateClsOrderInput): Promise<ClsOrderResponseDto> {
    // Validate visit, room, service in parallel — all independent lookups
    const [visit, clsRoom, service] = await Promise.all([
      this.visitRepository.findById(input.visitId),
      this.roomRepository.findById(input.clsRoomId),
      this.serviceRepository.findById(input.serviceId),
    ]);

    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.IN_PROGRESS) throw new VisitNotInProgressError();
    if (!clsRoom) throw new ResourceNotFoundError('Room');
    if (clsRoom.type !== RoomType.CLS) throw new ClsRoomTypeError();
    if (!clsRoom.isActive) throw new ClsRoomNotActiveError();
    if (!service) throw new ResourceNotFoundError('Service');
    // Legacy data may not have either category backfilled yet — only block
    // when both sides are known and they actually disagree.
    if (service.clsCategory && clsRoom.clsCategory && service.clsCategory !== clsRoom.clsCategory) {
      throw new ClsServiceRoomCategoryMismatchError();
    }

    const order = await this.clsOrderRepository.create({
      visitId: input.visitId,
      clsRoomId: input.clsRoomId,
      serviceId: input.serviceId,
      note: input.note ?? null,
      createdBy: input.actorId,
    });

    // Fetch data for response and audit in parallel
    const [appointment, patient, doctor] = await Promise.all([
      this.appointmentRepository.findById(visit.appointmentId),
      this.patientRepository.findById(visit.patientId),
      this.userRepository.findById(visit.doctorId),
    ]);

    // Business Rule — Gate #2 (version-up 0.2 item #10): bill the CLS fee
    // onto the appointment's invoice right away (creating the invoice first
    // if this appointment had no serviceId at booking time, so none exists
    // yet — see CheckInAppointmentUseCase) — CallPatientToClsUseCase blocks
    // the CLS room from calling this patient in until this specific line is
    // paid.
    if (appointment) {
      const invoice = await this.invoiceBilling.ensureInvoiceHasItems({
        appointmentId: appointment.id,
        patientId: visit.patientId,
        createdBy: input.actorId,
        items: [
          this.invoiceBilling.buildClsItem({
            clsOrderId: order.id,
            serviceName: service.name,
            unitPrice: service.price,
          }),
        ],
      });
      try {
        // Lets the receptionist know a new "cần thu" line just appeared
        // without the patient having to say so at the counter.
        this.realtimePort.emit(['RECEPTIONIST', 'ADMIN'], 'invoice:changed', { invoiceId: invoice.id });
      } catch {
        // Realtime notification is best-effort — never let it fail the write.
      }
    }

    // Audit log and realtime push — fire and forget
    void Promise.all([
      this.auditLog.write({
        userId: input.actorId,
        action: 'CREATE_CLS_ORDER',
        module: 'VISIT',
        targetId: order.id,
        detail: { visitId: input.visitId },
      }),
      Promise.resolve().then(() => {
        this.realtimePort.emit('LAB_TECH', 'cls-order:changed', { clsOrderId: order.id });
      }),
    ]);

    return toClsOrderResponse(
      order,
      service.name,
      clsRoom.name,
      patient?.fullName ?? '',
      patient?.patientCode ?? '',
      patient?.dateOfBirth ?? null,
      patient?.gender ?? '',
      doctor?.fullName ?? '',
      appointment?.appointmentTime ?? new Date(),
      null,
      [],
      null,
      clsRoom.clsCategory,
    );
  }

}
