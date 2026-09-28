import { Inject, Injectable } from '@nestjs/common';
import { ClsOrderResponseDto, toClsOrderResponse } from '../../dtos/cls-orders/cls-order-response.dto';
import {
  ClsOrderNotFoundError,
  ClsOrderNotInProgressError,
  ClsResultAlreadyConfirmedError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository, LabResultRow } from '../../../domain/repositories/cls-order.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';

@Injectable()
export class EnterClsResultUseCase {
  constructor(
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(
    clsOrderId: string,
    summary: string,
    actorId: string,
    rows?: LabResultRow[],
    findings?: string,
    finalize = false,
  ): Promise<ClsOrderResponseDto> {
    const item = await this.clsOrderRepository.findWithDetailById(clsOrderId);
    if (!item) throw new ClsOrderNotFoundError();
    // Business Rule (2026-08-21, revised): the order locks only once it's
    // explicitly finalized (finalize=true), not on every save — a KTV can
    // save progress repeatedly while still IN_PROGRESS. Once COMPLETED,
    // further calls (draft or finalize) are rejected; editing a confirmed
    // CLS result silently, with no trace of the prior value, isn't
    // acceptable for medical data — the KTV must raise an amendment through
    // their supervisor instead (outside this endpoint).
    if (item.order.status === ClsOrderStatus.COMPLETED) {
      throw new ClsResultAlreadyConfirmedError();
    }
    if (item.order.status !== ClsOrderStatus.IN_PROGRESS) {
      throw new ClsOrderNotInProgressError();
    }

    const updated = await this.clsOrderRepository.enterResult(clsOrderId, summary, actorId, rows, findings, finalize);

    await this.auditLog.write({
      userId: actorId,
      action: 'ENTER_CLS_RESULT',
      module: 'VISIT',
      targetId: clsOrderId,
    });

    // Feature: push the ordering doctor a direct, targeted signal that a
    // result they're waiting on is ready — resolved via the visit rather
    // than ClsOrderListItem, which only carries doctorName, not doctorId.
    const visit = await this.visitRepository.findById(item.order.visitId);
    if (visit) {
      try {
        this.realtimePort.emit(visit.doctorId, 'cls-order:result-ready', { clsOrderId: item.order.id });
      } catch {
        // Realtime notification is best-effort — never let it fail the write.
      }
    }

    return toClsOrderResponse(
      updated,
      item.serviceName,
      item.clsRoomName,
      item.patientName,
      item.patientCode,
      item.dateOfBirth,
      item.gender,
      item.doctorName,
      item.appointmentTime,
      summary,
      item.resultAttachments,
      rows ?? null,
      item.clsRoomCategory,
      findings ?? null,
    );
  }
}
