import { SupplyTransactionType } from '../../../domain/enums/supply-transaction-type.enum';
import { PaginationMeta } from '../pagination.dto';

export interface SupplyTransactionResponseDto {
  id: string;
  supplyId: string;
  transactionType: SupplyTransactionType;
  quantity: number;
  roomId: string | null;
  roomName: string | null;
  note: string | null;
  actorName: string;
  createdAt: string;
}

export interface SupplyTransactionListResponseDto {
  items: SupplyTransactionResponseDto[];
  meta: PaginationMeta;
}
