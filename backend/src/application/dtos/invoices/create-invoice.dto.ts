import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvoiceRequestDto {
  @IsNotEmpty()
  @IsString()
  appointmentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
