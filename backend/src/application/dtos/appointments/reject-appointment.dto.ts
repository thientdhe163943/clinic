import { IsNotEmpty, IsString } from 'class-validator';

export class RejectAppointmentRequestDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
