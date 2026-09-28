import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../pagination.dto';
import { SupplyTransactionType } from '../../../domain/enums/supply-transaction-type.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class ListSupplyTransactionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(SupplyTransactionType, { message: MSG.ERR_0129 })
  type?: SupplyTransactionType;
}
