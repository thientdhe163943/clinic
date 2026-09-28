import { Inject, Injectable } from '@nestjs/common';
import { ClsOrderResponseDto, toClsOrderResponse } from '../../dtos/cls-orders/cls-order-response.dto';
import {
  ClsOrderNotFoundError,
  ClsOrderNotPendingError,
  ClsRoomNotActiveError,
  ClsRoomTypeError,
  ClsServiceRoomCategoryMismatchError,
  ClsOrderDuplicateServiceError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';
import { INVOICE_REPOSITORY, InvoiceRepository } from '../../../domain/repositories/invoice.repository';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';

export interface EditClsOrderInput {
  clsRoomId?: string;
  serviceId?: string;
  note?: string | null;
}

@Injectable()
export class EditClsOrderUseCase {
  constructor(
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(clsOrderId: string, input: EditClsOrderInput, actorId: string): Promise<ClsOrderResponseDto> {
    const item = await this.clsOrderRepository.findWithDetailById(clsOrderId);
    if (!item) throw new ClsOrderNotFoundError();
    if (item.order.status !== ClsOrderStatus.PENDING) throw new ClsOrderNotPendingError();

    // If changing to a different service, check it's not already ordered for this visit
    if (input.serviceId && input.serviceId !== item.order.serviceId) {
      const siblings = await this.clsOrderRepository.findByVisitId(item.order.visitId);
      const duplicate = siblings.some(
        (s) => s.order.id !== clsOrderId && s.order.serviceId === input.serviceId && s.order.status !== ClsOrderStatus.CANCELLED,
      );
      if (duplicate) throw new ClsOrderDuplicateServiceError();
    }

    let serviceName = item.serviceName;
    let clsRoomName = item.clsRoomName;
    let clsRoomCategory = item.clsRoomCategory;
    let serviceClsCategory: ClsRoomCategory | null = null;
    let newServicePrice: number | null = null;

    if (input.serviceId) {
      const service = await this.serviceRepository.findById(input.serviceId);
      if (!service) throw new ResourceNotFoundError('Service');
      serviceName = service.name;
      serviceClsCategory = service.clsCategory;
      newServicePrice = Number(service.price);
    }

    if (input.clsRoomId) {
      const room = await this.roomRepository.findById(input.clsRoomId);
      if (!room) throw new ResourceNotFoundError('Room');
      if (room.type !== RoomType.CLS) throw new ClsRoomTypeError();
      if (!room.isActive) throw new ClsRoomNotActiveError();
      clsRoomName = room.name;
      clsRoomCategory = room.clsCategory;
    }

    // Only re-validate when at least one side is actually changing — if
    // neither serviceId nor clsRoomId is provided, whatever combination is
    // already on the order was valid when it was created/last edited.
    if (input.serviceId || input.clsRoomId) {
      const effectiveServiceCategory = input.serviceId
        ? serviceClsCategory
        : (await this.serviceRepository.findById(item.order.serviceId))?.clsCategory ?? null;
      const effectiveRoomCategory = input.clsRoomId
        ? clsRoomCategory
        : (await this.roomRepository.findById(item.order.clsRoomId))?.clsCategory ?? null;

      // Legacy data may not have either category backfilled yet — only
      // block when both sides are known and they actually disagree.
      if (effectiveServiceCategory && effectiveRoomCategory && effectiveServiceCategory !== effectiveRoomCategory) {
        throw new ClsServiceRoomCategoryMismatchError();
      }
    }

    const updated = await this.clsOrderRepository.update(clsOrderId, input);

    // Sync the linked invoice item whenever the service changes
    if (input.serviceId && input.serviceId !== item.order.serviceId && newServicePrice !== null) {
      await this.invoiceRepository.updateItemByClsRefId(clsOrderId, {
        name: serviceName,
        unitPrice: newServicePrice,
        amount: newServicePrice,
      });
    }

    await this.auditLog.write({
      userId: actorId,
      action: 'EDIT_CLS_ORDER',
      module: 'VISIT',
      targetId: clsOrderId,
      detail: { changes: input },
    });

    return toClsOrderResponse(
      updated,
      serviceName,
      clsRoomName,
      item.patientName,
      item.patientCode,
      item.dateOfBirth,
      item.gender,
      item.doctorName,
      item.appointmentTime,
      item.resultSummary,
      item.resultAttachments,
      item.resultRows,
      clsRoomCategory,
      item.resultFindings,
    );
  }
}
