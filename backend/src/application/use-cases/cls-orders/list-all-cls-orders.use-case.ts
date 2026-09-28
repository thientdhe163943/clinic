import { Inject, Injectable } from '@nestjs/common';
import { ClsOrderResponseDto, toClsOrderResponse } from '../../dtos/cls-orders/cls-order-response.dto';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';
import { WORK_SCHEDULE_REPOSITORY, WorkScheduleRepository } from '../../../domain/repositories/work-schedule.repository';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';

export interface LabQueueResult {
  clsRoomId: string | null;
  clsRoomName: string | null;
  orders: ClsOrderResponseDto[];
}

@Injectable()
export class ListAllClsOrdersUseCase {
  constructor(
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
  ) {}

  async execute(actorId: string, statuses?: ClsOrderStatus[]): Promise<LabQueueResult> {
    const now = nowAsClinicNaiveUtc();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dateStr = today.toISOString().slice(0, 10);

    const shifts = await this.workScheduleRepository.findMany({ userId: actorId, from: today, to: today });

    if (shifts.length === 0) {
      return { clsRoomId: null, clsRoomName: null, orders: [] };
    }

    const firstShift = shifts[0];
    const clsRoomId = firstShift.schedule.roomId ?? undefined;
    const clsRoomName = firstShift.roomName ?? null;

    const allItems = await this.clsOrderRepository.findAll({ date: dateStr, statuses, clsRoomId });
    // CLS payment-before-queue change (2026-08-21, explicit user request):
    // an order whose fee hasn't been collected yet doesn't appear in the
    // lab tech's queue — CreateClsOrderUseCase (the doctor's own ordering
    // flow) is untouched, this only filters what shows up here.
    const items = allItems.filter((item) => item.isPaid);

    return {
      clsRoomId: clsRoomId ?? null,
      clsRoomName,
      orders: items.map((item) =>
        toClsOrderResponse(
          item.order,
          item.serviceName,
          item.clsRoomName,
          item.patientName,
          item.patientCode,
          item.dateOfBirth,
          item.gender,
          item.doctorName,
          item.appointmentTime,
          item.resultSummary,
          item.resultAttachments,
          item.resultRows,
          item.clsRoomCategory,
          item.resultFindings,
        ),
      ),
    };
  }
}
