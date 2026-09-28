import { ClsOrderStatus } from '../enums/cls-order-status.enum';

export class ClsOrder {
  constructor(
    public readonly id: string,
    public readonly visitId: string,
    public readonly clsRoomId: string,
    public readonly serviceId: string,
    public readonly note: string | null,
    public readonly status: ClsOrderStatus,
    public readonly calledAt: Date | null,
    public readonly createdAt: Date,
    public readonly createdBy: string,
  ) {}
}
