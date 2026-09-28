import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum';

export class PayInvoiceRequestDto {
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  /**
   * Version-up 0.2 item #10: which unpaid InvoiceItem rows this "collect
   * now" round covers — lets the receptionist collect just the exam fee, or
   * just a newly-billed CLS fee, instead of always paying the whole
   * invoice at once. Omitted/empty => pay every currently-unpaid item
   * (preserves the old "pay everything at once" behavior for callers that
   * don't know about per-stage billing yet).
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  itemIds?: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
