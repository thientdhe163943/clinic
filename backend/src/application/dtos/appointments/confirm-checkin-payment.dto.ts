import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';

// Payment-before-queue change (2026-08-21): check-in is now 2 steps —
// PATCH :id/check-in (status -> CHECKED_IN, bills the exam fee, no Visit
// yet) then this endpoint (collects the exam fee, then creates the Visit /
// assigns the queue number). `priority` is carried here from the
// check-in form rather than persisted in between, since no Visit exists
// yet to store it on.
export class ConfirmCheckInPaymentRequestDto {
  @IsOptional()
  @IsEnum(VisitPriority)
  priority?: VisitPriority;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}
