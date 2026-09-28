import { Inject, Injectable } from '@nestjs/common';
import { ClsOrderResponseDto, toClsOrderResponse } from '../../dtos/cls-orders/cls-order-response.dto';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';

@Injectable()
export class ListClsOrdersUseCase {
  constructor(
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
  ) {}

  async execute(visitId: string): Promise<ClsOrderResponseDto[]> {
    const items = await this.clsOrderRepository.findByVisitId(visitId);
    return items.map((item) =>
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
    );
  }
}
