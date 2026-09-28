import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../pagination.dto';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';

export class ListInvoicesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
