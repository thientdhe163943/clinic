import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../pagination.dto';
import { SupplyStockStatus } from '../../../domain/enums/supply-stock-status.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class ListSuppliesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(SupplyStockStatus, { message: MSG.ERR_0128 })
  status?: SupplyStockStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
