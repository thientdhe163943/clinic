import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import {
  SupplyTransactionListResponseDto,
  SupplyTransactionResponseDto,
} from '../../dtos/supplies/supply-transaction-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { SupplyTransactionType } from '../../../domain/enums/supply-transaction-type.enum';
import {
  SUPPLY_REPOSITORY,
  SupplyRepository,
  SupplyTransactionListItem,
} from '../../../domain/repositories/supply.repository';

export interface ListSupplyTransactionsInput {
  supplyId: string;
  from?: Date;
  to?: Date;
  type?: SupplyTransactionType;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListSupplyTransactionsUseCase {
  constructor(@Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository) {}

  async execute(input: ListSupplyTransactionsInput): Promise<SupplyTransactionListResponseDto> {
    const supply = await this.supplyRepository.findById(input.supplyId);
    if (!supply) throw new ResourceNotFoundError('Supply', { id: input.supplyId });

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { items, total } = await this.supplyRepository.findTransactions(input.supplyId, {
      from: input.from,
      to: input.to,
      type: input.type,
      page,
      limit,
    });

    return {
      items: items.map((item) => this.toDto(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private toDto(item: SupplyTransactionListItem): SupplyTransactionResponseDto {
    const { transaction } = item;
    return {
      id: transaction.id,
      supplyId: transaction.supplyId,
      transactionType: transaction.transactionType,
      quantity: transaction.quantity,
      roomId: transaction.roomId,
      roomName: item.roomName,
      note: transaction.note,
      actorName: item.actorName,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
