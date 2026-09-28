import { Inject, Injectable } from '@nestjs/common';
import { DistributeSupplyResponseDto } from '../../dtos/supplies/distribute-supply-response.dto';
import { InvalidQuantityError, ResourceNotFoundError, SupplyRoomInactiveError } from '../../errors/application-error';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SUPPLY_REPOSITORY, SupplyRepository } from '../../../domain/repositories/supply.repository';

export interface DistributeSupplyInput {
  supplyId: string;
  roomId: string;
  quantity: number;
  createdBy: string;
}

@Injectable()
export class DistributeSupplyUseCase {
  constructor(
    @Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
  ) {}

  async execute(input: DistributeSupplyInput): Promise<DistributeSupplyResponseDto> {
    // Feature 29 BR: quantity must be > 0 (MSG_ERR_0050).
    if (input.quantity <= 0) throw new InvalidQuantityError();

    const supply = await this.supplyRepository.findById(input.supplyId);
    if (!supply) throw new ResourceNotFoundError('Supply', { id: input.supplyId });

    const room = await this.roomRepository.findById(input.roomId);
    if (!room) throw new ResourceNotFoundError('Room', { id: input.roomId });

    // Alternative Flow A2: "Phòng đang Inactive -> Không cho phép phân phối."
    if (!room.isActive) throw new SupplyRoomInactiveError();

    // Alternative Flow A1 (insufficient stock) is checked under a row lock
    // inside SupplyRepository.distribute() to avoid a race with concurrent
    // distributions of the same supply — see InsufficientStockError there.
    const result = await this.supplyRepository.distribute({
      supplyId: input.supplyId,
      roomId: input.roomId,
      quantity: input.quantity,
      createdBy: input.createdBy,
    });

    return {
      transactionId: result.transaction.id,
      supplyId: input.supplyId,
      supplyName: result.supplyName,
      unit: result.unit,
      roomId: input.roomId,
      roomName: room.name,
      quantity: input.quantity,
      currentStock: result.currentStock,
      createdAt: result.transaction.createdAt.toISOString(),
    };
  }
}
